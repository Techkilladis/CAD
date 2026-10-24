import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { forbidden, notFound } from './httpError';

type Db = Prisma.TransactionClient | typeof prisma;

/** Shelter ids the user may manage. `null` means "all shelters" (admin). Volunteers/anonymous manage none. */
export async function getManagedShelterIds(user: AuthUser | undefined, db: Db = prisma): Promise<string[] | null> {
  if (!user) return [];
  if (user.role === 'ADMIN') return null;
  if (user.role === 'COORDINATOR') {
    const shelters = await db.shelter.findMany({ where: { coordinatorId: user.id }, select: { id: true } });
    return shelters.map((s) => s.id);
  }
  return [];
}

/** Throws 404 if the shelter does not exist, 403 if the user may not manage it. Returns the shelter. */
export async function assertShelterAccess(user: AuthUser | undefined, shelterId: string, db: Db = prisma) {
  const shelter = await db.shelter.findUnique({ where: { id: shelterId } });
  if (!shelter) throw notFound('Shelter not found');
  if (!user) throw forbidden('Forbidden: You do not manage this shelter');
  if (user.role === 'ADMIN') return shelter;
  if (user.role === 'COORDINATOR' && shelter.coordinatorId === user.id) return shelter;
  throw forbidden('Forbidden: You do not manage this shelter');
}

/** Prisma `where` fragment restricting a Shelter query to what the user may manage. */
export function scopeShelterFilter(user: AuthUser | undefined): Prisma.ShelterWhereInput {
  if (user?.role === 'ADMIN') return {};
  if (user?.role === 'COORDINATOR') return { coordinatorId: user.id };
  return { id: { in: [] } };
}

/** True when the user may manage the shelter (no throw, no 404 distinction). */
export async function canManageShelter(user: AuthUser | undefined, shelterId: string, db: Db = prisma): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'COORDINATOR') return false;
  const s = await db.shelter.findFirst({ where: { id: shelterId, coordinatorId: user.id }, select: { id: true } });
  return !!s;
}
