import request from 'supertest';
import app from '../server';
import prisma from '../config/prisma';
import { Role, ResourceType } from '@prisma/client';

let seq = 0;
const uid = () => `${Date.now()}-${++seq}`;

/** Truncates every table (test DB only). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (!tables.length) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export const makeUser = (role: Role, name = `${role} ${uid()}`, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { name, email: `${uid()}@test.local`, role, ...extra } });

export const makeShelter = (
  coordinatorId: string | null,
  overrides: Partial<{ name: string; capacityTotal: number; capacityOccupied: number; status: any; latitude: number; longitude: number }> = {}
) =>
  prisma.shelter.create({
    data: {
      name: overrides.name ?? `Shelter ${uid()}`,
      address: '1 Test Street',
      latitude: overrides.latitude ?? 13.0,
      longitude: overrides.longitude ?? 80.2,
      capacityTotal: overrides.capacityTotal ?? 100,
      capacityOccupied: overrides.capacityOccupied ?? 0,
      status: overrides.status ?? 'ACTIVE',
      coordinatorId,
    },
  });

export const makeResource = (shelterId: string, resourceType: ResourceType, quantity: number, lowStockThreshold = 20) =>
  prisma.resource.create({ data: { shelterId, resourceType, quantity, unit: 'units', lowStockThreshold } });

/** Request helper: `as(user)` sets x-user-id, `as()` is anonymous. */
export const as = (user?: { id: string }) => {
  const set = (r: request.Test) => (user ? r.set('x-user-id', user.id) : r);
  return {
    get: (url: string) => set(request(app).get(url)),
    post: (url: string) => set(request(app).post(url)),
    patch: (url: string) => set(request(app).patch(url)),
    put: (url: string) => set(request(app).put(url)),
    delete: (url: string) => set(request(app).delete(url)),
  };
};

export { prisma, app };
