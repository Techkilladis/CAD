import { Prisma, ResourceType, TransferStatus } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { canManageShelter, getManagedShelterIds } from '../utils/access';
import { log as audit } from './audit.service';
import { AlertService } from './alert.service';

type Tx = Prisma.TransactionClient;

/**
 * Transfer inventory semantics (local TransferWorkflow; AWS replacement: Step Functions):
 *   PENDING     nothing moves. The quantity is only *reserved* logically: it counts against the source's
 *               "available" figure (quantity - pending outgoing) so two requests cannot over-commit stock.
 *   APPROVED    source stock is deducted (TRANSFER_OUT movement). Goods are "in the system" but not at either shelter.
 *   IN_TRANSIT  no stock change (shippedAt recorded).
 *   RECEIVED    destination stock is increased (TRANSFER_IN movement), created if missing.
 *   REJECTED    only from PENDING; no stock change.
 *   CANCELLED   from PENDING: no stock change. From APPROVED/IN_TRANSIT (admin only): source is restored
 *               (TRANSFER_RETURN movement). Never after RECEIVED.
 * Every state change is a guarded updateMany (status in expected set) inside one transaction, so repeating a
 * request (double click, retry) fails with 409 and cannot deduct, add or restore stock twice.
 */

const include = {
  fromShelter: { select: { id: true, name: true, coordinatorId: true } },
  toShelter: { select: { id: true, name: true, coordinatorId: true } },
  requestedBy: { select: { id: true, name: true, role: true } },
  approvedBy: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} satisfies Prisma.TransferInclude;

type TransferRow = Prisma.TransferGetPayload<{ include: typeof include }>;

const withActions = (t: TransferRow, user: AuthUser, manages: (id: string) => boolean) => {
  const isAdmin = user.role === 'ADMIN';
  const canApprove = isAdmin && t.status === 'PENDING' && t.requestedById !== user.id;
  return {
    ...t,
    fromShelter: { id: t.fromShelter.id, name: t.fromShelter.name },
    toShelter: { id: t.toShelter.id, name: t.toShelter.name },
    actions: {
      approve: canApprove,
      reject: isAdmin && t.status === 'PENDING',
      transit: t.status === 'APPROVED' && (isAdmin || manages(t.fromShelterId)),
      receive: t.status === 'IN_TRANSIT' && (isAdmin || manages(t.toShelterId)),
      cancel:
        (t.status === 'PENDING' && (isAdmin || t.requestedById === user.id)) ||
        (isAdmin && (t.status === 'APPROVED' || t.status === 'IN_TRANSIT')),
    },
  };
};

async function decorate(user: AuthUser, rows: TransferRow[]) {
  const ids = await getManagedShelterIds(user);
  const set = new Set(ids ?? []);
  const manages = (id: string) => ids === null || set.has(id);
  return rows.map((r) => withActions(r, user, manages));
}

async function loadScoped(user: AuthUser, id: string, db: Tx | typeof prisma = prisma) {
  const t = await db.transfer.findUnique({ where: { id }, include });
  if (!t) throw notFound('Transfer not found');
  if (user.role !== 'ADMIN') {
    const ok = (await canManageShelter(user, t.fromShelterId, db)) || (await canManageShelter(user, t.toShelterId, db));
    if (!ok) throw forbidden('Forbidden: You are not involved in this transfer');
  }
  return t;
}

/** quantity minus quantity already promised to PENDING transfers out of this shelter. */
async function availableAtSource(tx: Tx, shelterId: string, type: ResourceType) {
  const resource = await tx.resource.findFirst({ where: { shelterId, resourceType: type, isActive: true } });
  if (!resource) return { resource: null, available: 0 };
  const pending = await tx.transfer.aggregate({
    where: { fromShelterId: shelterId, resourceType: type, status: 'PENDING' },
    _sum: { quantity: true },
  });
  return { resource, available: resource.quantity - (pending._sum.quantity ?? 0) };
}

async function guardedStatus(tx: Tx, id: string, from: TransferStatus[], data: Prisma.TransferUncheckedUpdateManyInput, message: string) {
  const res = await tx.transfer.updateMany({ where: { id, status: { in: from } }, data });
  if (res.count !== 1) throw conflict(message);
}

export class TransferService {
  static async create(
    user: AuthUser,
    d: { fromShelterId: string; toShelterId: string; resourceType: ResourceType; quantity: number; reason?: string | null }
  ) {
    if (d.fromShelterId === d.toShelterId) throw badRequest('Source and destination must be different');
    if (user.role === 'COORDINATOR') {
      const ownsEither = (await canManageShelter(user, d.fromShelterId)) || (await canManageShelter(user, d.toShelterId));
      if (!ownsEither) throw forbidden('Forbidden: your shelter must be the source or the destination');
    }
    const created = await prisma.$transaction(async (tx) => {
      const [from, to] = await Promise.all([
        tx.shelter.findUnique({ where: { id: d.fromShelterId } }),
        tx.shelter.findUnique({ where: { id: d.toShelterId } }),
      ]);
      if (!from || !to) throw notFound('Shelter not found');
      if (from.status === 'INACTIVE' || to.status === 'INACTIVE') throw badRequest('Inactive shelters cannot take part in transfers');

      const { available } = await availableAtSource(tx, d.fromShelterId, d.resourceType);
      if (available < d.quantity) throw badRequest('Insufficient resource quantity at source shelter');

      const t = await tx.transfer.create({
        data: { ...d, reason: d.reason ?? null, requestedById: user.id },
      });
      await audit(tx, {
        userId: user.id,
        action: 'TRANSFER_REQUEST',
        entity: 'Transfer',
        entityId: t.id,
        metadata: { from: d.fromShelterId, to: d.toShelterId, resourceType: d.resourceType, quantity: d.quantity },
      });
      return t;
    });
    return created;
  }

  static async list(user: AuthUser, f: { status?: TransferStatus; shelterId?: string; direction?: 'incoming' | 'outgoing' }) {
    const where: Prisma.TransferWhereInput = {};
    if (f.status) where.status = f.status;
    const managed = await getManagedShelterIds(user);
    if (user.role !== 'ADMIN' && (!managed || managed.length === 0)) return [];

    if (f.shelterId) {
      if (managed && !managed.includes(f.shelterId)) throw forbidden('Forbidden: You do not manage this shelter');
      if (f.direction === 'incoming') where.toShelterId = f.shelterId;
      else if (f.direction === 'outgoing') where.fromShelterId = f.shelterId;
      else where.OR = [{ fromShelterId: f.shelterId }, { toShelterId: f.shelterId }];
    } else {
      const scope = managed === null ? undefined : managed;
      if (f.direction === 'incoming') where.toShelterId = scope ? { in: scope } : undefined;
      else if (f.direction === 'outgoing') where.fromShelterId = scope ? { in: scope } : undefined;
      else if (scope) where.OR = [{ fromShelterId: { in: scope } }, { toShelterId: { in: scope } }];
    }
    const rows = await prisma.transfer.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 500 });
    return decorate(user, rows);
  }

  static async get(user: AuthUser, id: string) {
    const t = await loadScoped(user, id);
    return (await decorate(user, [t]))[0];
  }

  static async approve(user: AuthUser, id: string) {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw notFound('Transfer not found');
      if (t.requestedById === user.id) throw forbidden('Forbidden: you cannot approve a transfer you requested');
      if (t.status !== 'PENDING') throw badRequest('Transfer is not pending');

      // Guarded deduction first: if stock is short, nothing else happens (whole tx rolls back).
      const resource = await tx.resource.findFirst({ where: { shelterId: t.fromShelterId, resourceType: t.resourceType } });
      if (!resource) throw badRequest('Insufficient resource quantity at source shelter');
      const dec = await tx.resource.updateMany({
        where: { id: resource.id, quantity: { gte: t.quantity } },
        data: { quantity: { decrement: t.quantity } },
      });
      if (dec.count !== 1) throw badRequest('Insufficient resource quantity at source shelter');

      await guardedStatus(tx, id, ['PENDING'], { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() }, 'Transfer is no longer pending');

      const after = await tx.resource.findUniqueOrThrow({ where: { id: resource.id } });
      await tx.stockMovement.create({
        data: { resourceId: resource.id, shelterId: t.fromShelterId, type: 'TRANSFER_OUT', delta: -t.quantity, quantityAfter: after.quantity, note: 'Transfer approved', userId: user.id, referenceId: id },
      });
      await audit(tx, { userId: user.id, action: 'TRANSFER_APPROVE', entity: 'Transfer', entityId: id, metadata: { quantity: t.quantity, resourceType: t.resourceType } });
      await AlertService.evaluateShelter(tx, t.fromShelterId);
    });
    return this.get(user, id);
  }

  static async reject(user: AuthUser, id: string, reason?: string) {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw notFound('Transfer not found');
      if (t.status !== 'PENDING') throw badRequest('Only pending transfers can be rejected');
      await guardedStatus(tx, id, ['PENDING'], { status: 'REJECTED', approvedById: user.id, rejectionReason: reason ?? null }, 'Transfer is no longer pending');
      await audit(tx, { userId: user.id, action: 'TRANSFER_REJECT', entity: 'Transfer', entityId: id, metadata: { reason: reason ?? null } });
      // Pending quantity is released, which can change "available"; re-check both ends.
      await AlertService.evaluateShelter(tx, t.toShelterId);
    });
    return this.get(user, id);
  }

  static async markInTransit(user: AuthUser, id: string) {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw notFound('Transfer not found');
      if (!(await canManageShelter(user, t.fromShelterId, tx))) throw forbidden('Forbidden: only the source shelter can dispatch');
      if (t.status !== 'APPROVED') throw badRequest('Transfer must be approved first');
      await guardedStatus(tx, id, ['APPROVED'], { status: 'IN_TRANSIT', shippedAt: new Date() }, 'Transfer is not approved');
      await audit(tx, { userId: user.id, action: 'TRANSFER_TRANSIT', entity: 'Transfer', entityId: id });
    });
    return this.get(user, id);
  }

  static async receive(user: AuthUser, id: string) {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw notFound('Transfer not found');
      if (!(await canManageShelter(user, t.toShelterId, tx))) throw forbidden('Forbidden: only the destination shelter can confirm receipt');
      if (t.status !== 'IN_TRANSIT') throw badRequest('Transfer not in a receivable state');

      await guardedStatus(tx, id, ['IN_TRANSIT'], { status: 'RECEIVED', receivedAt: new Date(), receivedById: user.id }, 'Transfer was already received');

      let dest = await tx.resource.findFirst({ where: { shelterId: t.toShelterId, resourceType: t.resourceType } });
      if (!dest) {
        const src = await tx.resource.findFirst({ where: { shelterId: t.fromShelterId, resourceType: t.resourceType } });
        dest = await tx.resource.create({
          data: { shelterId: t.toShelterId, resourceType: t.resourceType, quantity: 0, unit: src?.unit ?? 'units' },
        });
      } else if (!dest.isActive) {
        dest = await tx.resource.update({ where: { id: dest.id }, data: { isActive: true } });
      }
      const updated = await tx.resource.update({ where: { id: dest.id }, data: { quantity: { increment: t.quantity } } });
      await tx.stockMovement.create({
        data: { resourceId: dest.id, shelterId: t.toShelterId, type: 'TRANSFER_IN', delta: t.quantity, quantityAfter: updated.quantity, note: 'Transfer received', userId: user.id, referenceId: id },
      });
      await audit(tx, { userId: user.id, action: 'TRANSFER_RECEIVE', entity: 'Transfer', entityId: id, metadata: { quantity: t.quantity } });
      await AlertService.evaluateShelter(tx, t.toShelterId);
    });
    return this.get(user, id);
  }

  static async cancel(user: AuthUser, id: string, reason?: string) {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw notFound('Transfer not found');
      const isAdmin = user.role === 'ADMIN';
      if (t.status === 'RECEIVED') throw badRequest('Received transfers cannot be cancelled');
      if (t.status === 'REJECTED' || t.status === 'CANCELLED') throw conflict('Transfer is already closed');
      if (t.status === 'PENDING') {
        if (!isAdmin && t.requestedById !== user.id) throw forbidden('Forbidden: only the requester or an administrator can cancel');
      } else if (!isAdmin) {
        throw forbidden('Forbidden: only an administrator can cancel an approved transfer');
      }

      const wasDeducted = t.status === 'APPROVED' || t.status === 'IN_TRANSIT';
      await guardedStatus(
        tx,
        id,
        ['PENDING', 'APPROVED', 'IN_TRANSIT'],
        { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id, rejectionReason: reason ?? null },
        'Transfer is no longer cancellable'
      );

      if (wasDeducted) {
        const src = await tx.resource.findFirst({ where: { shelterId: t.fromShelterId, resourceType: t.resourceType } });
        if (!src) throw conflict('Source resource no longer exists');
        const updated = await tx.resource.update({ where: { id: src.id }, data: { quantity: { increment: t.quantity }, isActive: true } });
        await tx.stockMovement.create({
          data: { resourceId: src.id, shelterId: t.fromShelterId, type: 'TRANSFER_RETURN', delta: t.quantity, quantityAfter: updated.quantity, note: 'Transfer cancelled — stock restored', userId: user.id, referenceId: id },
        });
        await AlertService.evaluateShelter(tx, t.fromShelterId);
      }
      await audit(tx, { userId: user.id, action: 'TRANSFER_CANCEL', entity: 'Transfer', entityId: id, metadata: { restored: wasDeducted, reason: reason ?? null } });
    });
    return this.get(user, id);
  }
}
