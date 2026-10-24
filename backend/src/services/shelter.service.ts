import { Prisma, ShelterStatus, ResourceType } from '@prisma/client';
import prisma from '../config/prisma';
import { calculateDistance } from '../utils/haversine';
import { stockStatus } from '../utils/stockStatus';
import { PRIORITY_ORDER } from '../utils/medicalPriority';
import { assertShelterAccess, scopeShelterFilter } from '../utils/access';
import { HttpError, badRequest, forbidden, notFound } from '../utils/httpError';
import type { AuthUser } from '../middleware/auth.middleware';
import { log as audit } from './audit.service';
import { AlertService } from './alert.service';
import { COORDINATOR_EDITABLE_FIELDS } from '../schemas/shelter.schemas';

type Tx = Prisma.TransactionClient;

const publicInclude = {
  resources: { where: { isActive: true } },
  translations: true,
} satisfies Prisma.ShelterInclude;

type PublicShelterRow = Prisma.ShelterGetPayload<{ include: typeof publicInclude }>;

const available = (s: { capacityTotal: number; capacityOccupied: number }) => Math.max(0, s.capacityTotal - s.capacityOccupied);
const pct = (s: { capacityTotal: number; capacityOccupied: number }) =>
  s.capacityTotal > 0 ? Math.round((s.capacityOccupied / s.capacityTotal) * 100) : 0;

/** Public-safe projection: no occupant data, resources only as type + stock status + unit. */
function toPublic(s: PublicShelterRow, distanceKm?: number, lang?: string) {
  const languages = Array.from(new Set(['en', ...s.translations.map((t) => t.locale)]));
  const tr = lang ? s.translations.find((t) => t.locale === lang) : undefined;
  return {
    translation: tr ? { name: tr.name, description: tr.description, instructions: tr.instructions } : null,
    id: s.id,
    name: s.name,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    capacityTotal: s.capacityTotal,
    capacityOccupied: s.capacityOccupied,
    availableCapacity: available(s),
    occupancyPercent: pct(s),
    status: s.status,
    description: s.description,
    contactInfo: s.contactInfo,
    contactPhone: s.contactPhone,
    contactEmail: s.contactEmail,
    medicalSupport: s.medicalSupport,
    languages,
    resources: s.resources.map((r) => ({
      resourceType: r.resourceType,
      stockStatus: stockStatus(r.quantity, r.lowStockThreshold),
      unit: r.unit,
    })),
    ...(distanceKm !== undefined ? { distance: distanceKm } : {}),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

async function assertValidCoordinator(tx: Tx, coordinatorId: string | null | undefined) {
  if (!coordinatorId) return;
  const u = await tx.user.findUnique({ where: { id: coordinatorId } });
  if (!u || u.role !== 'COORDINATOR' || !u.isActive) {
    throw badRequest('coordinatorId must reference an active user with the COORDINATOR role');
  }
}

export class ShelterService {
  // ---------- Public ----------

  static async listPublic(f: {
    q?: string;
    minAvailable?: number;
    resource?: ResourceType;
    status?: ShelterStatus;
    includeInactive?: boolean;
    lang?: string;
  }) {
    const where: Prisma.ShelterWhereInput = {};
    if (f.status) where.status = f.status;
    else if (!f.includeInactive) where.status = { not: 'INACTIVE' };
    if (f.q) {
      where.OR = [
        { name: { contains: f.q, mode: 'insensitive' } },
        { address: { contains: f.q, mode: 'insensitive' } },
        { translations: { some: { name: { contains: f.q, mode: 'insensitive' } } } },
      ];
    }
    if (f.resource) {
      where.resources = { some: { resourceType: f.resource, isActive: true, quantity: { gt: 0 } } };
    }
    const rows = await prisma.shelter.findMany({ where, include: publicInclude, orderBy: { name: 'asc' } });
    return rows.filter((s) => f.minAvailable === undefined || available(s) >= f.minAvailable).map((s) => toPublic(s, undefined, f.lang));
  }

  static async nearest(f: { latitude: number; longitude: number; onlyAvailable?: boolean; limit: number; lang?: string }) {
    const where: Prisma.ShelterWhereInput = f.onlyAvailable ? { status: 'ACTIVE' } : { status: { not: 'INACTIVE' } };
    const rows = await prisma.shelter.findMany({ where, include: publicInclude });
    return rows
      .filter((s) => !f.onlyAvailable || available(s) > 0)
      .map((s) => ({ s, d: calculateDistance(f.latitude, f.longitude, s.latitude, s.longitude) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, f.limit)
      .map(({ s, d }) => toPublic(s, round1(d), f.lang));
  }

  static async getPublic(id: string, lang?: string, from?: { latitude?: number; longitude?: number }) {
    const s = await prisma.shelter.findUnique({
      where: { id },
      include: { resources: { where: { isActive: true } }, translations: true },
    });
    if (!s) throw notFound('Shelter not found');
    const base = toPublic(s);
    const wanted = lang ? s.translations.find((t) => t.locale === lang) : undefined;
    const fallback = s.translations.find((t) => t.locale === 'en');
    const tr = wanted ?? fallback ?? null;
    const distance =
      from?.latitude !== undefined && from?.longitude !== undefined
        ? round1(calculateDistance(from.latitude, from.longitude, s.latitude, s.longitude))
        : undefined;
    return {
      ...base,
      ...(distance !== undefined ? { distance } : {}),
      translationLocale: tr?.locale ?? null,
      translation: tr ? { name: tr.name, description: tr.description, instructions: tr.instructions } : null,
    };
  }

  static async publicStats() {
    const shelters = await prisma.shelter.findMany({
      where: { status: { in: ['ACTIVE', 'FULL'] } },
      select: { capacityTotal: true, capacityOccupied: true },
    });
    const totalCapacity = shelters.reduce((a, s) => a + s.capacityTotal, 0);
    const totalOccupied = shelters.reduce((a, s) => a + s.capacityOccupied, 0);
    return {
      openShelters: shelters.length,
      totalCapacity,
      totalOccupied,
      availableCapacity: Math.max(0, totalCapacity - totalOccupied),
      sheltersWithSpace: shelters.filter((s) => available(s) > 0).length,
      asOf: new Date().toISOString(),
    };
  }

  // ---------- Staff ----------

  static async listManaged(user: AuthUser) {
    const rows = await prisma.shelter.findMany({
      where: scopeShelterFilter(user),
      include: { coordinator: { select: { id: true, name: true } }, translations: { select: { locale: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((s) => ({
      ...s,
      languages: s.translations.map((t) => t.locale),
      availableCapacity: available(s),
      occupancyPercent: pct(s),
    }));
  }

  /** Staff view of a single shelter's editable fields + translations. */
  static async getStaffDetail(user: AuthUser, id: string) {
    await assertShelterAccess(user, id);
    const s = await prisma.shelter.findUniqueOrThrow({
      where: { id },
      include: { coordinator: { select: { id: true, name: true } }, translations: true },
    });
    return { ...s, availableCapacity: available(s), occupancyPercent: pct(s) };
  }

  static async overview(user: AuthUser, id: string) {
    await assertShelterAccess(user, id);
    const now = new Date();
    const s = await prisma.shelter.findUniqueOrThrow({
      where: { id },
      include: {
        coordinator: { select: { id: true, name: true } },
        resources: { orderBy: { resourceType: 'asc' } },
        checkins: { where: { status: 'CONFIRMED' }, orderBy: { checkedInAt: 'desc' } },
        alerts: { where: { status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } }, orderBy: { triggeredAt: 'desc' } },
        translations: true,
      },
    });
    const [incoming, outgoing, shifts, donations, pending] = await Promise.all([
      prisma.transfer.findMany({
        where: { toShelterId: id, status: { in: ['PENDING', 'APPROVED', 'IN_TRANSIT'] } },
        include: { fromShelter: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transfer.findMany({
        where: { fromShelterId: id, status: { in: ['PENDING', 'APPROVED', 'IN_TRANSIT'] } },
        include: { toShelter: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.volunteerShift.findMany({
        where: { shelterId: id, endTime: { gte: now } },
        include: { assignments: { include: { volunteer: { select: { id: true, name: true, phone: true } } } } },
        orderBy: { startTime: 'asc' },
        take: 50,
      }),
      prisma.donation.findMany({ where: { shelterId: id }, orderBy: { receivedDate: 'desc' }, take: 20 }),
      prisma.checkin.count({ where: { shelterId: id, status: 'PENDING' } }),
    ]);

    const occupants = s.checkins;
    const medicalOccupants = occupants
      .filter((c) => c.priority !== 'NONE')
      .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
    const resources = s.resources.map((r) => ({ ...r, stockStatus: stockStatus(r.quantity, r.lowStockThreshold) }));

    return {
      shelter: {
        id: s.id,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        status: s.status,
        description: s.description,
        contactInfo: s.contactInfo,
        contactPhone: s.contactPhone,
        contactEmail: s.contactEmail,
        medicalSupport: s.medicalSupport,
        coordinator: s.coordinator,
        translations: s.translations,
      },
      capacity: {
        total: s.capacityTotal,
        occupied: s.capacityOccupied,
        available: available(s),
        percent: pct(s),
      },
      asOf: now.toISOString(),
      pendingRegistrations: pending,
      activeOccupants: occupants,
      medicalOccupants,
      medicalCounts: {
        critical: occupants.filter((c) => c.priority === 'CRITICAL').length,
        high: occupants.filter((c) => c.priority === 'HIGH').length,
        medium: occupants.filter((c) => c.priority === 'MEDIUM').length,
        low: occupants.filter((c) => c.priority === 'LOW').length,
        pregnant: occupants.filter((c) => c.pregnantFlag).length,
        disabled: occupants.filter((c) => c.disabledFlag).length,
        elderly: occupants.reduce((a, c) => a + c.elderlyCount, 0),
        children: occupants.reduce((a, c) => a + c.childrenCount, 0),
      },
      resources,
      alerts: s.alerts,
      incomingTransfers: incoming,
      outgoingTransfers: outgoing,
      shifts,
      donations,
    };
  }

  static async create(user: AuthUser, data: Prisma.ShelterUncheckedCreateInput) {
    return prisma.$transaction(async (tx) => {
      await assertValidCoordinator(tx, data.coordinatorId);
      const shelter = await tx.shelter.create({ data });
      await audit(tx, {
        userId: user.id,
        action: 'SHELTER_CREATE',
        entity: 'Shelter',
        entityId: shelter.id,
        metadata: { name: shelter.name, capacityTotal: shelter.capacityTotal, coordinatorId: shelter.coordinatorId },
      });
      return shelter;
    });
  }

  static async update(user: AuthUser, id: string, data: Prisma.ShelterUncheckedUpdateInput & Record<string, unknown>) {
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    return prisma.$transaction(async (tx) => {
      const shelter = await assertShelterAccess(user, id, tx);

      if (user.role !== 'ADMIN') {
        const bad = keys.filter((k) => !COORDINATOR_EDITABLE_FIELDS.includes(k));
        if (bad.length) throw forbidden(`Coordinators cannot edit: ${bad.join(', ')}`);
        if (data.status !== undefined) {
          if (data.status !== 'ACTIVE' && data.status !== 'FULL') {
            throw forbidden('Coordinators may only switch status between ACTIVE and FULL');
          }
          if (shelter.status !== 'ACTIVE' && shelter.status !== 'FULL') {
            throw forbidden('Only an administrator can change the status of a closed or inactive shelter');
          }
        }
      } else if (data.coordinatorId !== undefined) {
        await assertValidCoordinator(tx, data.coordinatorId as string | null);
      }

      if (typeof data.capacityTotal === 'number' && data.capacityTotal < shelter.capacityOccupied) {
        throw badRequest(`Capacity cannot be lower than current occupancy (${shelter.capacityOccupied})`);
      }

      const updated = await tx.shelter.update({ where: { id }, data: data as Prisma.ShelterUncheckedUpdateInput });
      await audit(tx, {
        userId: user.id,
        action: 'SHELTER_UPDATE',
        entity: 'Shelter',
        entityId: id,
        metadata: { fields: keys, changes: Object.fromEntries(keys.map((k) => [k, data[k]])) },
      });
      await AlertService.evaluateShelter(tx, id, { toggleStatus: data.status === undefined });
      return tx.shelter.findUniqueOrThrow({ where: { id } }).then((r) => r ?? updated);
    });
  }

  static async setStatus(user: AuthUser, id: string, status: ShelterStatus, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const shelter = await tx.shelter.findUnique({ where: { id } });
      if (!shelter) throw notFound('Shelter not found');
      const updated = await tx.shelter.update({ where: { id }, data: { status } });
      await audit(tx, {
        userId: user.id,
        action: 'SHELTER_STATUS_CHANGE',
        entity: 'Shelter',
        entityId: id,
        metadata: { from: shelter.status, to: status, reason: reason ?? null },
      });
      await AlertService.evaluateShelter(tx, id, { toggleStatus: false });
      return updated;
    });
  }

  static async upsertTranslation(
    user: AuthUser,
    id: string,
    locale: string,
    data: { name?: string | null; description?: string | null; instructions?: string | null }
  ) {
    return prisma.$transaction(async (tx) => {
      await assertShelterAccess(user, id, tx);
      const clean = {
        name: data.name ?? null,
        description: data.description ?? null,
        instructions: data.instructions ?? null,
      };
      const tr = await tx.shelterTranslation.upsert({
        where: { shelterId_locale: { shelterId: id, locale } },
        create: { shelterId: id, locale, ...clean },
        update: clean,
      });
      await audit(tx, {
        userId: user.id,
        action: 'SHELTER_TRANSLATION_UPSERT',
        entity: 'Shelter',
        entityId: id,
        metadata: { locale },
      });
      return tr;
    });
  }
}

export { HttpError };
