import { Prisma, ResourceType } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { assertShelterAccess, getManagedShelterIds } from '../utils/access';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { receiptStorage } from '../integrations/ReceiptStorage';
import { log as audit } from './audit.service';
import { AlertService } from './alert.service';

type Tx = Prisma.TransactionClient;

const include = {
  shelter: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, name: true } },
  acceptedBy: { select: { id: true, name: true } },
} satisfies Prisma.DonationInclude;

/**
 * Applies an accepted donation to inventory exactly once. The guarded updateMany flips
 * PENDING/inventoryApplied=false to ACCEPTED/true; a second attempt matches no row and fails,
 * so stock cannot be added twice.
 */
async function acceptAndApply(tx: Tx, donationId: string, user: AuthUser) {
  const d = await tx.donation.findUnique({ where: { id: donationId } });
  if (!d) throw notFound('Donation not found');
  const flip = await tx.donation.updateMany({
    where: { id: donationId, status: 'PENDING', inventoryApplied: false },
    data: { status: 'ACCEPTED', inventoryApplied: true, acceptedById: user.id, acceptedAt: new Date() },
  });
  if (flip.count !== 1) throw conflict('Donation has already been accepted or rejected');

  let resource = await tx.resource.findFirst({ where: { shelterId: d.shelterId, resourceType: d.resourceType } });
  if (!resource) {
    resource = await tx.resource.create({ data: { shelterId: d.shelterId, resourceType: d.resourceType, quantity: 0, unit: d.unit } });
  } else if (!resource.isActive) {
    resource = await tx.resource.update({ where: { id: resource.id }, data: { isActive: true } });
  }
  const updated = await tx.resource.update({ where: { id: resource.id }, data: { quantity: { increment: d.quantity } } });
  await tx.stockMovement.create({
    data: {
      resourceId: resource.id,
      shelterId: d.shelterId,
      type: 'DONATION',
      delta: d.quantity,
      quantityAfter: updated.quantity,
      note: `Donation from ${d.donorName}`,
      userId: user.id,
      referenceId: d.id,
    },
  });
  await audit(tx, {
    userId: user.id,
    action: 'DONATION_ACCEPT',
    entity: 'Donation',
    entityId: d.id,
    metadata: { quantity: d.quantity, resourceType: d.resourceType, shelterId: d.shelterId },
  });
  await AlertService.evaluateShelter(tx, d.shelterId);
}

export interface CreateDonationInput {
  shelterId: string;
  donorName: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  receivedDate?: string;
  notes?: string | null;
  receiptRef?: string | null;
  receiptFileName?: string | null;
  applyToInventory?: boolean;
}

export class DonationService {
  static async list(
    user: AuthUser,
    f: { shelterId?: string; resourceType?: ResourceType; status?: 'PENDING' | 'ACCEPTED' | 'REJECTED'; from?: string; to?: string }
  ) {
    const managed = await getManagedShelterIds(user);
    const where: Prisma.DonationWhereInput = {};
    if (managed !== null) {
      if (f.shelterId && !managed.includes(f.shelterId)) throw forbidden('Forbidden: You do not manage this shelter');
      where.shelterId = f.shelterId ?? { in: managed };
    } else if (f.shelterId) {
      where.shelterId = f.shelterId;
    }
    if (f.resourceType) where.resourceType = f.resourceType;
    if (f.status) where.status = f.status;
    if (f.from || f.to) {
      where.receivedDate = { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(f.to) } : {}) };
    }
    return prisma.donation.findMany({ where, include, orderBy: { receivedDate: 'desc' }, take: 500 });
  }

  static async create(user: AuthUser, d: CreateDonationInput) {
    await assertShelterAccess(user, d.shelterId);
    const receiptUrl = d.receiptFileName ? await receiptStorage.store(d.receiptFileName) : null;
    return prisma.$transaction(async (tx) => {
      const shelter = await tx.shelter.findUniqueOrThrow({ where: { id: d.shelterId } });
      if (shelter.status === 'INACTIVE') throw badRequest('Inactive shelters cannot receive donations');
      const created = await tx.donation.create({
        data: {
          shelterId: d.shelterId,
          donorName: d.donorName,
          resourceType: d.resourceType,
          quantity: d.quantity,
          unit: d.unit,
          receivedDate: d.receivedDate ? new Date(d.receivedDate) : new Date(),
          notes: d.notes ?? null,
          receiptRef: d.receiptRef ?? null,
          receiptUrl,
          status: 'PENDING',
          recordedById: user.id,
        },
      });
      await audit(tx, {
        userId: user.id,
        action: 'DONATION_RECORD',
        entity: 'Donation',
        entityId: created.id,
        metadata: { shelterId: d.shelterId, quantity: d.quantity, resourceType: d.resourceType, applyToInventory: !!d.applyToInventory },
      });
      if (d.applyToInventory) await acceptAndApply(tx, created.id, user);
      return tx.donation.findUniqueOrThrow({ where: { id: created.id }, include });
    });
  }

  static async update(
    user: AuthUser,
    id: string,
    d: { notes?: string | null; receiptRef?: string | null; receiptFileName?: string | null; status?: 'ACCEPTED' | 'REJECTED' }
  ) {
    const receiptUrl = d.receiptFileName ? await receiptStorage.store(d.receiptFileName) : undefined;
    return prisma.$transaction(async (tx) => {
      const existing = await tx.donation.findUnique({ where: { id } });
      if (!existing) throw notFound('Donation not found');
      await assertShelterAccess(user, existing.shelterId, tx);

      const data: Prisma.DonationUncheckedUpdateInput = {};
      if (d.notes !== undefined) data.notes = d.notes;
      if (d.receiptRef !== undefined) data.receiptRef = d.receiptRef;
      if (receiptUrl !== undefined) data.receiptUrl = receiptUrl;
      if (Object.keys(data).length) {
        await tx.donation.update({ where: { id }, data });
        await audit(tx, { userId: user.id, action: 'DONATION_UPDATE', entity: 'Donation', entityId: id, metadata: { fields: Object.keys(data) } });
      }

      if (d.status === 'ACCEPTED') await acceptAndApply(tx, id, user);
      if (d.status === 'REJECTED') {
        const res = await tx.donation.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED' } });
        if (res.count !== 1) throw conflict('Donation has already been accepted or rejected');
        await audit(tx, { userId: user.id, action: 'DONATION_REJECT', entity: 'Donation', entityId: id });
      }
      return tx.donation.findUniqueOrThrow({ where: { id }, include });
    });
  }
}
