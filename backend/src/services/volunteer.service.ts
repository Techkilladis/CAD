import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { assertShelterAccess, canManageShelter, getManagedShelterIds } from '../utils/access';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { log as audit } from './audit.service';

type Tx = Prisma.TransactionClient;

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && aEnd > bStart;

/** Shift as returned to a viewer. Volunteers see counts and their own signup; staff also see who signed up. */
function shape(
  shift: Prisma.VolunteerShiftGetPayload<{ include: { shelter: { select: { id: true; name: true } }; assignments: { include: { volunteer: { select: { id: true; name: true; phone: true; skills: true } } } } } }>,
  viewer: AuthUser,
  staffCanSee: boolean
) {
  const filled = shift.assignments.length;
  const now = new Date();
  return {
    id: shift.id,
    shelterId: shift.shelterId,
    shelter: shift.shelter,
    title: shift.title,
    task: shift.task,
    notes: shift.notes,
    startTime: shift.startTime,
    endTime: shift.endTime,
    requiredCount: shift.requiredCount,
    status: shift.status,
    filledCount: filled,
    openSlots: Math.max(0, shift.requiredCount - filled),
    isFull: filled >= shift.requiredCount,
    hasStarted: shift.startTime <= now,
    signedUp: shift.assignments.some((a) => a.volunteerId === viewer.id),
    assignments: staffCanSee ? shift.assignments.map((a) => ({ id: a.id, volunteer: a.volunteer })) : undefined,
  };
}

const shiftInclude = {
  shelter: { select: { id: true, name: true } },
  assignments: { include: { volunteer: { select: { id: true, name: true, phone: true, skills: true } } } },
} satisfies Prisma.VolunteerShiftInclude;

export class VolunteerService {
  static async listVolunteers() {
    return prisma.user.findMany({
      where: { role: 'VOLUNTEER', isActive: true },
      select: { id: true, name: true, phone: true, skills: true, languages: true },
      orderBy: { name: 'asc' },
    });
  }

  static async listShifts(user: AuthUser, f: { shelterId?: string; upcoming?: boolean }) {
    const where: Prisma.VolunteerShiftWhereInput = {};
    if (f.shelterId) where.shelterId = f.shelterId;
    if (f.upcoming) where.endTime = { gte: new Date() };
    const staff = user.role === 'ADMIN' || user.role === 'COORDINATOR';
    if (!staff) where.status = 'OPEN'; // volunteers never see cancelled shifts
    let managed: string[] | null = null;
    if (user.role === 'COORDINATOR') {
      managed = (await getManagedShelterIds(user)) ?? [];
    }
    const rows = await prisma.volunteerShift.findMany({ where, include: shiftInclude, orderBy: { startTime: 'asc' }, take: 500 });
    return rows.map((s) => shape(s, user, user.role === 'ADMIN' || (managed?.includes(s.shelterId) ?? false)));
  }

  static async myShifts(user: AuthUser) {
    const rows = await prisma.volunteerShift.findMany({
      where: { assignments: { some: { volunteerId: user.id } } },
      include: shiftInclude,
      orderBy: { startTime: 'asc' },
    });
    return rows.map((s) => shape(s, user, false));
  }

  static async createShift(
    user: AuthUser,
    d: { shelterId: string; title: string; task?: string | null; notes?: string | null; startTime: string; endTime: string; requiredCount: number }
  ) {
    await assertShelterAccess(user, d.shelterId);
    const start = new Date(d.startTime);
    const end = new Date(d.endTime);
    if (start >= end) throw badRequest('End time must be after start time');
    if (end <= new Date()) throw badRequest('Shift must end in the future');
    return prisma.$transaction(async (tx) => {
      const shift = await tx.volunteerShift.create({
        data: { shelterId: d.shelterId, title: d.title, task: d.task ?? null, notes: d.notes ?? null, startTime: start, endTime: end, requiredCount: d.requiredCount, createdById: user.id },
      });
      await audit(tx, { userId: user.id, action: 'SHIFT_CREATE', entity: 'VolunteerShift', entityId: shift.id, metadata: { shelterId: d.shelterId, title: d.title, requiredCount: d.requiredCount } });
      return shift;
    });
  }

  static async updateShift(
    user: AuthUser,
    shiftId: string,
    d: { title?: string; task?: string | null; notes?: string | null; startTime?: string; endTime?: string; requiredCount?: number; status?: 'OPEN' | 'CANCELLED' }
  ) {
    return prisma.$transaction(async (tx) => {
      const shift = await tx.volunteerShift.findUnique({ where: { id: shiftId }, include: { assignments: true } });
      if (!shift) throw notFound('Shift not found');
      await assertShelterAccess(user, shift.shelterId, tx);
      if (shift.status === 'CANCELLED') throw conflict('Shift is cancelled and can no longer be edited');

      const start = d.startTime ? new Date(d.startTime) : shift.startTime;
      const end = d.endTime ? new Date(d.endTime) : shift.endTime;
      if (start >= end) throw badRequest('End time must be after start time');
      const required = d.requiredCount ?? shift.requiredCount;
      if (required < shift.assignments.length) {
        throw badRequest(`Required count cannot be lower than the ${shift.assignments.length} volunteers already signed up`);
      }

      if (d.startTime || d.endTime) {
        for (const a of shift.assignments) {
          const others = await tx.volunteerAssignment.findMany({ where: { volunteerId: a.volunteerId, shiftId: { not: shiftId }, shift: { status: 'OPEN' } }, include: { shift: true } });
          if (others.some((o) => overlaps(start, end, o.shift.startTime, o.shift.endTime))) {
            throw conflict('New times clash with another shift of a signed-up volunteer');
          }
        }
      }

      const data: Prisma.VolunteerShiftUncheckedUpdateInput = {};
      if (d.title !== undefined) data.title = d.title;
      if (d.task !== undefined) data.task = d.task;
      if (d.notes !== undefined) data.notes = d.notes;
      if (d.startTime) data.startTime = start;
      if (d.endTime) data.endTime = end;
      if (d.requiredCount !== undefined) data.requiredCount = d.requiredCount;
      if (d.status) data.status = d.status;
      const updated = await tx.volunteerShift.update({ where: { id: shiftId }, data });
      await audit(tx, {
        userId: user.id,
        action: d.status === 'CANCELLED' ? 'SHIFT_CANCEL' : 'SHIFT_UPDATE',
        entity: 'VolunteerShift',
        entityId: shiftId,
        metadata: { fields: Object.keys(d), affectedVolunteers: d.status === 'CANCELLED' ? shift.assignments.length : 0 },
      });
      return updated;
    });
  }

  /** Row lock on the shift serialises concurrent sign-ups, so capacity can never be exceeded. */
  static async signUp(user: AuthUser, shiftId: string) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "VolunteerShift" WHERE id = ${shiftId} FOR UPDATE`;
      if (locked.length === 0) throw notFound('Shift not found');
      const shift = await tx.volunteerShift.findUniqueOrThrow({ where: { id: shiftId }, include: { assignments: true } });

      if (shift.status !== 'OPEN') throw badRequest('Shift is cancelled');
      if (shift.startTime <= new Date()) throw badRequest('Shift has already started');
      if (shift.assignments.some((a) => a.volunteerId === user.id)) throw badRequest('Already signed up for this shift');
      if (shift.assignments.length >= shift.requiredCount) throw badRequest('Shift is already full');

      const mine = await tx.volunteerAssignment.findMany({ where: { volunteerId: user.id, shift: { status: 'OPEN' } }, include: { shift: true } });
      if (mine.some((a) => overlaps(shift.startTime, shift.endTime, a.shift.startTime, a.shift.endTime))) {
        throw badRequest('Time conflict with an existing shift');
      }

      const assignment = await tx.volunteerAssignment.create({ data: { shiftId, volunteerId: user.id } });
      await audit(tx, { userId: user.id, action: 'SHIFT_SIGNUP', entity: 'VolunteerShift', entityId: shiftId });
      return assignment;
    });
  }

  static async cancelSignup(user: AuthUser, shiftId: string) {
    return prisma.$transaction(async (tx) => {
      const shift = await tx.volunteerShift.findUnique({ where: { id: shiftId } });
      if (!shift) throw notFound('Shift not found');
      if (shift.startTime <= new Date()) throw badRequest('Shift has already started and can no longer be cancelled');
      const res = await tx.volunteerAssignment.deleteMany({ where: { shiftId, volunteerId: user.id } });
      if (res.count !== 1) throw badRequest('Assignment not found');
      await audit(tx, { userId: user.id, action: 'SHIFT_SIGNUP_CANCEL', entity: 'VolunteerShift', entityId: shiftId });
      return { success: true };
    });
  }

  /** Staff may remove a volunteer from a shift they manage. */
  static async removeVolunteer(user: AuthUser, shiftId: string, volunteerId: string) {
    return prisma.$transaction(async (tx) => {
      const shift = await tx.volunteerShift.findUnique({ where: { id: shiftId } });
      if (!shift) throw notFound('Shift not found');
      if (!(await canManageShelter(user, shift.shelterId, tx))) throw forbidden('Forbidden: You do not manage this shelter');
      const res = await tx.volunteerAssignment.deleteMany({ where: { shiftId, volunteerId } });
      if (res.count !== 1) throw notFound('Assignment not found');
      await audit(tx, { userId: user.id, action: 'SHIFT_VOLUNTEER_REMOVE', entity: 'VolunteerShift', entityId: shiftId, metadata: { volunteerId } });
      return { success: true };
    });
  }
}

export type { Tx };
