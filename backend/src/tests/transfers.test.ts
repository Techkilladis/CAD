import { resetDb, makeUser, makeShelter, makeResource, as, prisma } from './helpers';

describe('transfer workflow', () => {
  let admin: any, admin2: any, coordA: any, coordB: any, coordC: any, A: any, B: any, C: any, resA: any;

  const qty = async (shelterId: string, type: any = 'WATER') =>
    (await prisma.resource.findFirstOrThrow({ where: { shelterId, resourceType: type } })).quantity;
  const request = (u: any, from: any, to: any, quantity: number, type = 'WATER') =>
    as(u).post('/api/transfers').send({ fromShelterId: from.id, toShelterId: to.id, resourceType: type, quantity });

  beforeEach(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    admin2 = await makeUser('ADMIN');
    coordA = await makeUser('COORDINATOR');
    coordB = await makeUser('COORDINATOR');
    coordC = await makeUser('COORDINATOR');
    A = await makeShelter(coordA.id);
    B = await makeShelter(coordB.id);
    C = await makeShelter(coordC.id);
    resA = await makeResource(A.id, 'WATER', 100, 20);
    await makeResource(B.id, 'WATER', 10, 20);
  });
  afterAll(() => prisma.$disconnect());

  it('full lifecycle moves stock exactly once at each step', async () => {
    const created = await request(coordB, A, B, 30); // B requests from A
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(created.body.actions.cancel).toBe(true);
    expect(await qty(A.id)).toBe(100); // pending: nothing moves

    const approved = await as(admin).patch(`/api/transfers/${id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.approvedById).toBe(admin.id);
    expect(await qty(A.id)).toBe(70);
    expect(await qty(B.id)).toBe(10);

    // coordinator cannot approve; destination cannot dispatch
    expect((await as(coordA).patch(`/api/transfers/${id}/approve`)).status).toBe(403);
    expect((await as(coordB).patch(`/api/transfers/${id}/transit`)).status).toBe(403);
    expect((await as(coordB).patch(`/api/transfers/${id}/received`)).status).toBe(400); // not in transit yet

    expect((await as(coordA).patch(`/api/transfers/${id}/transit`)).body.status).toBe('IN_TRANSIT');
    expect((await as(coordA).patch(`/api/transfers/${id}/received`)).status).toBe(403); // source cannot receive
    const received = await as(coordB).patch(`/api/transfers/${id}/received`);
    expect(received.status).toBe(200);
    expect(received.body.status).toBe('RECEIVED');
    expect(await qty(B.id)).toBe(40);
    expect(await qty(A.id)).toBe(70);

    // replays are rejected and change nothing
    expect((await as(coordB).patch(`/api/transfers/${id}/received`)).status).toBe(400);
    expect((await as(admin).patch(`/api/transfers/${id}/approve`)).status).toBe(400);
    expect(await qty(B.id)).toBe(40);

    const moves = await prisma.stockMovement.findMany({ where: { referenceId: id }, orderBy: { createdAt: 'asc' } });
    expect(moves.map((m) => [m.type, m.delta])).toEqual([['TRANSFER_OUT', -30], ['TRANSFER_IN', 30]]);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['TRANSFER_REQUEST', 'TRANSFER_APPROVE', 'TRANSFER_TRANSIT', 'TRANSFER_RECEIVE']));
  });

  it('receiving creates the resource at a destination that lacks it', async () => {
    const t = (await request(coordA, A, C, 10)).body;
    await as(admin).patch(`/api/transfers/${t.id}/approve`).expect(200);
    await as(coordA).patch(`/api/transfers/${t.id}/transit`).expect(200);
    await as(coordC).patch(`/api/transfers/${t.id}/receive`).expect(200); // legacy alias
    expect(await qty(C.id)).toBe(10);
  });

  it('requester cannot approve own request; approver is always the authenticated admin', async () => {
    const t = (await request(admin, A, B, 5)).body;
    expect((await as(admin).patch(`/api/transfers/${t.id}/approve`)).status).toBe(403);
    const ok = await as(admin2).patch(`/api/transfers/${t.id}/approve`).send({ approvedById: admin.id });
    expect(ok.body.approvedById).toBe(admin2.id);
  });

  it('coordinators cannot use foreign shelters as source or destination', async () => {
    expect((await request(coordC, A, B, 5)).status).toBe(403);
    expect((await request(coordA, A, A, 5)).status).toBe(400);
    expect((await request(coordA, A, B, 0)).status).toBe(400);
    expect((await as().post('/api/transfers').send({})).status).toBe(401);
    const vol = await makeUser('VOLUNTEER');
    expect((await request(vol, A, B, 5)).status).toBe(403);
  });

  it('pending requests reserve stock so source cannot be over-committed', async () => {
    expect((await request(coordA, A, B, 80)).status).toBe(201);
    const second = await request(coordA, A, C, 30);
    expect(second.status).toBe(400);
    expect(second.body.error).toBe('Insufficient resource quantity at source shelter');
    expect((await request(coordA, A, C, 20)).status).toBe(201);
  });

  it('approval fails cleanly when stock dropped after the request', async () => {
    const t = (await request(coordA, A, B, 60)).body;
    await prisma.resource.update({ where: { id: resA.id }, data: { quantity: 10 } });
    const res = await as(admin).patch(`/api/transfers/${t.id}/approve`);
    expect(res.status).toBe(400);
    expect(await qty(A.id)).toBe(10);
    expect((await prisma.transfer.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('PENDING');
  });

  it('concurrent approvals deduct stock only once', async () => {
    const t = (await request(coordA, A, B, 40)).body;
    const results = await Promise.all([
      as(admin).patch(`/api/transfers/${t.id}/approve`),
      as(admin2).patch(`/api/transfers/${t.id}/approve`),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await qty(A.id)).toBe(60);
  });

  it('reject: admin only, pending only, no stock change, reason stored', async () => {
    const t = (await request(coordA, A, B, 10)).body;
    expect((await as(coordA).patch(`/api/transfers/${t.id}/reject`)).status).toBe(403);
    const r = await as(admin).patch(`/api/transfers/${t.id}/reject`).send({ reason: 'Not needed' });
    expect(r.body.status).toBe('REJECTED');
    expect(r.body.rejectionReason).toBe('Not needed');
    expect(await qty(A.id)).toBe(100);
    expect((await as(admin).patch(`/api/transfers/${t.id}/reject`)).status).toBe(400);
  });

  it('cancel: pending by requester has no stock effect; approved restores source exactly once', async () => {
    const p = (await request(coordB, A, B, 10)).body;
    expect((await as(coordC).patch(`/api/transfers/${p.id}/cancel`)).status).toBe(403);
    expect((await as(coordB).patch(`/api/transfers/${p.id}/cancel`)).body.status).toBe('CANCELLED');
    expect(await qty(A.id)).toBe(100);
    expect((await as(coordB).patch(`/api/transfers/${p.id}/cancel`)).status).toBe(409);

    const t = (await request(coordB, A, B, 25)).body;
    await as(admin).patch(`/api/transfers/${t.id}/approve`).expect(200);
    expect(await qty(A.id)).toBe(75);
    expect((await as(coordB).patch(`/api/transfers/${t.id}/cancel`)).status).toBe(403); // only admin after approval
    await as(admin).patch(`/api/transfers/${t.id}/cancel`).expect(200);
    expect(await qty(A.id)).toBe(100);
    expect((await as(admin).patch(`/api/transfers/${t.id}/cancel`)).status).toBe(409);
    expect(await qty(A.id)).toBe(100);
    const ret = await prisma.stockMovement.findMany({ where: { referenceId: t.id, type: 'TRANSFER_RETURN' } });
    expect(ret).toHaveLength(1);
  });

  it('received transfers cannot be cancelled', async () => {
    const t = (await request(coordA, A, B, 5)).body;
    await as(admin).patch(`/api/transfers/${t.id}/approve`);
    await as(coordA).patch(`/api/transfers/${t.id}/transit`);
    await as(coordB).patch(`/api/transfers/${t.id}/received`);
    expect((await as(admin).patch(`/api/transfers/${t.id}/cancel`)).status).toBe(400);
  });

  it('listing and detail are scoped to involved shelters', async () => {
    const ab = (await request(coordA, A, B, 5)).body;
    await request(coordC, C, A, 5, 'WATER').catch(() => null); // C has no stock: rejected, ignore
    expect((await as(admin).get('/api/transfers')).body).toHaveLength(1);
    expect((await as(coordB).get('/api/transfers')).body).toHaveLength(1);
    expect((await as(coordC).get('/api/transfers')).body).toHaveLength(0);
    expect((await as(coordC).get(`/api/transfers/${ab.id}`)).status).toBe(403);
    expect((await as(coordB).get(`/api/transfers/${ab.id}`)).status).toBe(200);
    expect((await as(coordB).get(`/api/transfers?shelterId=${B.id}&direction=incoming`)).body).toHaveLength(1);
    expect((await as(coordB).get(`/api/transfers?shelterId=${B.id}&direction=outgoing`)).body).toHaveLength(0);
    expect((await as(coordB).get(`/api/transfers?shelterId=${A.id}`)).status).toBe(403);
    expect((await as(admin).get('/api/transfers?status=APPROVED')).body).toHaveLength(0);
    expect((await as().get('/api/transfers')).status).toBe(401);
  });

  it('approval re-evaluates alerts at the source (low stock appears)', async () => {
    const t = (await request(coordA, A, B, 90)).body;
    await as(admin).patch(`/api/transfers/${t.id}/approve`).expect(200);
    expect(await prisma.alertLog.count({ where: { shelterId: A.id, alertType: 'LOW_STOCK', status: 'ACTIVE' } })).toBe(1);
  });
});
