import { resetDb, makeUser, as, prisma } from './helpers';

describe('auth & users', () => {
  beforeAll(resetDb);
  afterAll(() => prisma.$disconnect());

  it('public user picker exposes only id, name and role', async () => {
    await makeUser('ADMIN', 'Ann Admin');
    const res = await as().get('/api/auth/users');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'name', 'role']);
  });

  it('/auth/me requires a valid user and returns managed shelters', async () => {
    expect((await as().get('/api/auth/me')).status).toBe(401);
    expect((await as({ id: 'nope' }).get('/api/auth/me')).status).toBe(401);
    const coord = await makeUser('COORDINATOR');
    await prisma.shelter.create({
      data: { name: 'S', address: 'a', latitude: 1, longitude: 1, capacityTotal: 10, coordinatorId: coord.id },
    });
    const res = await as(coord).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.managedShelters).toHaveLength(1);
  });

  it('inactive users are rejected', async () => {
    const u = await makeUser('COORDINATOR', 'Gone', { isActive: false });
    expect((await as(u).get('/api/auth/me')).status).toBe(401);
  });

  it('PATCH /auth/me updates own profile and validates input', async () => {
    const v = await makeUser('VOLUNTEER');
    const ok = await as(v).patch('/api/auth/me').send({ phone: '99999', skills: 'First aid' });
    expect(ok.status).toBe(200);
    expect(ok.body.skills).toBe('First aid');
    const bad = await as(v).patch('/api/auth/me').send({ name: '' });
    expect(bad.status).toBe(400);
  });
});
