import { resetDb, makeUser, makeShelter, makeResource, as, prisma } from './helpers';

describe('donations', () => {
  let admin: any, coord: any, other: any, vol: any, A: any, B: any, water: any;

  beforeEach(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    vol = await makeUser('VOLUNTEER');
    A = await makeShelter(coord.id);
    B = await makeShelter(other.id);
    water = await makeResource(A.id, 'WATER', 10, 20);
  });
  afterAll(() => prisma.$disconnect());

  const give = (u: any, shelterId: string, o: any = {}) =>
    as(u).post('/api/donations').send({ shelterId, donorName: 'Rotary', resourceType: 'WATER', quantity: 100, unit: 'litres', ...o });
  const qty = async () => (await prisma.resource.findUniqueOrThrow({ where: { id: water.id } })).quantity;

  it('recording without applyToInventory leaves stock untouched (PENDING)', async () => {
    const res = await give(coord, A.id, { notes: 'gate drop', receiptRef: 'R-1' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING', inventoryApplied: false, recordedBy: { id: coord.id } });
    expect(await qty()).toBe(10);
  });

  it('applyToInventory accepts and adds stock once, with ledger, audit and alert clearing', async () => {
    await as(coord).patch(`/api/shelters/${A.id}/resources/${water.id}`).send({ quantity: 5 });
    expect(await prisma.alertLog.count({ where: { shelterId: A.id, alertType: 'LOW_STOCK', status: 'ACTIVE' } })).toBe(1);
    const res = await give(coord, A.id, { applyToInventory: true });
    expect(res.body).toMatchObject({ status: 'ACCEPTED', inventoryApplied: true, acceptedBy: { id: coord.id } });
    expect(await qty()).toBe(105);
    const mv = await prisma.stockMovement.findFirstOrThrow({ where: { referenceId: res.body.id } });
    expect(mv).toMatchObject({ type: 'DONATION', delta: 100, quantityAfter: 105 });
    expect(await prisma.alertLog.count({ where: { shelterId: A.id, alertType: 'LOW_STOCK', status: 'ACTIVE' } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'DONATION_ACCEPT', entityId: res.body.id } })).toBe(1);
  });

  it('accepting a pending donation applies inventory exactly once, even on repeat and in parallel', async () => {
    const d = (await give(coord, A.id)).body;
    const [r1, r2] = await Promise.all([
      as(coord).patch(`/api/donations/${d.id}`).send({ status: 'ACCEPTED' }),
      as(admin).patch(`/api/donations/${d.id}`).send({ status: 'ACCEPTED' }),
    ]);
    expect([r1.status, r2.status].filter((s) => s === 200)).toHaveLength(1);
    expect(await qty()).toBe(110);
    expect((await as(coord).patch(`/api/donations/${d.id}`).send({ status: 'ACCEPTED' })).status).toBe(409);
    expect(await qty()).toBe(110);
    expect(await prisma.stockMovement.count({ where: { referenceId: d.id } })).toBe(1);
  });

  it('accepting creates the resource when the shelter does not stock it yet', async () => {
    const d = (await give(coord, A.id, { resourceType: 'MEDICINE', quantity: 7, unit: 'kits', applyToInventory: true })).body;
    const r = await prisma.resource.findFirstOrThrow({ where: { shelterId: A.id, resourceType: 'MEDICINE' } });
    expect(r.quantity).toBe(7);
    expect(d.status).toBe('ACCEPTED');
  });

  it('rejecting never touches stock and is final', async () => {
    const d = (await give(coord, A.id)).body;
    expect((await as(coord).patch(`/api/donations/${d.id}`).send({ status: 'REJECTED' })).body.status).toBe('REJECTED');
    expect(await qty()).toBe(10);
    expect((await as(coord).patch(`/api/donations/${d.id}`).send({ status: 'ACCEPTED' })).status).toBe(409);
    expect(await qty()).toBe(10);
  });

  it('edits notes and receipt reference; receipt file name becomes a storage reference', async () => {
    const d = (await give(coord, A.id)).body;
    const res = await as(coord).patch(`/api/donations/${d.id}`).send({ notes: 'updated', receiptRef: 'R-9', receiptFileName: 'receipt.pdf' });
    expect(res.body).toMatchObject({ notes: 'updated', receiptRef: 'R-9' });
    expect(res.body.receiptUrl).toContain('receipt.pdf');
  });

  it('scoping: coordinators only their shelters; volunteers and anonymous refused; admin all', async () => {
    expect((await give(coord, B.id)).status).toBe(403);
    expect((await give(vol, A.id)).status).toBe(403);
    expect((await as().get('/api/donations')).status).toBe(401);
    const a = (await give(coord, A.id)).body;
    const b = (await give(other, B.id)).body;
    expect((await as(coord).get('/api/donations')).body.map((x: any) => x.id)).toEqual([a.id]);
    expect((await as(admin).get('/api/donations')).body).toHaveLength(2);
    expect((await as(coord).get(`/api/donations?shelterId=${B.id}`)).status).toBe(403);
    expect((await as(coord).patch(`/api/donations/${b.id}`).send({ notes: 'x' })).status).toBe(403);
    expect((await as(vol).get('/api/donations')).status).toBe(403);
  });

  it('validation and filters', async () => {
    expect((await give(coord, A.id, { quantity: 0 })).status).toBe(400);
    expect((await give(coord, A.id, { quantity: -5 })).status).toBe(400);
    expect((await give(coord, A.id, { donorName: '' })).status).toBe(400);
    expect((await give(coord, A.id, { resourceType: 'GOLD' })).status).toBe(400);
    expect((await as(coord).patch('/api/donations/nope').send({ notes: 'x' })).status).toBe(404);
    expect((await as(coord).patch('/api/donations/nope').send({})).status).toBe(400);
    await give(coord, A.id, { resourceType: 'FOOD', unit: 'packs' });
    await give(coord, A.id, { applyToInventory: true });
    expect((await as(admin).get('/api/donations?resourceType=FOOD')).body).toHaveLength(1);
    expect((await as(admin).get('/api/donations?status=ACCEPTED')).body).toHaveLength(1);
    const future = new Date(Date.now() + 86400_000 * 5).toISOString();
    expect((await as(admin).get(`/api/donations?from=${encodeURIComponent(future)}`)).body).toHaveLength(0);
  });

  it('inactive shelters cannot receive donations', async () => {
    await prisma.shelter.update({ where: { id: A.id }, data: { status: 'INACTIVE' } });
    expect((await give(coord, A.id)).status).toBe(400);
  });
});

describe('medical priority views', () => {
  let admin: any, coord: any, other: any, vol: any, A: any, B: any;

  beforeAll(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    vol = await makeUser('VOLUNTEER');
    A = await makeShelter(coord.id);
    B = await makeShelter(other.id);
    const ci = (u: any, s: any, body: any) => as(u).post(`/api/shelters/${s.id}/checkin`).send(body).expect(201);
    await ci(coord, A, { personName: 'Crit', familySize: 2, criticalMedical: true });
    await ci(coord, A, { personName: 'Preg', familySize: 2, pregnantFlag: true });
    await ci(coord, A, { personName: 'Old', familySize: 3, elderlyCount: 2 });
    await ci(coord, A, { personName: 'Healthy', familySize: 2 });
    await ci(other, B, { personName: 'Kids', familySize: 4, childrenCount: 3 });
  });
  afterAll(() => prisma.$disconnect());

  it('priorities are computed on check-in', async () => {
    const rows = await prisma.checkin.findMany({ orderBy: { personName: 'asc' } });
    expect(Object.fromEntries(rows.map((r) => [r.personName, r.priority]))).toEqual({ Crit: 'CRITICAL', Preg: 'HIGH', Old: 'MEDIUM', Healthy: 'NONE', Kids: 'LOW' });
  });

  it('district view: admin sees all sorted by priority; coordinator only own shelter; NONE excluded', async () => {
    const adm = (await as(admin).get('/api/dashboard/medical')).body;
    expect(adm.cases.map((c: any) => c.personName)).toEqual(['Crit', 'Preg', 'Old', 'Kids']);
    expect(adm.totals).toMatchObject({ critical: 1, high: 1, medium: 1, low: 1, pregnant: 1, elderly: 2, children: 3 });
    expect(adm.perShelter).toHaveLength(2);
    const co = (await as(coord).get('/api/dashboard/medical')).body;
    expect(co.cases.map((c: any) => c.personName)).toEqual(['Crit', 'Preg', 'Old']);
    expect((await as(coord).get(`/api/dashboard/medical?shelterId=${B.id}`)).body.cases).toHaveLength(0);
  });

  it('volunteers and anonymous users cannot read medical data anywhere', async () => {
    expect((await as(vol).get('/api/dashboard/medical')).status).toBe(403);
    expect((await as().get('/api/dashboard/medical')).status).toBe(401);
    expect((await as(vol).get(`/api/shelters/${A.id}/overview`)).status).toBe(403);
    expect((await as(vol).get(`/api/shelters/${A.id}/checkins`)).status).toBe(403);
    const pub = JSON.stringify((await as().get(`/api/shelters/${A.id}`)).body);
    expect(pub).not.toMatch(/Crit|Preg|Old|Kids/);
  });

  it('overview lists medical occupants highest priority first', async () => {
    const o = (await as(coord).get(`/api/shelters/${A.id}/overview`)).body;
    expect(o.medicalOccupants.map((c: any) => c.priority)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM']);
  });
});
