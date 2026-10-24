import { resetDb, makeUser, makeShelter, as, prisma } from './helpers';

describe('offline check-in sync (clientRequestId idempotency)', () => {
  let coord: any, other: any, S: any, T: any;

  beforeEach(async () => {
    await resetDb();
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    S = await makeShelter(coord.id, { capacityTotal: 50 });
    T = await makeShelter(other.id, { capacityTotal: 50 });
  });
  afterAll(() => prisma.$disconnect());

  const send = (u: any, shelterId: string, id: string, size = 4) =>
    as(u).post(`/api/shelters/${shelterId}/checkin`).send({ personName: 'Queued Family', familySize: size, clientRequestId: id });
  const occ = async (id: string) => (await prisma.shelter.findUniqueOrThrow({ where: { id } })).capacityOccupied;

  it('the same clientRequestId twice creates one check-in and increments occupancy once', async () => {
    const a = await send(coord, S.id, 'offline-aaaa-0001');
    const b = await send(coord, S.id, 'offline-aaaa-0001');
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.body.duplicate).toBe(true);
    expect(b.body.checkin.id).toBe(a.body.id);
    expect(await occ(S.id)).toBe(4);
    expect(await prisma.checkin.count({ where: { shelterId: S.id } })).toBe(1);
    expect(a.body.source).toBe('OFFLINE_SYNC');
  });

  it('parallel replays (double sync) still produce exactly one check-in', async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => send(coord, S.id, 'offline-bbbb-0002', 3)));
    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await occ(S.id)).toBe(3);
    expect(await prisma.checkin.count({ where: { clientRequestId: 'offline-bbbb-0002' } })).toBe(1);
  });

  it('a queued item that no longer fits is rejected with a clear error and changes nothing', async () => {
    await send(coord, S.id, 'offline-cccc-0003', 48).then((r) => expect(r.status).toBe(201));
    const res = await send(coord, S.id, 'offline-cccc-0004', 5);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Insufficient capacity');
    expect(await occ(S.id)).toBe(48);
    expect(await prisma.checkin.count({ where: { clientRequestId: 'offline-cccc-0004' } })).toBe(0);
    // a failed item can be retried later with the same id once space exists
    const first = await prisma.checkin.findFirstOrThrow({ where: { clientRequestId: 'offline-cccc-0003' } });
    await as(coord).post(`/api/shelters/${S.id}/checkout`).send({ checkinId: first.id }).expect(200);
    expect((await send(coord, S.id, 'offline-cccc-0004', 5)).status).toBe(201);
  });

  it('a clientRequestId cannot be replayed against a different shelter', async () => {
    await send(coord, S.id, 'offline-dddd-0005').then((r) => expect(r.status).toBe(201));
    const res = await send(other, T.id, 'offline-dddd-0005');
    expect(res.status).toBe(409);
    expect(await occ(T.id)).toBe(0);
  });

  it('too-short request ids and unauthorised shelters are rejected', async () => {
    expect((await send(coord, S.id, 'short')).status).toBe(400);
    expect((await send(coord, T.id, 'offline-eeee-0006')).status).toBe(403);
  });
});
