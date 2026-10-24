import { resetDb, makeUser, makeShelter, as, prisma } from './helpers';

describe('reunification', () => {
  let admin: any, coord: any, other: any, vol: any, A: any, B: any, occA: any, occB: any;

  beforeAll(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    vol = await makeUser('VOLUNTEER');
    A = await makeShelter(coord.id, { name: 'Alpha Camp' });
    B = await makeShelter(other.id, { name: 'Beta Camp' });
    occA = (await as(coord).post(`/api/shelters/${A.id}/checkin`).send({ personName: 'Lakshmi Narayanan', familySize: 2, phone: '9000000001' })).body;
    occB = (await as(other).post(`/api/shelters/${B.id}/checkin`).send({ personName: 'Lakshmi Devi', familySize: 1 })).body;
  });
  afterAll(() => prisma.$disconnect());

  const report = (body: any = {}, u?: any) =>
    as(u).post('/api/reunification').send({ missingPersonName: 'Lakshmi Narayanan', age: 60, contactPerson: 'Ravi', contactInfo: '+91 98400 12345', ...body });

  it('public report returns only id + status and never match data, even when an occupant matches', async () => {
    const res = await report();
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['id', 'message', 'status']);
    expect(res.body.status).toBe('MISSING');
    expect(JSON.stringify(res.body)).not.toMatch(/Alpha|Beta|Lakshmi|candidates|potentialMatches/);
    expect(await prisma.auditLog.count({ where: { action: 'REUNIFICATION_REPORT', entityId: res.body.id } })).toBe(1);
  });

  it('validates the report', async () => {
    expect((await report({ missingPersonName: 'x' })).status).toBe(400);
    expect((await report({ contactInfo: '' })).status).toBe(400);
    expect((await report({ age: -3 })).status).toBe(400);
    expect((await report({ age: 500 })).status).toBe(400);
    expect((await report({ lastKnownShelterId: 'nope' })).status).toBe(400);
  });

  it('public search: >= 2 chars, no contacts, notes or occupant data', async () => {
    await report({ missingPersonName: 'Selvam Kumar', lastKnownShelterId: A.id, description: 'secret description' });
    expect((await as().get('/api/reunification/public-search?q=a')).status).toBe(400);
    const res = await as().get('/api/reunification/public-search?q=selvam');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Object.keys(res.body[0]).sort()).toEqual(['age', 'id', 'lastKnownShelterName', 'missingPersonName', 'status']);
    expect(res.body[0].lastKnownShelterName).toBe('Alpha Camp');
    expect(JSON.stringify(res.body)).not.toMatch(/98400|Ravi|secret|phone/);
    // occupant names are NOT searchable publicly
    expect((await as().get('/api/reunification/public-search?q=Devi')).body).toHaveLength(0);
  });

  it('staff list is role-gated and shows candidate matches only from shelters the user manages', async () => {
    expect((await as().get('/api/reunification')).status).toBe(401);
    expect((await as(vol).get('/api/reunification')).status).toBe(403);
    const adm = (await as(admin).get('/api/reunification?q=Lakshmi')).body;
    expect(adm[0].contactInfo).toContain('98400');
    expect(adm[0].candidates.map((c: any) => c.personName).sort()).toEqual(['Lakshmi Devi', 'Lakshmi Narayanan']);
    expect(adm[0].candidates[0].personName).toBe('Lakshmi Narayanan'); // full-name match ranks first
    const co = (await as(coord).get('/api/reunification?q=Lakshmi')).body;
    expect(co[0].candidates.map((c: any) => c.personName)).toEqual(['Lakshmi Narayanan']);
    expect((await as(admin).get('/api/reunification?status=REUNITED')).body).toHaveLength(0);
  });

  it('staff update: link occupant, status transitions, scope and audit', async () => {
    const c = (await as(admin).get('/api/reunification?q=Narayanan')).body[0];
    expect((await as(vol).patch(`/api/reunification/${c.id}`).send({ staffNotes: 'x' })).status).toBe(403);
    expect((await as(coord).patch(`/api/reunification/${c.id}`).send({})).status).toBe(400);
    expect((await as(coord).patch(`/api/reunification/${c.id}`).send({ matchedCheckinId: occB.id })).status).toBe(400); // other shelter
    expect((await as(coord).patch(`/api/reunification/${c.id}`).send({ matchedCheckinId: 'ghost' })).status).toBe(400);
    expect((await as(coord).patch(`/api/reunification/${c.id}`).send({ status: 'POTENTIAL_MATCH' })).status).toBe(400); // needs a link

    const linked = await as(coord).patch(`/api/reunification/${c.id}`).send({ matchedCheckinId: occA.id });
    expect(linked.status).toBe(200);
    expect(linked.body.status).toBe('POTENTIAL_MATCH');
    expect(linked.body.matchedCheckin.shelter.name).toBe('Alpha Camp');

    const done = await as(coord).patch(`/api/reunification/${c.id}/status`).send({ status: 'REUNITED', staffNotes: 'Met at desk' });
    expect(done.body.status).toBe('REUNITED');
    expect(done.body.staffNotes).toBe('Met at desk');
    expect(await prisma.auditLog.count({ where: { action: 'REUNIFICATION_UPDATE', entityId: c.id } })).toBe(2);
    expect((await as(admin).get('/api/reunification?status=REUNITED')).body[0].candidates).toEqual([]);
  });

  it('cannot mark reunited without an explanation, and unknown case is 404', async () => {
    const fresh = (await report({ missingPersonName: 'Nobody Known' })).body;
    expect((await as(admin).patch(`/api/reunification/${fresh.id}`).send({ status: 'REUNITED' })).status).toBe(400);
    expect((await as(admin).patch(`/api/reunification/${fresh.id}`).send({ status: 'CLOSED', staffNotes: 'Found safe elsewhere' })).body.status).toBe('CLOSED');
    expect((await as(admin).patch('/api/reunification/nope').send({ staffNotes: 'x' })).status).toBe(404);
  });

  it('a signed-in reporter is recorded', async () => {
    const res = await report({ missingPersonName: 'Signed Report' }, vol);
    expect((await prisma.reunificationCase.findUniqueOrThrow({ where: { id: res.body.id } })).reportedById).toBe(vol.id);
  });
});

describe('shelter translations in public listings', () => {
  let coord: any, S: any;
  beforeAll(async () => {
    await resetDb();
    coord = await makeUser('COORDINATOR');
    S = await makeShelter(coord.id, { name: 'English Name' });
    await as(coord).put(`/api/shelters/${S.id}/translations/ta`).send({ name: 'Tamil Name', description: 'Tamil desc' }).expect(200);
  });
  afterAll(() => prisma.$disconnect());

  it('list and nearest return the requested translation, or null (fallback to base name)', async () => {
    const ta = (await as().get('/api/shelters?lang=ta')).body[0];
    expect(ta.name).toBe('English Name');
    expect(ta.translation).toMatchObject({ name: 'Tamil Name', description: 'Tamil desc' });
    expect((await as().get('/api/shelters?lang=fr')).body[0].translation).toBeNull();
    expect((await as().get('/api/shelters')).body[0].translation).toBeNull();
    const near = (await as().get('/api/shelters/nearest?latitude=13&longitude=80.2&lang=ta')).body[0];
    expect(near.translation.name).toBe('Tamil Name');
  });

  it('translation upsert is idempotent per locale and searchable by translated name', async () => {
    await as(coord).put(`/api/shelters/${S.id}/translations/ta`).send({ name: 'Tamil Name 2' }).expect(200);
    expect(await prisma.shelterTranslation.count({ where: { shelterId: S.id, locale: 'ta' } })).toBe(1);
    expect((await as().get('/api/shelters?q=Tamil%20Name%202')).body).toHaveLength(1);
  });
});
