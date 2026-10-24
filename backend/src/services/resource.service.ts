import { Prisma, ResourceType } from '@prisma/client';
import prisma from '../config/prisma';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { stockStatus } from '../utils/stockStatus';
import { assertShelterAccess, canManageShelter } from '../utils/access';
import type { AuthUser } from '../middleware/auth.middleware';
import { log as audit } from './audit.service';
import { AlertService } from './alert.service';

type ResourceRow = Prisma.ResourceGetPayload<object>;

const withStatus = (r: ResourceRow) => ({ ...r, stockStatus: stockStatus(r.quantity, r.lowStockThreshold) });

export class ResourceService {
  /** Public view: type + status + unit only. Staff who manage the shelter get the full record. */
  static async list(user: AuthUser | undefined, shelterId: string) {
    const shelter = await prisma.shelter.findUnique({ where: { id: shelterId }, select: { id: true } });
    if (!shelter) throw notFound('Shelter not found');
    const staff = await canManageShelter(user, shelterId);
    const rows = await prisma.resource.findMany({
      where: staff ? { shelterId } : { shelterId, isActive: true },
      orderBy: { resourceType: 'asc' },
    });
    if (staff) return rows.map(withStatus);
    return rows.map((r) => ({
      resourceType: r.resourceType,
      stockStatus: stockStatus(r.quantity, r.lowStockThreshold),
      unit: r.unit,
    }));
  }

  static async create(
    user: AuthUser,
    shelterId: string,
    d: { resourceType: ResourceType; quantity: number; unit: string; lowStockThreshold?: number; note?: string }
  ) {
    await assertShelterAccess(user, shelterId);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.resource.findUnique({
        where: { shelterId_resourceType: { shelterId, resourceType: d.resourceType } },
      });
      let resource: ResourceRow;
      let before = 0;
      if (existing) {
        if (existing.isActive) throw conflict('This resource already exists for the shelter');
        before = existing.quantity;
        resource = await tx.resource.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            quantity: d.quantity,
            unit: d.unit,
            ...(d.lowStockThreshold !== undefined ? { lowStockThreshold: d.lowStockThreshold } : {}),
          },
        });
      } else {
        resource = await tx.resource.create({
          data: {
            shelterId,
            resourceType: d.resourceType,
            quantity: d.quantity,
            unit: d.unit,
            ...(d.lowStockThreshold !== undefined ? { lowStockThreshold: d.lowStockThreshold } : {}),
          },
        });
      }
      await tx.stockMovement.create({
        data: {
          resourceId: resource.id,
          shelterId,
          type: 'SET',
          delta: d.quantity - before,
          quantityAfter: resource.quantity,
          note: d.note ?? (existing ? 'Resource reactivated' : 'Resource created'),
          userId: user.id,
        },
      });
      await audit(tx, {
        userId: user.id,
        action: existing ? 'RESOURCE_REACTIVATE' : 'RESOURCE_CREATE',
        entity: 'Resource',
        entityId: resource.id,
        metadata: { shelterId, resourceType: d.resourceType, quantity: resource.quantity },
      });
      await AlertService.evaluateShelter(tx, shelterId);
      return withStatus(resource);
    });
  }

  static async update(
    user: AuthUser,
    shelterId: string,
    resourceId: string,
    d: {
      quantity?: number;
      delta?: number;
      lowStockThreshold?: number;
      unit?: string;
      isActive?: boolean;
      note?: string;
    }
  ) {
    await assertShelterAccess(user, shelterId);
    return prisma.$transaction(async (tx) => {
      const current = await tx.resource.findFirst({ where: { id: resourceId, shelterId } });
      if (!current) throw notFound('Resource not found for this shelter');

      let movement: { type: 'SET' | 'ADJUSTMENT'; delta: number } | null = null;

      if (d.quantity !== undefined) {
        const res = await tx.resource.updateMany({
          where: { id: resourceId, shelterId, quantity: current.quantity },
          data: { quantity: d.quantity },
        });
        if (res.count !== 1) throw conflict('Resource was modified concurrently, please retry');
        movement = { type: 'SET', delta: d.quantity - current.quantity };
      } else if (d.delta !== undefined) {
        const res = await tx.resource.updateMany({
          where: { id: resourceId, shelterId, quantity: { gte: d.delta < 0 ? -d.delta : 0 } },
          data: { quantity: { increment: d.delta } },
        });
        if (res.count !== 1) throw badRequest('Resulting quantity cannot be negative');
        movement = { type: 'ADJUSTMENT', delta: d.delta };
      }

      const meta: Prisma.ResourceUpdateInput = {};
      if (d.lowStockThreshold !== undefined) meta.lowStockThreshold = d.lowStockThreshold;
      if (d.unit !== undefined) meta.unit = d.unit;
      if (d.isActive !== undefined) meta.isActive = d.isActive;
      if (Object.keys(meta).length) await tx.resource.update({ where: { id: resourceId }, data: meta });

      const updated = await tx.resource.findUniqueOrThrow({ where: { id: resourceId } });

      if (movement) {
        await tx.stockMovement.create({
          data: {
            resourceId,
            shelterId,
            type: movement.type,
            delta: movement.delta,
            quantityAfter: updated.quantity,
            note: d.note ?? null,
            userId: user.id,
          },
        });
      }
      await audit(tx, {
        userId: user.id,
        action: 'RESOURCE_UPDATE',
        entity: 'Resource',
        entityId: resourceId,
        metadata: {
          shelterId,
          resourceType: current.resourceType,
          before: { quantity: current.quantity, lowStockThreshold: current.lowStockThreshold, unit: current.unit, isActive: current.isActive },
          after: { quantity: updated.quantity, lowStockThreshold: updated.lowStockThreshold, unit: updated.unit, isActive: updated.isActive },
          note: d.note ?? null,
        },
      });
      await AlertService.evaluateShelter(tx, shelterId);
      return withStatus(updated);
    });
  }

  static async movements(user: AuthUser, shelterId: string, f: { resourceId?: string; limit: number }) {
    await assertShelterAccess(user, shelterId);
    const rows = await prisma.stockMovement.findMany({
      where: { shelterId, ...(f.resourceId ? { resourceId: f.resourceId } : {}) },
      include: {
        resource: { select: { resourceType: true, unit: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: f.limit,
    });
    return rows;
  }
}
