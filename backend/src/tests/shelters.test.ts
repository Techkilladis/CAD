import { resetDb, makeUser, makeShelter, makeResource, as, prisma } from './helpers';

describe('shelters: public safety, access control, admin/coordinator edits', () => {
  let admin: any, coord: any, other: any, shelter: any, otherShelter: any;

  beforeAll(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    shelter = await makeShelter(coord.id, { name: 'Alpha Hall', capacityTotal: 100 });
    otherShelter = await makeShelter(other.id, { name: 'Beta Hall', capacityTotal: 50 });
    await makeResource(shelter.id, 'WATER', 500, 100);
    await as(coord)
      .post(`/api/shelters/${shelter.id}/checkin`)
      .send({ personName: 'Secret Person', phone: '555-0100', familySize: 2, medicalFlag: true, medicalNotes: 'insulin' });
  });
  afterAll(() => prisma.$disconnect());

  it('public detail and list never leak occupant data', async () => {
    const detail = await as().get(`/api/shelters/${shelter.id}`);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toMatch(/Secret Person|555-0100|insulin|checkins/);
    expect(detail.body.resources[0]).toEqual({ resourceType: 'WATER', stockStatus: 'HEALTHY', unit: 'units' });
    const list = await as().get('/api/shelters');
    expect(JSON.stringify(list.body)).not.toMatch(/Secret Person|insulin/);
  });

  it('create shelter: admin only, validated, audited', async () => {
    const body = { name: 'New', address: 'x', latitude: 13, longitude: 80, capacityTotal: 10 };
    expect((await as().post('/api/shelters').send(body)).status).toBe(401);
    expect((await as(coord).post('/api/shelters').send(body)).status).toBe(403);
    expect((await as(admin).post('/api/shelters').send({ ...body, capacityTotal: 0 })).status).toBe(400);
    expect((await as(admin).post('/api/shelters').send({ ...body, coordinatorId: admin.id })).status).toBe(400);
    const ok = await as(admin).post('/api/shelters').send(body);
    expect(ok.status).toBe(201);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'SHELTER_CREATE', entityId: ok.body.id } });
    expect(audit?.userId).toBe(admin.id);
  });

  it('coordinator cannot edit a foreign shelter or admin-only fields', async () => {
    expect((await as(coord).patch(`/api/shelters/${otherShelter.id}`).send({ description: 'hi' })).status).toBe(403);
    expect((await as(coord).patch(`/api/shelters/${shelter.id}`).send({ capacityTotal: 500 })).status).toBe(403);
    const ok = await as(coord).patch(`/api/shelters/${shelter.id}`).send({ description: 'Updated', medicalSupport: true });
    expect(ok.status).toBe(200);
    expect(ok.body.description).toBe('Updated');
  });

  it('capacity cannot be reduced below current occupancy', async () => {
    const res = await as(admin).patch(`/api/shelters/${shelter.id}`).send({ capacityTotal: 1 });
    expect(res.status).toBe(400);
  });

  it('overview is staff-only and scoped', async () => {
    expect((await as().get(`/api/shelters/${shelter.id}/overview`)).status).toBe(401);
    expect((await as(other).get(`/api/shelters/${shelter.id}/overview`)).status).toBe(403);
    const ok = await as(coord).get(`/api/shelters/${shelter.id}/overview`);
    expect(ok.status).toBe(200);
    expect(ok.body.activeOccupants).toHaveLength(1);
    expect(ok.body.capacity.occupied).toBe(2);
  });

  it('deactivation hides the shelter publicly; filters work', async () => {
    await as(admin).patch(`/api/shelters/${otherShelter.id}/status`).send({ status: 'INACTIVE' }).expect(200);
    const list = await as().get('/api/shelters');
    expect(list.body.find((s: any) => s.id === otherShelter.id)).toBeUndefined();
    const withRes = await as().get('/api/shelters?resource=WATER');
    expect(withRes.body.map((s: any) => s.id)).toEqual([shelter.id]);
    const q = await as().get('/api/shelters?q=alpha');
    expect(q.body).toHaveLength(1);
    const nearest = await as().get('/api/shelters/nearest?latitude=13&longitude=80.2&onlyAvailable=true');
    expect(nearest.body.every((s: any) => s.availableCapacity > 0 && s.status === 'ACTIVE')).toBe(true);
  });

  it('translations: owner can upsert; public detail honours lang', async () => {
    expect((await as(other).put(`/api/shelters/${shelter.id}/translations/ta`).send({ name: 'x' })).status).toBe(403);
    await as(coord)
      .put(`/api/shelters/${shelter.id}/translations/ta`)
      .send({ name: 'Tamil Alpha', instructions: 'Welcome' })
      .expect(200);
    const ta = await as().get(`/api/shelters/${shelter.id}?lang=ta`);
    expect(ta.body.translation.name).toBe('Tamil Alpha');
    expect(ta.body.languages).toEqual(expect.arrayContaining(['en', 'ta']));
    const bad = await as(coord).put(`/api/shelters/${shelter.id}/translations/!!`).send({ name: 'x' });
    expect(bad.status).toBe(400);
  });
});
