import { Prisma, Role } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { log as audit } from './audit.service';

const userSelect = {
  id: true, name: true, email: true, phone: true, role: true, isActive: true, skills: true, languages: true, createdAt: true,
} satisfies Prisma.UserSelect;

export class AdminService {
  // ---------- Audit ----------
  static async listAudit(f: { entity?: string; userId?: string; action?: string; page: number; pageSize: number }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (f.entity) where.entity = f.entity;
    if (f.userId) where.userId = f.userId;
    if (f.action) where.action = { contains: f.action, mode: 'insensitive' };
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { timestamp: 'desc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
    ]);
    return { items: rows, total, page: f.page, pageSize: f.pageSize, pages: Math.max(1, Math.ceil(total / f.pageSize)) };
  }

  static async auditFacets() {
    const [entities, actions] = await Promise.all([
      prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } }),
      prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    ]);
    return { entities: entities.map((e) => e.entity), actions: actions.map((a) => a.action) };
  }

  // ---------- Users ----------
  static async listUsers() {
    const users = await prisma.user.findMany({ select: { ...userSelect, shelters: { select: { id: true, name: true } } }, orderBy: [{ role: 'asc' }, { name: 'asc' }] });
    return users;
  }

  static async createUser(actor: AuthUser, d: { name: string; email: string; role: Role; phone?: string | null; skills?: string | null; languages?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const exists = await tx.user.findUnique({ where: { email: d.email } });
      if (exists) throw conflict('A user with this email already exists');
      const u = await tx.user.create({ data: { name: d.name, email: d.email, role: d.role, phone: d.phone ?? null, skills: d.skills ?? null, languages: d.languages ?? null }, select: userSelect });
      await audit(tx, { userId: actor.id, action: 'USER_CREATE', entity: 'User', entityId: u.id, metadata: { role: u.role, email: u.email } });
      return u;
    });
  }

  static async updateUser(
    actor: AuthUser,
    id: string,
    d: { name?: string; email?: string; role?: Role; isActive?: boolean; phone?: string | null; skills?: string | null; languages?: string | null }
  ) {
    return prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id }, include: { shelters: { select: { id: true, name: true } } } });
      if (!u) throw notFound('User not found');

      const losingAdmin = u.role === 'ADMIN' && ((d.role && d.role !== 'ADMIN') || d.isActive === false);
      if (losingAdmin) {
        if (id === actor.id) throw badRequest('You cannot demote or deactivate your own administrator account');
        const others = await tx.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: id } } });
        if (others === 0) throw badRequest('At least one active administrator is required');
      }
      const leavingCoordinator = u.role === 'COORDINATOR' && ((d.role && d.role !== 'COORDINATOR') || d.isActive === false);
      if (leavingCoordinator && u.shelters.length > 0) {
        throw conflict(`Reassign ${u.shelters.map((s) => s.name).join(', ')} to another coordinator first`);
      }
      if (d.email && d.email !== u.email) {
        const dup = await tx.user.findUnique({ where: { email: d.email } });
        if (dup) throw conflict('A user with this email already exists');
      }

      const updated = await tx.user.update({ where: { id }, data: d, select: userSelect });
      await audit(tx, { userId: actor.id, action: 'USER_UPDATE', entity: 'User', entityId: id, metadata: { changes: d } as unknown as Record<string, unknown> });
      return updated;
    });
  }
}
