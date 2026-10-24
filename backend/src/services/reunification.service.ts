import { Prisma, ReunificationStatus } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { getManagedShelterIds } from '../utils/access';
import { badRequest, notFound } from '../utils/httpError';
import { log as audit } from './audit.service';

export interface ReportInput {
  missingPersonName: string;
  age?: number | null;
  gender?: string | null;
  lastKnownLocation?: string | null;
  lastKnownShelterId?: string | null;
  contactPerson: string;
  contactInfo: string;
  description?: string | null;
}

const caseInclude = {
  lastKnownShelter: { select: { id: true, name: true } },
  matchedCheckin: {
    select: { id: true, personName: true, familySize: true, shelterId: true, status: true, shelter: { select: { id: true, name: true } } },
  },
  reportedBy: { select: { id: true, name: true } },
} satisfies Prisma.ReunificationCaseInclude;

/** Words of 2+ letters from a name, lower-cased, used for fuzzy candidate matching. */
const tokens = (name: string) =>
  name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);

export class ReunificationService {
  /**
   * Public report. The response never reveals whether anyone with that name is sheltered:
   * status is always MISSING here; staff link candidate matches and advance the status.
   */
  static async report(user: AuthUser | undefined, d: ReportInput) {
    if (d.lastKnownShelterId) {
      const s = await prisma.shelter.findUnique({ where: { id: d.lastKnownShelterId }, select: { id: true } });
      if (!s) throw badRequest('Unknown shelter');
    }
    return prisma.$transaction(async (tx) => {
      const c = await tx.reunificationCase.create({
        data: {
          missingPersonName: d.missingPersonName,
          age: d.age ?? null,
          gender: d.gender ?? null,
          lastKnownLocation: d.lastKnownLocation ?? null,
          lastKnownShelterId: d.lastKnownShelterId ?? null,
          contactPerson: d.contactPerson,
          contactInfo: d.contactInfo,
          description: d.description ?? null,
          status: 'MISSING',
          reportedById: user?.id ?? null,
        },
      });
      await audit(tx, {
        userId: user?.id ?? null,
        action: 'REUNIFICATION_REPORT',
        entity: 'ReunificationCase',
        entityId: c.id,
        metadata: { name: d.missingPersonName },
      });
      return { id: c.id, status: c.status, message: 'Report received. Shelter staff will search their records and contact you.' };
    });
  }

  /** Public, privacy-limited search over reported cases: name, age, status and shelter name only. No contacts, notes or occupant data. */
  static async publicSearch(q: string) {
    const rows = await prisma.reunificationCase.findMany({
      where: { missingPersonName: { contains: q, mode: 'insensitive' } },
      select: { id: true, missingPersonName: true, age: true, status: true, lastKnownShelter: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      missingPersonName: r.missingPersonName,
      age: r.age,
      status: r.status,
      lastKnownShelterName: r.lastKnownShelter?.name ?? null,
    }));
  }

  /** Staff list with candidate check-in matches limited to shelters the user manages. */
  static async list(user: AuthUser, f: { q?: string; status?: ReunificationStatus }) {
    const where: Prisma.ReunificationCaseWhereInput = {};
    if (f.status) where.status = f.status;
    if (f.q) where.OR = [{ missingPersonName: { contains: f.q, mode: 'insensitive' } }, { contactPerson: { contains: f.q, mode: 'insensitive' } }];
    const cases = await prisma.reunificationCase.findMany({ where, include: caseInclude, orderBy: { createdAt: 'desc' }, take: 300 });

    const managed = await getManagedShelterIds(user);
    const isOpen = (c: { status: ReunificationStatus }) => c.status === 'MISSING' || c.status === 'POTENTIAL_MATCH';
    const wanted = Array.from(new Set(cases.filter(isOpen).flatMap((c) => tokens(c.missingPersonName))));
    const pool =
      wanted.length === 0
        ? []
        : await prisma.checkin.findMany({
            where: {
              status: 'CONFIRMED',
              ...(managed === null ? {} : { shelterId: { in: managed } }),
              OR: wanted.map((t) => ({ personName: { contains: t, mode: 'insensitive' as const } })),
            },
            select: { id: true, personName: true, familySize: true, shelterId: true, shelter: { select: { id: true, name: true } } },
          });

    return cases.map((c) => {
      const tk = tokens(c.missingPersonName);
      const candidates = isOpen(c)
        ? pool
            .map((p) => ({ p, score: tk.filter((t) => p.personName.toLowerCase().includes(t)).length }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((x) => ({ id: x.p.id, personName: x.p.personName, familySize: x.p.familySize, shelter: x.p.shelter, score: x.score }))
        : [];
      return { ...c, candidates };
    });
  }

  static async update(user: AuthUser, id: string, d: { status?: ReunificationStatus; staffNotes?: string | null; matchedCheckinId?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.reunificationCase.findUnique({ where: { id } });
      if (!existing) throw notFound('Case not found');

      if (d.matchedCheckinId) {
        const c = await tx.checkin.findUnique({ where: { id: d.matchedCheckinId } });
        if (!c) throw badRequest('Matched check-in not found');
        const managed = await getManagedShelterIds(user, tx);
        if (managed !== null && !managed.includes(c.shelterId)) throw badRequest('You can only link occupants of shelters you manage');
      }
      const nextStatus = d.status ?? existing.status;
      const nextMatch = d.matchedCheckinId === undefined ? existing.matchedCheckinId : d.matchedCheckinId;
      if (nextStatus === 'POTENTIAL_MATCH' && !nextMatch) throw badRequest('Link a matching occupant before marking a potential match');
      if (nextStatus === 'REUNITED' && !nextMatch && !(d.staffNotes ?? existing.staffNotes)) {
        throw badRequest('Add a note or link an occupant to explain how the reunification happened');
      }

      const data: Prisma.ReunificationCaseUncheckedUpdateInput = {};
      if (d.status) data.status = d.status;
      if (d.staffNotes !== undefined) data.staffNotes = d.staffNotes;
      if (d.matchedCheckinId !== undefined) data.matchedCheckinId = d.matchedCheckinId;
      // Linking an occupant to an open case automatically makes it a potential match.
      if (d.matchedCheckinId && !d.status && existing.status === 'MISSING') data.status = 'POTENTIAL_MATCH';
      await tx.reunificationCase.update({ where: { id }, data });
      await audit(tx, {
        userId: user.id,
        action: 'REUNIFICATION_UPDATE',
        entity: 'ReunificationCase',
        entityId: id,
        metadata: { from: existing.status, to: (data.status as string | undefined) ?? existing.status, matchedCheckinId: nextMatch ?? null },
      });
      return tx.reunificationCase.findUniqueOrThrow({ where: { id }, include: caseInclude });
    });
  }
}
