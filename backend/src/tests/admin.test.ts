import { resetDb, makeUser, makeShelter, makeResource, as, prisma } from './helpers';

describe('admin: audit, settings, users, reports', () => {
  let admin: any, admin2: any, coord: any, vol: any, A: any, B: any;

  beforeAll(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    admin2 = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    vol = await makeUser('VOLUNTEER');
    A = await makeShelter(coord.id, { capacityTotal: 50 });
    B = await makeShelter(null, { capacityTotal: 40 });
    await makeResource(A.id, 'WATER', 100, 20);
    await as(coord).post(`/api/shelters/${A.id}/checkin`).send({ personName: 'Fam', familySize: 3, medicalFlag: true }).expect(201);
    const water = await prisma.resource.findFirstOrThrow({ where: { shelterId: A.id } });
    for (const q of [90, 80, 70, 60, 50]) await as(coord).patch(`/api/shelters/${A.id}/resources/${water.id}`).send({ quantity: q }).expect(200);
  });
  afterAll(() => prisma.$disconnect());

  it('audit log is admin-only, filterable and paginated, and records real mutations', async () => {
    expect((await as(coord).get('/api/audit')).status).toBe(403);
    expect((await as().get('/api/audit')).status).toBe(401);
    const all = (await as(admin).get('/api/audit?pageSize=5')).body;
    expect(all.items).toHaveLength(5);
    expect(all.total).toBeGreaterThan(5);
    expect(all.pages).toBeGreaterThan(1);
    const checkins = (await as(admin).get('/api/audit?entity=Checkin')).body;
    expect(checkins.items.every((i: any) => i.entity === 'Checkin')).toBe(true);
    expect(checkins.items[0].user.id).toBe(coord.id);
    const byUser = (await as(admin).get(`/api/audit?userId=${coord.id}&action=checkin`)).body;
    expect(byUser.total).toBe(1);
    expect((await as(admin).get('/api/audit?page=0')).status).toBe(400);
    const facets = (await as(admin).get('/api/audit/facets')).body;
    expect(facets.entities).toContain('Checkin');
  });

  it('settings: defaults, validated update, audited, used by the alert engine', async () => {
    expect((await as(coord).get('/api/settings')).status).toBe(403);
    const initial = (await as(admin).get('/api/settings')).body;
    expect(initial.settings.overcrowdingThreshold).toBe(0.9);
    expect(initial.integrations.length).toBeGreaterThan(3);
    expect((await as(admin).patch('/api/settings').send({ overcrowdingThreshold: 5 })).status).toBe(400);
    expect((await as(admin).patch('/api/settings').send({ criticalMedicalCount: 2.5 })).status).toBe(400);
    expect((await as(admin).patch('/api/settings').send({ bogus: 1 })).status).toBe(400);
    expect((await as(admin).patch('/api/settings').send({})).status).toBe(400);
    expect((await as(coord).patch('/api/settings').send({ criticalMedicalCount: 3 })).status).toBe(403);

    // 3/50 = 6%: lowering the threshold to 5% (min allowed is 0.5) is not possible, so use occupancy at 55%
    await prisma.shelter.update({ where: { id: A.id }, data: { capacityOccupied: 28 } });
    await as(admin).post('/api/alerts/run-check').expect(200);
    expect(await prisma.alertLog.count({ where: { shelterId: A.id, alertType: 'OVERCROWDING', status: 'ACTIVE' } })).toBe(0);
    const res = await as(admin).patch('/api/settings').send({ overcrowdingThreshold: 0.5 });
    expect(res.body.settings.overcrowdingThreshold).toBe(0.5);
    await as(admin).post('/api/alerts/run-check').expect(200);
    expect(await prisma.alertLog.count({ where: { shelterId: A.id, alertType: 'OVERCROWDING', status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'SETTINGS_UPDATE', userId: admin.id } })).toBe(1);
    await as(admin).patch('/api/settings').send({ overcrowdingThreshold: 0.9 }).expect(200);
  });

  it('users: create, validate, duplicate email, update role/active, with guards', async () => {
    expect((await as(coord).get('/api/users')).status).toBe(403);
    const list = (await as(admin).get('/api/users')).body;
    expect(list.length).toBe(4);
    expect(list[0].shelters).toBeDefined();

    expect((await as(admin).post('/api/users').send({ name: '', email: 'x@example.com', role: 'VOLUNTEER' })).status).toBe(400);
    expect((await as(admin).post('/api/users').send({ name: 'N', email: 'not-an-email', role: 'VOLUNTEER' })).status).toBe(400);
    expect((await as(admin).post('/api/users').send({ name: 'N', email: 'n@example.com', role: 'KING' })).status).toBe(400);
    const created = await as(admin).post('/api/users').send({ name: 'New Vol', email: 'NEW@example.com', role: 'VOLUNTEER', phone: '12345' });
    expect(created.status).toBe(201);
    expect(created.body.email).toBe('new@example.com');
    expect((await as(admin).post('/api/users').send({ name: 'Dup', email: 'new@example.com', role: 'VOLUNTEER' })).status).toBe(409);

    // the new user can authenticate; deactivating locks them out
    expect((await as(created.body).get('/api/auth/me')).status).toBe(200);
    await as(admin).patch(`/api/users/${created.body.id}`).send({ isActive: false }).expect(200);
    expect((await as(created.body).get('/api/auth/me')).status).toBe(401);
    expect((await as(admin).patch(`/api/users/${created.body.id}`).send({ role: 'COORDINATOR', isActive: true })).body.role).toBe('COORDINATOR');
    expect((await as(admin).patch('/api/users/ghost').send({ name: 'x' })).status).toBe(404);
  });

  it('users: cannot remove the last/own admin or strand a coordinator shelter', async () => {
    expect((await as(admin).patch(`/api/users/${admin.id}`).send({ role: 'VOLUNTEER' })).status).toBe(400);
    expect((await as(admin).patch(`/api/users/${admin.id}`).send({ isActive: false })).status).toBe(400);
    expect((await as(admin).patch(`/api/users/${admin2.id}`).send({ isActive: false })).status).toBe(200);
    expect((await as(admin).patch(`/api/users/${admin2.id}`).send({ isActive: true })).status).toBe(200);
    const res = await as(admin).patch(`/api/users/${coord.id}`).send({ isActive: false });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Reassign/);
    expect((await as(admin).patch(`/api/users/${coord.id}`).send({ role: 'VOLUNTEER' })).status).toBe(409);
    expect(await prisma.auditLog.count({ where: { action: 'USER_UPDATE' } })).toBeGreaterThan(0);
  });

  it('reports aggregate: admin whole district, coordinator own shelters, others refused', async () => {
    const adm = (await as(admin).get('/api/dashboard/reports')).body;
    expect(adm.occupancy.totals.shelters).toBe(2);
    expect(adm.checkins.find((c: any) => c.status === 'CONFIRMED')).toMatchObject({ count: 1, people: 3 });
    expect(adm.medical.totals.high).toBe(1);
    expect(adm.reunification).not.toBeNull();
    const co = (await as(coord).get('/api/dashboard/reports')).body;
    expect(co.occupancy.totals.shelters).toBe(1);
    expect(co.reunification).toBeNull();
    expect((await as(vol).get('/api/dashboard/reports')).status).toBe(403);
    expect((await as().get('/api/dashboard/reports')).status).toBe(401);
    expect((await as(admin).get('/api/dashboard/volunteers')).body.totals).toBeDefined();
    expect((await as(coord).get('/api/dashboard/donations')).body.rows).toEqual([]);
  });
});
