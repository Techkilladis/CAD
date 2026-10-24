import { resetDb, makeUser, makeShelter, as, prisma } from './helpers';

describe('check-in / checkout / register integrity', () => {
  let coord: any, other: any, shelter: any, otherShelter: any;

  beforeAll(async () => {
    await resetDb();
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    shelter = await makeShelter(coord.id, { capacityTotal: 20 });
    otherShelter = await makeShelter(other.id, { capacityTotal: 20 });
  });
  afterAll(() => prisma.$disconnect());

  const occ = async (id: string = shelter.id) =>
    (await prisma.shelter.findUniqueOrThrow({ where: { id } })).capacityOccupied;
  const checkin = (u: any, sid: string, body: any) => as(u).post(`/api/shelters/${sid}/checkin`).send(body);

  it('check-in increments occupancy, computes priority, writes audit', async () => {
    const res = await checkin(coord, shelter.id, { personName: 'A', familySize: 4, elderlyCount: 1 });
    expect(res.status).toBe(201);
    expect(res.body.priority).toBe('MEDIUM');
    expect(await occ()).toBe(4);
    expect(await prisma.auditLog.count({ where: { action: 'CHECKIN', entityId: res.body.id } })).toBe(1);
  });

  it('critical medical => CRITICAL priority and a CRITICAL_MEDICAL_NEED alert', async () => {
    const res = await checkin(coord, shelter.id, { personName: 'B', familySize: 1, criticalMedical: true });
    expect(res.body.priority).toBe('CRITICAL');
    expect(
      await prisma.alertLog.count({ where: { shelterId: shelter.id, alertType: 'CRITICAL_MEDICAL_NEED', status: 'ACTIVE' } })
    ).toBe(1);
  });

  it('cannot exceed capacity and a failed check-in changes nothing', async () => {
    const before = await occ();
    const res = await checkin(coord, shelter.id, { personName: 'C', familySize: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Insufficient capacity');
    expect(await occ()).toBe(before);
  });

  it('validation errors return 400', async () => {
    expect((await checkin(coord, shelter.id, { personName: '', familySize: 1 })).status).toBe(400);
    expect((await checkin(coord, shelter.id, { personName: 'x', familySize: 0 })).status).toBe(400);
    expect((await checkin(coord, shelter.id, { personName: 'x', familySize: 2, childrenCount: 5 })).status).toBe(400);
  });

  it('a coordinator cannot check in to another coordinator shelter', async () => {
    const res = await checkin(coord, otherShelter.id, { personName: 'x', familySize: 1 });
    expect(res.status).toBe(403);
  });

  it('checkout uses the stored family size, not the client value; no double checkout', async () => {
    const c = await checkin(coord, shelter.id, { personName: 'D', familySize: 3 });
    const before = await occ();
    const out = await as(coord).post(`/api/shelters/${shelter.id}/checkout`).send({ checkinId: c.body.id, familySize: 999 });
    expect(out.status).toBe(200);
    expect(await occ()).toBe(before - 3);
    const again = await as(coord).post(`/api/shelters/${shelter.id}/checkout`).send({ checkinId: c.body.id });
    expect(again.status).toBe(409);
    expect(await occ()).toBe(before - 3);
  });

  it('checkout of a check-in from another shelter is rejected', async () => {
    const c = await checkin(other, otherShelter.id, { personName: 'E', familySize: 2 });
    const res = await as(coord).post(`/api/shelters/${shelter.id}/checkout`).send({ checkinId: c.body.id });
    expect(res.status).toBe(404);
    expect(await occ(otherShelter.id)).toBe(2);
  });

  it('full shelter flips to FULL with one deduped alert, then back to ACTIVE after checkout', async () => {
    const s = await makeShelter(coord.id, { capacityTotal: 10 });
    const c = await checkin(coord, s.id, { personName: 'F', familySize: 10 });
    expect((await prisma.shelter.findUniqueOrThrow({ where: { id: s.id } })).status).toBe('FULL');
    await checkin(coord, s.id, { personName: 'G', familySize: 1 }).then((r) => expect(r.status).toBe(400));
    expect(await prisma.alertLog.count({ where: { shelterId: s.id, alertType: 'FULL_SHELTER' } })).toBe(1);
    await as(coord).post(`/api/shelters/${s.id}/checkout`).send({ checkinId: c.body.id }).expect(200);
    expect((await prisma.shelter.findUniqueOrThrow({ where: { id: s.id } })).status).toBe('ACTIVE');
    expect(
      await prisma.alertLog.count({
        where: { shelterId: s.id, status: 'ACTIVE', alertType: { in: ['FULL_SHELTER', 'OVERCROWDING'] } },
      })
    ).toBe(0);
  });

  it('inactive / closed shelters refuse check-in and registration', async () => {
    const s = await makeShelter(coord.id, { status: 'EMERGENCY_CLOSED' });
    expect((await checkin(coord, s.id, { personName: 'x', familySize: 1 })).status).toBe(400);
    expect((await as().post(`/api/shelters/${s.id}/register`).send({ personName: 'x', familySize: 1 })).status).toBe(400);
  });

  it('public registration is PENDING, returns a reference code only, then coordinator confirms', async () => {
    const before = await occ();
    const reg = await as().post(`/api/shelters/${shelter.id}/register`).send({ personName: 'Public Fam', familySize: 2, phone: '123' });
    expect(reg.status).toBe(201);
    expect(reg.body.referenceCode).toMatch(/^SH-/);
    expect(reg.body.personName).toBeUndefined();
    expect(await occ()).toBe(before);

    const row = await prisma.checkin.findFirstOrThrow({ where: { referenceCode: reg.body.referenceCode } });
    expect(row.status).toBe('PENDING');
    expect(row.source).toBe('PUBLIC_REGISTRATION');

    expect((await as(other).patch(`/api/shelters/${shelter.id}/checkin/${row.id}/confirm`)).status).toBe(403);
    const ok = await as(coord).patch(`/api/shelters/${shelter.id}/checkin/${row.id}/confirm`);
    expect(ok.status).toBe(200);
    expect(await occ()).toBe(before + 2);
    expect((await as(coord).patch(`/api/shelters/${shelter.id}/checkin/${row.id}/confirm`)).status).toBe(409);
    expect(await occ()).toBe(before + 2);
  });

  it('rejecting a pending registration does not touch occupancy', async () => {
    const reg = await as().post(`/api/shelters/${shelter.id}/register`).send({ personName: 'Reject Me', familySize: 1 });
    const row = await prisma.checkin.findFirstOrThrow({ where: { referenceCode: reg.body.referenceCode } });
    const before = await occ();
    await as(coord).patch(`/api/shelters/${shelter.id}/checkin/${row.id}/reject`).send({ reason: 'Duplicate' }).expect(200);
    expect(await occ()).toBe(before);
    expect((await prisma.checkin.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CANCELLED');
  });

  it('confirming when capacity has run out fails and leaves the check-in PENDING', async () => {
    const s = await makeShelter(coord.id, { capacityTotal: 5 });
    const reg = await as().post(`/api/shelters/${s.id}/register`).send({ personName: 'Late', familySize: 4 });
    const row = await prisma.checkin.findFirstOrThrow({ where: { referenceCode: reg.body.referenceCode } });
    await checkin(coord, s.id, { personName: 'Walk-in', familySize: 3 }).then((r) => expect(r.status).toBe(201));
    const res = await as(coord).patch(`/api/shelters/${s.id}/checkin/${row.id}/confirm`);
    expect(res.status).toBe(400);
    expect((await prisma.checkin.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('PENDING');
  });

  it('check-in list is staff-only and supports filters', async () => {
    expect((await as().get(`/api/shelters/${shelter.id}/checkins`)).status).toBe(401);
    expect((await as(other).get(`/api/shelters/${shelter.id}/checkins`)).status).toBe(403);
    const res = await as(coord).get(`/api/shelters/${shelter.id}/checkins?status=CONFIRMED&priority=CRITICAL`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((c: any) => c.priority === 'CRITICAL' && c.status === 'CONFIRMED')).toBe(true);
  });

  it('idempotent clientRequestId: replay returns 200 duplicate and occupancy increments once', async () => {
    const s = await makeShelter(coord.id, { capacityTotal: 50 });
    const body = { personName: 'Offline', familySize: 5, clientRequestId: 'req-12345678-abcd' };
    const a = await checkin(coord, s.id, body);
    const b = await checkin(coord, s.id, body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.duplicate).toBe(true);
    expect(await occ(s.id)).toBe(5);
    expect(await prisma.checkin.count({ where: { shelterId: s.id } })).toBe(1);
  });
});
