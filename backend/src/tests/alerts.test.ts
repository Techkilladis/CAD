import { resetDb, makeUser, makeShelter, makeResource, as, prisma } from './helpers';
import { AlertService } from '../services/alert.service';
import { startAlertScheduler, stopAlertScheduler, isAlertSchedulerRunning } from '../integrations/alertScheduler';

describe('alert engine', () => {
  let admin: any, coord: any, other: any, S: any, T: any;

  beforeEach(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    other = await makeUser('COORDINATOR');
    S = await makeShelter(coord.id, { name: 'Needy', capacityTotal: 100 });
    T = await makeShelter(other.id, { name: 'Rich', capacityTotal: 100 });
  });
  afterAll(async () => {
    stopAlertScheduler();
    await prisma.$disconnect();
  });

  const active = (where: any = {}) => prisma.alertLog.findMany({ where: { status: { in: ['ACTIVE', 'ACKNOWLEDGED'] }, ...where } });

  it('LOW_STOCK dedupes per resource: two low resources => two alerts, repeated scans => no duplicates', async () => {
    await makeResource(S.id, 'WATER', 5, 20);
    await makeResource(S.id, 'FOOD', 5, 20);
    await as(admin).post('/api/alerts/run-check').expect(200);
    await as(admin).post('/api/alerts/run-check').expect(200);
    const low = await active({ alertType: 'LOW_STOCK' });
    expect(low.map((a) => a.dedupeKey).sort()).toEqual([`LOW_STOCK:${S.id}:FOOD`, `LOW_STOCK:${S.id}:WATER`]);
    expect(await prisma.alertLog.count({ where: { alertType: 'LOW_STOCK' } })).toBe(2);
    expect(low.every((a) => a.resourceType !== null)).toBe(true);
  });

  it('run-check returns counts, is admin-only and audited', async () => {
    await makeResource(S.id, 'WATER', 5, 20);
    expect((await as(coord).post('/api/alerts/run-check')).status).toBe(403);
    expect((await as().post('/api/alerts/run-check')).status).toBe(401);
    const res = await as(admin).post('/api/alerts/run-check');
    expect(res.body).toEqual({ scanned: 2, created: 1, resolved: 0 });
    expect(await prisma.auditLog.count({ where: { action: 'ALERT_RUN_CHECK', userId: admin.id } })).toBe(1);
  });

  it('alerts auto-resolve when the condition clears, and recur after clearing', async () => {
    const r = await makeResource(S.id, 'WATER', 5, 20);
    await AlertService.runGlobalCheck();
    await prisma.resource.update({ where: { id: r.id }, data: { quantity: 500 } });
    const res = await AlertService.runGlobalCheck();
    expect(res.resolved).toBe(1);
    expect(await active()).toHaveLength(0);
    await prisma.resource.update({ where: { id: r.id }, data: { quantity: 1 } });
    await AlertService.runGlobalCheck();
    expect(await prisma.alertLog.count({ where: { dedupeKey: `LOW_STOCK:${S.id}:WATER` } })).toBe(2);
    expect(await active()).toHaveLength(1);
  });

  it('overcrowding then full: severity levels, status toggles, one alert per condition', async () => {
    await prisma.shelter.update({ where: { id: S.id }, data: { capacityOccupied: 92 } });
    await AlertService.runGlobalCheck();
    expect((await active({ alertType: 'OVERCROWDING' }))[0].severity).toBe('WARNING');
    await prisma.shelter.update({ where: { id: S.id }, data: { capacityOccupied: 100 } });
    await AlertService.runGlobalCheck();
    await AlertService.runGlobalCheck();
    expect(await active({ alertType: 'FULL_SHELTER' })).toHaveLength(1);
    expect(await active({ alertType: 'OVERCROWDING' })).toHaveLength(0); // superseded by FULL
  });

  it('TRANSFER_REQUIRED names the surplus shelter, and clears once a transfer is requested', async () => {
    await makeResource(S.id, 'MEDICINE', 2, 20);
    await makeResource(T.id, 'MEDICINE', 500, 20);
    await AlertService.runGlobalCheck();
    const tr = await active({ alertType: 'TRANSFER_REQUIRED' });
    expect(tr).toHaveLength(1);
    expect(tr[0].message).toContain('Rich');
    await as(coord).post('/api/transfers').send({ fromShelterId: T.id, toShelterId: S.id, resourceType: 'MEDICINE', quantity: 50 }).expect(201);
    await AlertService.runGlobalCheck();
    expect(await active({ alertType: 'TRANSFER_REQUIRED' })).toHaveLength(0);
    expect(await active({ alertType: 'LOW_STOCK' })).toHaveLength(1); // still low until received
  });

  it('no TRANSFER_REQUIRED without a shelter that has surplus', async () => {
    await makeResource(S.id, 'MEDICINE', 2, 20);
    await makeResource(T.id, 'MEDICINE', 30, 20);
    await AlertService.runGlobalCheck();
    expect(await active({ alertType: 'TRANSFER_REQUIRED' })).toHaveLength(0);
  });

  it('acknowledge / resolve are scoped and state-guarded', async () => {
    await makeResource(S.id, 'WATER', 5, 20);
    await AlertService.runGlobalCheck();
    const a = (await active())[0];
    expect((await as(other).patch(`/api/alerts/${a.id}/acknowledge`)).status).toBe(403);
    expect((await as().patch(`/api/alerts/${a.id}/acknowledge`)).status).toBe(401);
    const ack = await as(coord).patch(`/api/alerts/${a.id}/acknowledge`);
    expect(ack.body.status).toBe('ACKNOWLEDGED');
    expect(ack.body.acknowledgedById).toBe(coord.id);
    expect((await as(coord).patch(`/api/alerts/${a.id}/acknowledge`)).status).toBe(409);
    await AlertService.runGlobalCheck();
    expect(await prisma.alertLog.count({ where: { dedupeKey: a.dedupeKey } })).toBe(1); // ack'd alert still dedupes
    expect((await as(other).patch(`/api/alerts/${a.id}/resolve`)).status).toBe(403);
    expect((await as(coord).patch(`/api/alerts/${a.id}/resolve`)).body.status).toBe('RESOLVED');
    expect((await as(coord).patch(`/api/alerts/${a.id}/resolve`)).status).toBe(409);
  });

  it('GET /alerts: public sees only full/overcrowding notices; coordinators own; admin all', async () => {
    await makeResource(S.id, 'WATER', 5, 20);
    await makeResource(T.id, 'WATER', 5, 20);
    await prisma.shelter.update({ where: { id: S.id }, data: { capacityOccupied: 100 } });
    await AlertService.runGlobalCheck();
    const pub = await as().get('/api/alerts');
    expect(pub.status).toBe(200);
    expect(pub.body.map((a: any) => a.alertType)).toEqual(['FULL_SHELTER']);
    expect(pub.body[0].message).toBeUndefined();
    expect((await as(admin).get('/api/alerts')).body.length).toBe(3);
    const mine = await as(coord).get('/api/alerts');
    expect(mine.body.every((a: any) => a.shelter.id === S.id)).toBe(true);
    expect((await as(coord).get(`/api/alerts?shelterId=${T.id}`)).status).toBe(403);
    expect((await as(admin).get('/api/alerts?type=LOW_STOCK&status=ACTIVE')).body).toHaveLength(2);
    expect((await as(admin).get('/api/alerts?type=bogus')).status).toBe(400);
  });

  it('inventory changes through the API raise and clear alerts via the same engine', async () => {
    const r = await makeResource(S.id, 'WATER', 100, 20);
    await as(coord).patch(`/api/shelters/${S.id}/resources/${r.id}`).send({ quantity: 3 }).expect(200);
    expect(await active({ alertType: 'LOW_STOCK' })).toHaveLength(1);
    await as(coord).patch(`/api/shelters/${S.id}/resources/${r.id}`).send({ quantity: 300 }).expect(200);
    expect(await active({ alertType: 'LOW_STOCK' })).toHaveLength(0);
  });
});

describe('alert scheduler', () => {
  afterEach(() => stopAlertScheduler());

  it('never starts under NODE_ENV=test', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(startAlertScheduler({ intervalMs: 60_000, run: async () => ({}) })).toBe(false);
    expect(isAlertSchedulerRunning()).toBe(false);
  });

  it('starts once outside test mode, ignores a second start and invalid intervals, and stops', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(startAlertScheduler({ intervalMs: 0 })).toBe(false);
      expect(startAlertScheduler({ intervalMs: 500 })).toBe(false);
      expect(startAlertScheduler({ intervalMs: 60_000, run: async () => ({}) })).toBe(true);
      expect(startAlertScheduler({ intervalMs: 60_000, run: async () => ({}) })).toBe(false);
      expect(isAlertSchedulerRunning()).toBe(true);
      stopAlertScheduler();
      expect(isAlertSchedulerRunning()).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
