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
