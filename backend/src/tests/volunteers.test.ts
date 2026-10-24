import { resetDb, makeUser, makeShelter, as, prisma } from './helpers';

const inH = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

describe('volunteer shifts', () => {
  let admin: any, coord: any, other: any, v1: any, v2: any, v3: any, A: any, B: any;

  beforeEach(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    v1 = await makeUser('VOLUNTEER');
    v2 = await makeUser('VOLUNTEER');
    v3 = await makeUser('VOLUNTEER');
    A = await makeShelter(coord.id);
    B = await makeShelter(other.id);
  });
  afterAll(() => prisma.$disconnect());

  const create = (u: any, shelterId: string, o: any = {}) =>
    as(u).post('/api/volunteers/shifts').send({ shelterId, title: 'Meal service', startTime: inH(5), endTime: inH(9), requiredCount: 2, ...o });

  it('coordinators create shifts only for their own shelter; admin anywhere; volunteers never', async () => {
    expect((await create(coord, A.id)).status).toBe(201);
    expect((await create(coord, B.id)).status).toBe(403);
    expect((await create(admin, B.id)).status).toBe(201);
    expect((await create(v1, A.id)).status).toBe(403);
    expect((await as().post('/api/volunteers/shifts').send({})).status).toBe(401);
    const audit = await prisma.auditLog.count({ where: { action: 'SHIFT_CREATE' } });
    expect(audit).toBe(2);
  });

  it('validates shift input', async () => {
    expect((await create(coord, A.id, { title: '' })).status).toBe(400);
    expect((await create(coord, A.id, { requiredCount: 0 })).status).toBe(400);
    expect((await create(coord, A.id, { startTime: inH(9), endTime: inH(5) })).body.error).toBe('End time must be after start time');
    expect((await create(coord, A.id, { startTime: inH(-9), endTime: inH(-5) })).status).toBe(400);
    expect((await create(coord, A.id, { startTime: 'nonsense' })).status).toBe(400);
  });

  it('volunteer signup: success, duplicate, full, overlap', async () => {
    const s = (await create(coord, A.id, { requiredCount: 1 })).body;
    expect((await as(v1).post(`/api/volunteers/shifts/${s.id}/signup`)).status).toBe(201);
    const dup = await as(v1).post(`/api/volunteers/shifts/${s.id}/signup`);
    expect(dup.status).toBe(400);
    expect(dup.body.error).toBe('Already signed up for this shift');
    const full = await as(v2).post(`/api/volunteers/shifts/${s.id}/signup`);
    expect(full.body.error).toBe('Shift is already full');

    const clash = (await create(coord, A.id, { startTime: inH(7), endTime: inH(11) })).body;
    const c = await as(v1).post(`/api/volunteers/shifts/${clash.id}/signup`);
    expect(c.body.error).toBe('Time conflict with an existing shift');
    const adjacent = (await create(coord, A.id, { startTime: inH(9), endTime: inH(12) })).body;
    expect((await as(v1).post(`/api/volunteers/shifts/${adjacent.id}/signup`)).status).toBe(201);

    expect((await as(coord).post(`/api/volunteers/shifts/${s.id}/signup`)).status).toBe(403); // staff are not volunteers
  });

  it('concurrent signups never exceed capacity', async () => {
    const s = (await create(coord, A.id, { requiredCount: 1 })).body;
    const results = await Promise.all([v1, v2, v3].map((v) => as(v).post(`/api/volunteers/shifts/${s.id}/signup`)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.volunteerAssignment.count({ where: { shiftId: s.id } })).toBe(1);
  });

  it('cannot sign up for started or cancelled shifts; cannot cancel after start', async () => {
    const started = await prisma.volunteerShift.create({ data: { shelterId: A.id, title: 'x', startTime: new Date(Date.now() - 3600_000), endTime: new Date(Date.now() + 3600_000), requiredCount: 2 } });
    expect((await as(v1).post(`/api/volunteers/shifts/${started.id}/signup`)).body.error).toBe('Shift has already started');
    await prisma.volunteerAssignment.create({ data: { shiftId: started.id, volunteerId: v2.id } });
    expect((await as(v2).delete(`/api/volunteers/shifts/${started.id}/signup`)).status).toBe(400);

    const s = (await create(coord, A.id)).body;
    await as(coord).patch(`/api/volunteers/shifts/${s.id}`).send({ status: 'CANCELLED' }).expect(200);
    expect((await as(v1).post(`/api/volunteers/shifts/${s.id}/signup`)).body.error).toBe('Shift is cancelled');
  });

  it('volunteer can cancel an upcoming signup, once; my shifts lists theirs', async () => {
    const s = (await create(coord, A.id)).body;
    await as(v1).post(`/api/volunteers/shifts/${s.id}/signup`).expect(201);
    const mine = await as(v1).get('/api/volunteers/me/shifts');
    expect(mine.body.map((x: any) => x.id)).toEqual([s.id]);
    expect((await as(v2).get('/api/volunteers/me/shifts')).body).toHaveLength(0);
    expect((await as(v1).delete(`/api/volunteers/shifts/${s.id}/signup`)).status).toBe(200);
    expect((await as(v1).delete(`/api/volunteers/shifts/${s.id}/signup`)).status).toBe(400);
    expect((await as(coord).get('/api/volunteers/me/shifts')).status).toBe(403);
  });

  it('edit/cancel is scoped; required count cannot drop below signups; cancelled shifts hidden from volunteers', async () => {
    const s = (await create(coord, A.id)).body;
    await as(v1).post(`/api/volunteers/shifts/${s.id}/signup`);
    await as(v2).post(`/api/volunteers/shifts/${s.id}/signup`);
    expect((await as(other).patch(`/api/volunteers/shifts/${s.id}`).send({ title: 'hack' })).status).toBe(403);
    expect((await as(v1).patch(`/api/volunteers/shifts/${s.id}`).send({ title: 'hack' })).status).toBe(403);
    expect((await as(coord).patch(`/api/volunteers/shifts/${s.id}`).send({ requiredCount: 1 })).status).toBe(400);
    const ok = await as(coord).patch(`/api/volunteers/shifts/${s.id}`).send({ title: 'Renamed', requiredCount: 5 });
    expect(ok.body.title).toBe('Renamed');

    await as(coord).patch(`/api/volunteers/shifts/${s.id}`).send({ status: 'CANCELLED' }).expect(200);
    expect((await as(coord).patch(`/api/volunteers/shifts/${s.id}`).send({ title: 'again' })).status).toBe(409);
    expect((await as(v3).get('/api/volunteers/shifts')).body).toHaveLength(0);
    expect((await as(coord).get('/api/volunteers/shifts')).body).toHaveLength(1);
  });

  it('time edits that clash with a signed-up volunteer other shift are refused', async () => {
    const s1 = (await create(coord, A.id)).body;
    const s2 = (await create(coord, A.id, { startTime: inH(20), endTime: inH(24) })).body;
    await as(v1).post(`/api/volunteers/shifts/${s1.id}/signup`);
    await as(v1).post(`/api/volunteers/shifts/${s2.id}/signup`);
    const res = await as(coord).patch(`/api/volunteers/shifts/${s2.id}`).send({ startTime: inH(6), endTime: inH(10) });
    expect(res.status).toBe(409);
  });

  it('listing: volunteers see counts only; managing staff see names; filters work', async () => {
    const s = (await create(coord, A.id)).body;
    await create(admin, B.id);
    await as(v1).post(`/api/volunteers/shifts/${s.id}/signup`);
    const asVol = (await as(v2).get(`/api/volunteers/shifts?shelterId=${A.id}`)).body[0];
    expect(asVol.assignments).toBeUndefined();
    expect(asVol).toMatchObject({ filledCount: 1, openSlots: 1, signedUp: false, isFull: false });
    expect((await as(v1).get('/api/volunteers/shifts')).body.find((x: any) => x.id === s.id).signedUp).toBe(true);
    const asOwner = (await as(coord).get('/api/volunteers/shifts')).body;
    expect(asOwner.find((x: any) => x.id === s.id).assignments[0].volunteer.id).toBe(v1.id);
    expect(asOwner.find((x: any) => x.shelterId === B.id).assignments).toBeUndefined(); // not their shelter
    expect((await as(admin).get(`/api/volunteers/shifts?upcoming=true&shelterId=${B.id}`)).body).toHaveLength(1);
    expect((await as().get('/api/volunteers/shifts')).status).toBe(401);
  });

  it('staff can list volunteers; volunteers cannot', async () => {
    expect((await as(coord).get('/api/volunteers')).body).toHaveLength(3);
    expect((await as(v1).get('/api/volunteers')).status).toBe(403);
  });

  it('staff can remove a volunteer from a managed shift only', async () => {
    const s = (await create(coord, A.id)).body;
    await as(v1).post(`/api/volunteers/shifts/${s.id}/signup`);
    expect((await as(other).delete(`/api/volunteers/shifts/${s.id}/volunteers/${v1.id}`)).status).toBe(403);
    expect((await as(coord).delete(`/api/volunteers/shifts/${s.id}/volunteers/${v1.id}`)).status).toBe(200);
    expect(await prisma.volunteerAssignment.count()).toBe(0);
  });
});
