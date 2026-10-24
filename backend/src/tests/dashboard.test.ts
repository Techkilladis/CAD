import { resetDb, makeUser, makeShelter, makeResource, as, prisma } from './helpers';

describe('dashboard scoping', () => {
  let admin: any, coord: any, vol: any, a: any, b: any;

  beforeAll(async () => {
    await resetDb();
    admin = await makeUser('ADMIN');
    coord = await makeUser('COORDINATOR');
    vol = await makeUser('VOLUNTEER');
    a = await makeShelter(coord.id, { capacityTotal: 100, capacityOccupied: 95 });
    b = await makeShelter(null, { capacityTotal: 100, capacityOccupied: 10 });
    await makeResource(a.id, 'FOOD', 5, 20);
  });
  afterAll(() => prisma.$disconnect());

  it('admin sees district totals; coordinator only own shelters; others rejected', async () => {
    const adm = await as(admin).get('/api/dashboard/district');
    expect(adm.body.totals.shelters).toBe(2);
    expect(adm.body.critical.map((s: any) => s.id)).toEqual([a.id]);
    const co = await as(coord).get('/api/dashboard/district');
    expect(co.body.totals.shelters).toBe(1);
    expect((await as(vol).get('/api/dashboard/district')).status).toBe(403);
    expect((await as().get('/api/dashboard/district')).status).toBe(401);
  });

  it('resource matrix classifies stock status and respects scope', async () => {
    const res = await as(admin).get('/api/dashboard/resources');
    const food = res.body.types.find((t: any) => t.resourceType === 'FOOD');
    expect(food.shelters[0].stockStatus).toBe('CRITICAL');
    const scoped = await as(coord).get(`/api/dashboard/resources?shelterId=${b.id}`);
    expect(scoped.body.shelters).toHaveLength(0);
  });
});
