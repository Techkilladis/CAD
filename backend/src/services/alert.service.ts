import { Prisma, AlertType, AlertSeverity, ResourceType, AlertStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { getNotificationPublisher } from '../integrations/NotificationPublisher';
import { getSettings } from './settings.service';
import { stockStatus } from '../utils/stockStatus';
import { assertShelterAccess } from '../utils/access';
import type { AuthUser } from '../middleware/auth.middleware';
import { HttpError } from '../utils/httpError';
import { log as auditLog } from './audit.service';

type Tx = Prisma.TransactionClient;

interface Condition {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  resourceType?: ResourceType;
}

/** Alert types owned by evaluateShelter. TRANSFER_REQUIRED is evaluated separately (Phase B). */
const ENGINE_TYPES: AlertType[] = ['OVERCROWDING', 'FULL_SHELTER', 'LOW_STOCK', 'CRITICAL_MEDICAL_NEED'];
const OPEN_STATUSES: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED'];

export class AlertService {
  /**
   * The ONLY place alerts are created or auto-resolved. Computes the set of current conditions for a shelter,
   * creates alerts that are not already open (deduped on dedupeKey), and resolves open alerts whose condition cleared.
   * Also toggles shelter status ACTIVE <-> FULL based on occupancy.
   */
  static async evaluateShelter(tx: Tx, shelterId: string, opts: { toggleStatus?: boolean } = {}): Promise<{ created: number; resolved: number }> {
    const shelter = await tx.shelter.findUnique({
      where: { id: shelterId },
      include: { resources: true },
    });
    if (!shelter) return { created: 0, resolved: 0 };

    const settings = await getSettings(tx);
    const conditions = new Map<string, Condition>();
    const operational = shelter.status === 'ACTIVE' || shelter.status === 'FULL';

    if (operational && shelter.capacityTotal > 0) {
      const ratio = shelter.capacityOccupied / shelter.capacityTotal;
      const pct = Math.round(ratio * 100);

      if (ratio >= 1) {
        conditions.set(`FULL_SHELTER:${shelterId}`, {
          type: 'FULL_SHELTER',
          severity: 'CRITICAL',
          message: `${shelter.name} is full (${shelter.capacityOccupied}/${shelter.capacityTotal}).`,
        });
      } else if (ratio >= settings.overcrowdingThreshold) {
        conditions.set(`OVERCROWDING:${shelterId}`, {
          type: 'OVERCROWDING',
          severity: 'WARNING',
          message: `${shelter.name} is at ${pct}% capacity (${shelter.capacityOccupied}/${shelter.capacityTotal}).`,
        });
      }

      // Status toggling FULL <-> ACTIVE
      if (opts.toggleStatus === false) {
        // caller explicitly set the status; leave it alone
      } else if (ratio >= 1 && shelter.status === 'ACTIVE') {
        await tx.shelter.update({ where: { id: shelterId }, data: { status: 'FULL' } });
      } else if (ratio < 1 && shelter.status === 'FULL') {
        await tx.shelter.update({ where: { id: shelterId }, data: { status: 'ACTIVE' } });
      }
    }

    if (operational) {
      for (const r of shelter.resources) {
        if (!r.isActive) continue;
        const st = stockStatus(r.quantity, r.lowStockThreshold);
        if (st === 'HEALTHY') continue;
        conditions.set(`LOW_STOCK:${shelterId}:${r.resourceType}`, {
          type: 'LOW_STOCK',
          severity: st === 'LOW' ? 'WARNING' : 'CRITICAL',
          resourceType: r.resourceType,
          message: `${r.resourceType} is ${st.toLowerCase()} at ${shelter.name}: ${r.quantity} ${r.unit} left (threshold ${r.lowStockThreshold}).`,
        });
      }

      const occupants = await tx.checkin.findMany({
        where: { shelterId, status: 'CONFIRMED', priority: { in: ['HIGH', 'CRITICAL'] } },
        select: { priority: true },
      });
      const criticalCases = occupants.filter((o) => o.priority === 'CRITICAL').length;
      if (criticalCases > 0) {
        conditions.set(`CRITICAL_MEDICAL_NEED:${shelterId}`, {
          type: 'CRITICAL_MEDICAL_NEED',
          severity: 'CRITICAL',
          message: `${criticalCases} occupant group(s) with critical medical needs at ${shelter.name}.`,
        });
      } else if (occupants.length >= settings.criticalMedicalCount) {
        conditions.set(`CRITICAL_MEDICAL_NEED:${shelterId}`, {
          type: 'CRITICAL_MEDICAL_NEED',
          severity: 'WARNING',
          message: `${occupants.length} occupant groups with high medical needs at ${shelter.name}.`,
        });
      }
    }

    const open = await tx.alertLog.findMany({
      where: { shelterId, status: { in: OPEN_STATUSES }, alertType: { in: ENGINE_TYPES } },
    });
    const openByKey = new Map(open.map((a) => [a.dedupeKey, a]));

    let created = 0;
    let resolved = 0;

    for (const [dedupeKey, c] of conditions) {
      const existing = openByKey.get(dedupeKey);
      if (existing) {
        if (existing.message !== c.message || existing.severity !== c.severity) {
          await tx.alertLog.update({ where: { id: existing.id }, data: { message: c.message, severity: c.severity } });
        }
        continue;
      }
      const channel = await getNotificationPublisher().publish({
        type: c.type,
        shelterId,
        severity: c.severity,
        message: c.message,
        dedupeKey,
      });
      await tx.alertLog.create({
        data: {
          shelterId,
          alertType: c.type,
          severity: c.severity,
          message: c.message,
          resourceType: c.resourceType ?? null,
          dedupeKey,
          notifiedVia: channel,
        },
      });
      created++;
    }

    for (const a of open) {
      if (!conditions.has(a.dedupeKey)) {
        await tx.alertLog.update({
          where: { id: a.id },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
        });
        resolved++;
      }
    }

    return { created, resolved };
  }

  static async runGlobalCheck(): Promise<{ scanned: number; created: number; resolved: number }> {
    const shelters = await prisma.shelter.findMany({ select: { id: true } });
    let created = 0;
    let resolved = 0;
    for (const s of shelters) {
      const r = await prisma.$transaction((tx) => AlertService.evaluateShelter(tx, s.id));
      created += r.created;
      resolved += r.resolved;
    }
    return { scanned: shelters.length, created, resolved };
  }

  static async acknowledgeAlert(alertId: string, user?: AuthUser) {
    return prisma.$transaction(async (tx) => {
      const alert = await tx.alertLog.findUnique({ where: { id: alertId } });
      if (!alert) throw new HttpError(404, 'Alert not found');
      if (user) await assertShelterAccess(user, alert.shelterId, tx);
      const res = await tx.alertLog.updateMany({
        where: { id: alertId, status: 'ACTIVE' },
        data: { acknowledged: true, status: 'ACKNOWLEDGED', acknowledgedById: user?.id ?? null, acknowledgedAt: new Date() },
      });
      if (res.count !== 1) throw new HttpError(409, 'Alert is not active');
      await auditLog(tx, { userId: user?.id, action: 'ALERT_ACKNOWLEDGE', entity: 'AlertLog', entityId: alertId });
      return tx.alertLog.findUniqueOrThrow({ where: { id: alertId } });
    });
  }

  static async resolveAlert(alertId: string, user?: AuthUser) {
    return prisma.$transaction(async (tx) => {
      const alert = await tx.alertLog.findUnique({ where: { id: alertId } });
      if (!alert) throw new HttpError(404, 'Alert not found');
      if (user) await assertShelterAccess(user, alert.shelterId, tx);
      const res = await tx.alertLog.updateMany({
        where: { id: alertId, status: { in: OPEN_STATUSES } },
        data: { status: 'RESOLVED', resolvedById: user?.id ?? null, resolvedAt: new Date() },
      });
      if (res.count !== 1) throw new HttpError(409, 'Alert is already resolved');
      await auditLog(tx, { userId: user?.id, action: 'ALERT_RESOLVE', entity: 'AlertLog', entityId: alertId });
      return tx.alertLog.findUniqueOrThrow({ where: { id: alertId } });
    });
  }
}
