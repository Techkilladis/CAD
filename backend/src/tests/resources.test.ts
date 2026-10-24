import { resetDb, makeUser, makeShelter, makeResource, as, prisma } from './helpers';

describe('resources & stock ledger', () => {
  let coord: any, other: any, shelter: any, otherShelter: any, water: any, food: any;

  beforeAll(async () => {
    await resetDb();
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    shelter = await makeShelter(coord.id);
    otherShelter = await makeShelter(other.id);
    water = await makeResource(shelter.id, 'WATER', 100, 20);
    food = await makeResource(shelter.id, 'FOOD', 100, 20);
  });
  afterAll(() => prisma.$disconnect());

  const qty = async (id: string) => (await prisma.resource.findUniqueOrThrow({ where: { id } })).quantity;
  const patch = (u: any, sid: string, rid: string, body: any) =>
    as(u).patch(`/api/shelters/${sid}/resources/${rid}`).send(body);

  it('set quantity records a SET movement and audit row', async () => {
    const res = await patch(coord, shelter.id, water.id, { quantity: 80, note: 'recount' });
    expect(res.status).toBe(200);
    const mv = await prisma.stockMovement.findFirstOrThrow({ where: { resourceId: water.id } });
    expect(mv).toMatchObject({ type: 'SET', delta: -20, quantityAfter: 80, userId: coord.id, note: 'recount' });
    expect(await prisma.auditLog.count({ where: { action: 'RESOURCE_UPDATE', entityId: water.id } })).toBe(1);
  });

  it('delta adjusts; negative results and negative quantities are rejected', async () => {
    expect((await patch(coord, shelter.id, water.id, { delta: 10 })).status).toBe(200);
    expect(await qty(water.id)).toBe(90);
    expect((await patch(coord, shelter.id, water.id, { delta: -91 })).status).toBe(400);
    expect((await patch(coord, shelter.id, water.id, { quantity: -1 })).status).toBe(400);
    expect((await patch(coord, shelter.id, water.id, { quantity: 5, delta: 1 })).status).toBe(400);
    expect(await qty(water.id)).toBe(90);
  });

  it('a resource of another shelter cannot be modified, nor by a non-owner', async () => {
    const foreign = await makeResource(otherShelter.id, 'FOOD', 10);
    expect((await patch(coord, shelter.id, foreign.id, { quantity: 1 })).status).toBe(404);
    expect((await patch(coord, otherShelter.id, foreign.id, { quantity: 1 })).status).toBe(403);
    expect(await qty(foreign.id)).toBe(10);
  });

  it('LOW_STOCK alerts are per resource and not duplicated by repeated updates', async () => {
    await patch(coord, shelter.id, water.id, { quantity: 10 });
    await patch(coord, shelter.id, water.id, { quantity: 9 });
    await patch(coord, shelter.id, food.id, { quantity: 5 });
    const alerts = await prisma.alertLog.findMany({
      where: { shelterId: shelter.id, alertType: 'LOW_STOCK', status: 'ACTIVE' },
    });
    expect(alerts.map((a) => a.dedupeKey).sort()).toEqual([
      `LOW_STOCK:${shelter.id}:FOOD`,
      `LOW_STOCK:${shelter.id}:WATER`,
    ]);
  });

  it('LOW_STOCK alert auto-resolves when restocked', async () => {
    expect((await patch(coord, shelter.id, water.id, { delta: 500 })).status).toBe(200);
    const w = await prisma.alertLog.findMany({ where: { dedupeKey: `LOW_STOCK:${shelter.id}:WATER` } });
    expect(w).toHaveLength(1);
    expect(w[0].status).toBe('RESOLVED');
  });

  it('public view returns only type + stock status; staff view returns quantities', async () => {
    const pub = await as().get(`/api/shelters/${shelter.id}/resources`);
    expect(pub.status).toBe(200);
    expect(Object.keys(pub.body[0]).sort()).toEqual(['resourceType', 'stockStatus', 'unit']);
    const staff = await as(coord).get(`/api/shelters/${shelter.id}/resources`);
    expect(staff.body[0].quantity).toBeDefined();
    const stranger = await as(other).get(`/api/shelters/${shelter.id}/resources`);
    expect(stranger.body[0].quantity).toBeUndefined();
  });

  it('create resource validates, rejects duplicates, and records an opening movement', async () => {
    const body = { resourceType: 'MEDICINE', quantity: 30, unit: 'kits', lowStockThreshold: 10 };
    expect((await as(coord).post(`/api/shelters/${shelter.id}/resources`).send({ ...body, quantity: -3 })).status).toBe(400);
    const ok = await as(coord).post(`/api/shelters/${shelter.id}/resources`).send(body);
    expect(ok.status).toBe(201);
    expect((await as(coord).post(`/api/shelters/${shelter.id}/resources`).send(body)).status).toBe(409);
    expect(await prisma.stockMovement.count({ where: { resourceId: ok.body.id } })).toBe(1);
  });

  it('movement history is staff-only', async () => {
    expect((await as().get(`/api/shelters/${shelter.id}/resources/movements`)).status).toBe(401);
    const res = await as(coord).get(`/api/shelters/${shelter.id}/resources/movements?resourceId=${water.id}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(1);
  });
});
