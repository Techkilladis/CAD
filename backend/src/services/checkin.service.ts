import { Prisma, CheckinStatus, MedicalPriority, CheckinSource } from '@prisma/client';
import prisma from '../config/prisma';
import { HttpError, badRequest, conflict, notFound } from '../utils/httpError';
import { computeMedicalPriority } from '../utils/medicalPriority';
import { assertShelterAccess } from '../utils/access';
import type { AuthUser } from '../middleware/auth.middleware';
import { log as audit } from './audit.service';
import { AlertService } from './alert.service';

type Tx = Prisma.TransactionClient;

export interface OccupantInput {
  personName: string;
  familySize: number;
  phone?: string | null;
  medicalFlag?: boolean;
  criticalMedical?: boolean;
  elderlyCount?: number;
  pregnantFlag?: boolean;
  disabledFlag?: boolean;
  childrenCount?: number;
  emergencyNotes?: string | null;
  medicalNotes?: string | null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeReferenceCode = () => {
  let out = 'SH-';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
};

const occupantData = (d: OccupantInput) => ({
  personName: d.personName,
  familySize: d.familySize,
  phone: d.phone ?? null,
  medicalFlag: d.medicalFlag ?? false,
  criticalMedical: d.criticalMedical ?? false,
  elderlyCount: d.elderlyCount ?? 0,
  pregnantFlag: d.pregnantFlag ?? false,
  disabledFlag: d.disabledFlag ?? false,
  childrenCount: d.childrenCount ?? 0,
  emergencyNotes: d.emergencyNotes ?? null,
  medicalNotes: d.medicalNotes ?? null,
  priority: computeMedicalPriority(d),
});

function assertOpen(status: string) {
  if (status === 'INACTIVE' || status === 'EMERGENCY_CLOSED') {
    throw badRequest(`Shelter is not accepting check-ins (status: ${status})`);
  }
}

/**
 * Atomically reserves `size` beds. The WHERE clause is the guard: if capacity would be exceeded
 * (or the shelter closed meanwhile) no row matches and we throw, rolling back the whole transaction.
 */
async function reserveCapacity(tx: Tx, shelterId: string, size: number, errorMessage: string) {
  const shelter = await tx.shelter.findUnique({ where: { id: shelterId } });
  if (!shelter) throw notFound('Shelter not found');
  assertOpen(shelter.status);
  const res = await tx.shelter.updateMany({
    where: {
      id: shelterId,
      status: { in: ['ACTIVE', 'FULL'] },
      capacityTotal: shelter.capacityTotal,
      capacityOccupied: { lte: shelter.capacityTotal - size },
    },
    data: { capacityOccupied: { increment: size } },
  });
  if (res.count !== 1) throw badRequest(errorMessage);
  return shelter;
}

export class CheckinService {
  /** Public family registration: creates a PENDING record; occupancy is untouched until confirmed. */
  static async register(shelterId: string, input: OccupantInput) {
    const shelter = await prisma.shelter.findUnique({ where: { id: shelterId } });
    if (!shelter) throw notFound('Shelter not found');
    assertOpen(shelter.status);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const fresh = await tx.shelter.findUniqueOrThrow({ where: { id: shelterId } });
          assertOpen(fresh.status);
          if (fresh.capacityTotal - fresh.capacityOccupied < input.familySize) {
            throw badRequest('Insufficient capacity for this registration');
          }
          const referenceCode = makeReferenceCode();
          const c = await tx.checkin.create({
            data: {
              shelterId,
              ...occupantData({ ...input, criticalMedical: false }),
              status: 'PENDING',
              source: 'PUBLIC_REGISTRATION',
              referenceCode,
            },
          });
          await audit(tx, {
            userId: null,
            action: 'CHECKIN_REGISTER',
            entity: 'Checkin',
            entityId: c.id,
            metadata: { shelterId, referenceCode, familySize: c.familySize },
          });
          return {
            referenceCode,
            status: c.status,
            shelterId,
            shelterName: fresh.name,
            familySize: c.familySize,
            message: 'Show this code at the shelter to complete check-in.',
          };
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // code collision
        throw e;
      }
    }
    throw new HttpError(500, 'Could not generate a reference code, please try again');
  }

  /** Coordinator/admin direct check-in. Idempotent on clientRequestId. */
  static async checkIn(
    user: AuthUser,
    shelterId: string,
    input: OccupantInput & { clientRequestId?: string; source?: CheckinSource }
  ): Promise<{ duplicate: boolean; checkin: Awaited<ReturnType<typeof prisma.checkin.create>> }> {
    await assertShelterAccess(user, shelterId);

    const findDuplicate = async () => {
      if (!input.clientRequestId) return null;
      const existing = await prisma.checkin.findUnique({ where: { clientRequestId: input.clientRequestId } });
      if (existing && existing.shelterId !== shelterId) {
        throw conflict('clientRequestId already used for a different shelter');
      }
      return existing;
    };

    const dup = await findDuplicate();
    if (dup) return { duplicate: true, checkin: dup };

    try {
      const checkin = await prisma.$transaction(async (tx) => {
        await reserveCapacity(tx, shelterId, input.familySize, 'Insufficient capacity');
        const c = await tx.checkin.create({
          data: {
            shelterId,
            ...occupantData(input),
            status: 'CONFIRMED',
            source: input.source ?? (input.clientRequestId ? 'OFFLINE_SYNC' : 'COORDINATOR'),
            clientRequestId: input.clientRequestId ?? null,
            checkedInById: user.id,
            confirmedAt: new Date(),
          },
        });
        await audit(tx, {
          userId: user.id,
          action: 'CHECKIN',
          entity: 'Checkin',
          entityId: c.id,
          metadata: { shelterId, familySize: c.familySize, priority: c.priority, source: c.source },
        });
        await AlertService.evaluateShelter(tx, shelterId);
        return c;
      });
      return { duplicate: false, checkin };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && input.clientRequestId) {
        const again = await findDuplicate();
        if (again) return { duplicate: true, checkin: again };
      }
      throw e;
    }
  }

  static async confirm(user: AuthUser, shelterId: string, checkinId: string) {
    await assertShelterAccess(user, shelterId);
    return prisma.$transaction(async (tx) => {
      const checkin = await tx.checkin.findUnique({ where: { id: checkinId } });
      if (!checkin || checkin.shelterId !== shelterId) throw notFound('Check-in not found');

      const flip = await tx.checkin.updateMany({
        where: { id: checkinId, shelterId, status: 'PENDING' },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), checkedInById: user.id },
      });
      if (flip.count !== 1) throw conflict('Check-in is not pending');

      await reserveCapacity(tx, shelterId, checkin.familySize, 'Insufficient capacity to confirm');
      await audit(tx, {
        userId: user.id,
        action: 'CHECKIN_CONFIRM',
        entity: 'Checkin',
        entityId: checkinId,
        metadata: { shelterId, familySize: checkin.familySize, referenceCode: checkin.referenceCode },
      });
      await AlertService.evaluateShelter(tx, shelterId);
      return tx.checkin.findUniqueOrThrow({ where: { id: checkinId } });
    });
  }

  static async reject(user: AuthUser, shelterId: string, checkinId: string, reason?: string) {
    await assertShelterAccess(user, shelterId);
    return prisma.$transaction(async (tx) => {
      const checkin = await tx.checkin.findUnique({ where: { id: checkinId } });
      if (!checkin || checkin.shelterId !== shelterId) throw notFound('Check-in not found');
      const res = await tx.checkin.updateMany({
        where: { id: checkinId, shelterId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (res.count !== 1) throw conflict('Check-in is not pending');
      await audit(tx, {
        userId: user.id,
        action: 'CHECKIN_REJECT',
        entity: 'Checkin',
        entityId: checkinId,
        metadata: { shelterId, reason: reason ?? null, referenceCode: checkin.referenceCode },
      });
      return tx.checkin.findUniqueOrThrow({ where: { id: checkinId } });
    });
  }

  /** Checkout releases the STORED familySize (never trusts the client). */
  static async checkOut(user: AuthUser, shelterId: string, checkinId: string) {
    await assertShelterAccess(user, shelterId);
    return prisma.$transaction(async (tx) => {
      const shelter = await tx.shelter.findUnique({ where: { id: shelterId } });
      if (!shelter) throw notFound('Shelter not found');
      assertOpen(shelter.status);

      const checkin = await tx.checkin.findUnique({ where: { id: checkinId } });
      if (!checkin || checkin.shelterId !== shelterId) throw notFound('Check-in not found');

      const flip = await tx.checkin.updateMany({
        where: { id: checkinId, shelterId, status: 'CONFIRMED' },
        data: { status: 'CHECKED_OUT', checkedOutAt: new Date(), checkedOutById: user.id },
      });
      if (flip.count !== 1) {
        throw conflict(checkin.status === 'CHECKED_OUT' ? 'Check-in is already checked out' : 'Only confirmed check-ins can be checked out');
      }

      const dec = await tx.shelter.updateMany({
        where: { id: shelterId, capacityOccupied: { gte: checkin.familySize } },
        data: { capacityOccupied: { decrement: checkin.familySize } },
      });
      if (dec.count !== 1) throw conflict('Occupancy cannot become negative');

      await audit(tx, {
        userId: user.id,
        action: 'CHECKOUT',
        entity: 'Checkin',
        entityId: checkinId,
        metadata: { shelterId, familySize: checkin.familySize },
      });
      await AlertService.evaluateShelter(tx, shelterId);
      return tx.checkin.findUniqueOrThrow({ where: { id: checkinId } });
    });
  }

  static async list(
    user: AuthUser,
    shelterId: string,
    f: { status?: CheckinStatus; priority?: MedicalPriority; q?: string; limit: number }
  ) {
    await assertShelterAccess(user, shelterId);
    const where: Prisma.CheckinWhereInput = { shelterId };
    if (f.status) where.status = f.status;
    if (f.priority) where.priority = f.priority;
    if (f.q) {
      where.OR = [
        { personName: { contains: f.q, mode: 'insensitive' } },
        { phone: { contains: f.q } },
        { referenceCode: { contains: f.q, mode: 'insensitive' } },
      ];
    }
    return prisma.checkin.findMany({ where, orderBy: { createdAt: 'desc' }, take: f.limit });
  }
}
