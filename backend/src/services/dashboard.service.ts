import { Prisma, ResourceType } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { scopeShelterFilter } from '../utils/access';
import { forbidden } from '../utils/httpError';
import { stockStatus, StockStatus } from '../utils/stockStatus';
import { getSettings } from './settings.service';

export type OccupancyClass = 'AVAILABLE' | 'CRITICAL' | 'FULL' | 'INACTIVE';

const RESOURCE_TYPES: ResourceType[] = ['FOOD', 'WATER', 'MEDICINE', 'BLANKETS'];

/** Admin: all shelters (optionally one). Coordinator: auto-scoped to managed shelters. Others: 403. */
function scopedWhere(user: AuthUser, shelterId?: string): Prisma.ShelterWhereInput {
  if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') throw forbidden('Forbidden: Insufficient role');
  const scope = scopeShelterFilter(user);
  return shelterId ? { AND: [scope, { id: shelterId }] } : scope;
}

export class DashboardService {
  /** Legacy admin overview (kept for compatibility). */
  static async adminOverview() {
    const shelters = await prisma.shelter.findMany();
    const totalShelters = shelters.length;
    const totalCapacity = shelters.reduce((acc, s) => acc + s.capacityTotal, 0);
    const totalOccupied = shelters.reduce((acc, s) => acc + s.capacityOccupied, 0);
    const totalAvailableCapacity = totalCapacity - totalOccupied;
    const overcrowdedShelters = shelters.filter((s) => s.capacityTotal > 0 && s.capacityOccupied / s.capacityTotal >= 0.9);

    const allAlerts = await prisma.alertLog.findMany({
      where: { status: 'ACTIVE' },
      include: { shelter: true },
      orderBy: { triggeredAt: 'desc' },
    });
    const pendingTransfers = await prisma.transfer.findMany({
      where: { status: 'PENDING' },
      include: { fromShelter: true, toShelter: true, requestedBy: true },
    });
    const inTransitTransfers = await prisma.transfer.findMany({
      where: { status: 'IN_TRANSIT' },
      include: { fromShelter: true, toShelter: true, requestedBy: true },
    });
    const resources = await prisma.resource.findMany();
    const resourceSummary = resources.reduce((acc: Record<string, number>, r) => {
      acc[r.resourceType] = (acc[r.resourceType] || 0) + r.quantity;
      return acc;
    }, {});
    const reunificationCases = await prisma.reunificationCase.findMany({ orderBy: { createdAt: 'desc' } });

    return {
      shelters,
      totalShelters,
      totalCapacity,
      totalOccupied,
      totalAvailableCapacity,
      overcrowdedShelters,
      allAlerts,
      pendingTransfers,
      inTransitTransfers,
      resourceSummary,
      reunificationCases,
    };
  }

  static async district(user: AuthUser, shelterId?: string) {
    const where = scopedWhere(user, shelterId);
    const settings = await getSettings();
    const rows = await prisma.shelter.findMany({ where, orderBy: { name: 'asc' } });

    const shelters = rows.map((s) => {
      const percent = s.capacityTotal > 0 ? Math.round((s.capacityOccupied / s.capacityTotal) * 100) : 0;
      const ratio = s.capacityTotal > 0 ? s.capacityOccupied / s.capacityTotal : 0;
      let classification: OccupancyClass = 'AVAILABLE';
      if (s.status === 'INACTIVE' || s.status === 'EMERGENCY_CLOSED') classification = 'INACTIVE';
      else if (ratio >= 1 || s.status === 'FULL') classification = 'FULL';
      else if (ratio >= settings.overcrowdingThreshold) classification = 'CRITICAL';
      return {
        id: s.id,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        status: s.status,
        capacityTotal: s.capacityTotal,
        capacityOccupied: s.capacityOccupied,
        available: Math.max(0, s.capacityTotal - s.capacityOccupied),
        occupancyPercent: percent,
        classification,
      };
    });

    const operational = shelters.filter((s) => s.classification !== 'INACTIVE');
    const totalCapacity = operational.reduce((a, s) => a + s.capacityTotal, 0);
    const totalOccupied = operational.reduce((a, s) => a + s.capacityOccupied, 0);

    return {
      asOf: new Date().toISOString(),
      totals: {
        shelters: shelters.length,
        operationalShelters: operational.length,
        totalCapacity,
        totalOccupied,
        totalAvailable: Math.max(0, totalCapacity - totalOccupied),
        occupancyPercent: totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0,
        criticalShelters: shelters.filter((s) => s.classification === 'CRITICAL').length,
        fullShelters: shelters.filter((s) => s.classification === 'FULL').length,
      },
      shelters,
      critical: shelters.filter((s) => s.classification === 'CRITICAL'),
      full: shelters.filter((s) => s.classification === 'FULL'),
    };
  }

  /** District medical view: priority counts per shelter plus the case list. Staff only (scoped); volunteers get 403. */
  static async medical(user: AuthUser, shelterId?: string) {
    const where = scopedWhere(user, shelterId);
    const shelters = await prisma.shelter.findMany({
      where: { AND: [where, { status: { not: 'INACTIVE' } }] },
      select: { id: true, name: true, medicalSupport: true, status: true },
      orderBy: { name: 'asc' },
    });
    const cases = await prisma.checkin.findMany({
      where: { shelterId: { in: shelters.map((s) => s.id) }, status: 'CONFIRMED', priority: { not: 'NONE' } },
    });
    const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 } as const;
    cases.sort((a, b) => rank[b.priority] - rank[a.priority] || b.checkedInAt.getTime() - a.checkedInAt.getTime());
    const count = (rows: typeof cases) => ({
      critical: rows.filter((c) => c.priority === 'CRITICAL').length,
      high: rows.filter((c) => c.priority === 'HIGH').length,
      medium: rows.filter((c) => c.priority === 'MEDIUM').length,
      low: rows.filter((c) => c.priority === 'LOW').length,
      pregnant: rows.filter((c) => c.pregnantFlag).length,
      disabled: rows.filter((c) => c.disabledFlag).length,
      elderly: rows.reduce((a, c) => a + c.elderlyCount, 0),
      children: rows.reduce((a, c) => a + c.childrenCount, 0),
    });
    const nameOf = new Map(shelters.map((s) => [s.id, s.name]));
    return {
      asOf: new Date().toISOString(),
      totals: count(cases),
      perShelter: shelters.map((s) => ({ ...s, counts: count(cases.filter((c) => c.shelterId === s.id)) })),
      cases: cases.map((c) => ({ ...c, shelterName: nameOf.get(c.shelterId) ?? '' })),
    };
  }

  /** Upcoming shift coverage per shelter. */
  static async volunteers(user: AuthUser, shelterId?: string) {
    const where = scopedWhere(user, shelterId);
    const shelters = await prisma.shelter.findMany({ where: { AND: [where, { status: { not: 'INACTIVE' } }] }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const shifts = await prisma.volunteerShift.findMany({
      where: { shelterId: { in: shelters.map((s) => s.id) }, status: 'OPEN', endTime: { gte: new Date() } },
      include: { _count: { select: { assignments: true } } },
    });
    const perShelter = shelters.map((s) => {
      const mine = shifts.filter((x) => x.shelterId === s.id);
      const required = mine.reduce((a, x) => a + x.requiredCount, 0);
      const filled = mine.reduce((a, x) => a + Math.min(x._count.assignments, x.requiredCount), 0);
      return { shelterId: s.id, shelterName: s.name, shifts: mine.length, required, filled, coveragePercent: required > 0 ? Math.round((filled / required) * 100) : null };
    });
    const required = perShelter.reduce((a, s) => a + s.required, 0);
    const filled = perShelter.reduce((a, s) => a + s.filled, 0);
    return {
      asOf: new Date().toISOString(),
      totals: { shifts: shifts.length, required, filled, unfilled: required - filled, coveragePercent: required > 0 ? Math.round((filled / required) * 100) : null },
      perShelter,
    };
  }

  /** Donation totals by resource type and status. */
  static async donations(user: AuthUser, shelterId?: string) {
    const where = scopedWhere(user, shelterId);
    const shelters = await prisma.shelter.findMany({ where, select: { id: true } });
    const rows = await prisma.donation.groupBy({
      by: ['resourceType', 'status'],
      where: { shelterId: { in: shelters.map((s) => s.id) } },
      _sum: { quantity: true },
      _count: { _all: true },
    });
    return {
      asOf: new Date().toISOString(),
      rows: rows.map((r) => ({ resourceType: r.resourceType, status: r.status, quantity: r._sum.quantity ?? 0, count: r._count._all })),
    };
  }

  /** One aggregate payload for the reports pages (admin: whole district, coordinator: own shelters). */
  static async reports(user: AuthUser, shelterId?: string) {
    const [district, resources, medical, volunteers, donations] = await Promise.all([
      DashboardService.district(user, shelterId),
      DashboardService.resources(user, shelterId),
      DashboardService.medical(user, shelterId),
      DashboardService.volunteers(user, shelterId),
      DashboardService.donations(user, shelterId),
    ]);
    const shelterIds = (await prisma.shelter.findMany({ where: scopedWhere(user, shelterId), select: { id: true } })).map((s) => s.id);
    const involved = { OR: [{ fromShelterId: { in: shelterIds } }, { toShelterId: { in: shelterIds } }] };
    const [transfers, alerts, cases, checkins] = await Promise.all([
      prisma.transfer.groupBy({ by: ['status'], where: involved, _count: { _all: true } }),
      prisma.alertLog.groupBy({ by: ['alertType', 'status'], where: { shelterId: { in: shelterIds } }, _count: { _all: true } }),
      user.role === 'ADMIN' ? prisma.reunificationCase.groupBy({ by: ['status'], _count: { _all: true } }) : Promise.resolve(null),
      prisma.checkin.groupBy({ by: ['status'], where: { shelterId: { in: shelterIds } }, _count: { _all: true }, _sum: { familySize: true } }),
    ]);
    return {
      asOf: new Date().toISOString(),
      occupancy: district,
      resources,
      medical: { totals: medical.totals, perShelter: medical.perShelter },
      volunteers,
      donations: donations.rows,
      transfersByStatus: transfers.map((t) => ({ status: t.status, count: t._count._all })),
      alerts: alerts.map((a) => ({ alertType: a.alertType, status: a.status, count: a._count._all })),
      reunification: cases ? cases.map((c) => ({ status: c.status, count: c._count._all })) : null,
      checkins: checkins.map((c) => ({ status: c.status, count: c._count._all, people: c._sum.familySize ?? 0 })),
    };
  }

  static async resources(user: AuthUser, shelterId?: string) {
    const shelterWhere = scopedWhere(user, shelterId);
    const shelters = await prisma.shelter.findMany({
      where: { AND: [shelterWhere, { status: { not: 'INACTIVE' } }] },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });
    const resources = await prisma.resource.findMany({
      where: { shelterId: { in: shelters.map((s) => s.id) }, isActive: true },
    });
    const nameOf = new Map(shelters.map((s) => [s.id, s.name]));

    const types = RESOURCE_TYPES.map((resourceType) => {
      const rows = resources.filter((r) => r.resourceType === resourceType);
      const perShelter = rows
        .map((r) => ({
          resourceId: r.id,
          shelterId: r.shelterId,
          shelterName: nameOf.get(r.shelterId) ?? '',
          quantity: r.quantity,
          unit: r.unit,
          lowStockThreshold: r.lowStockThreshold,
          stockStatus: stockStatus(r.quantity, r.lowStockThreshold) as StockStatus,
        }))
        .sort((a, b) => a.shelterName.localeCompare(b.shelterName));
      const count = (st: StockStatus) => perShelter.filter((p) => p.stockStatus === st).length;
      return {
        resourceType,
        unit: rows[0]?.unit ?? null,
        total: rows.reduce((a, r) => a + r.quantity, 0),
        shelters: perShelter,
        lowCount: count('LOW'),
        criticalCount: count('CRITICAL'),
        emptyCount: count('EMPTY'),
      };
    });

    return { asOf: new Date().toISOString(), shelters, types };
  }
}
