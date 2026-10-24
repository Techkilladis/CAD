import request from 'supertest';
import app from '../server';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';

describe('SafeHaven API Integration Tests', () => {
  let testShelterId: string;
  let testResourceId: string;
  let testCheckinId: string;
  let testTransferId: string;
  let secondShelterId: string;
  let coordinatorId: string;
  let adminId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.alertLog.deleteMany();
    await prisma.transfer.deleteMany();
    await prisma.checkin.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.volunteerAssignment.deleteMany();
    await prisma.volunteerShift.deleteMany();
    await prisma.reunificationCase.deleteMany();
    await prisma.donation.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.shelter.deleteMany();
    await prisma.user.deleteMany();

    const coordinator = await prisma.user.create({
      data: { name: 'Test Coordinator', email: 'coord@test.local', role: Role.COORDINATOR }
    });
    coordinatorId = coordinator.id;

    const admin = await prisma.user.create({
      data: { name: 'Test Admin', email: 'admin@test.local', role: Role.ADMIN }
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Shelter creation', async () => {
    const res = await request(app).post('/api/shelters')
      .set('x-user-id', adminId)
      .send({
        name: 'Test Shelter 1',
        address: '123 Test Ave',
        latitude: 10.0,
        longitude: 20.0,
        capacityTotal: 100,
        coordinatorId: coordinatorId
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Shelter 1');
    testShelterId = res.body.id;
    
    const res2 = await request(app).post('/api/shelters')
      .set('x-user-id', adminId)
      .send({
        name: 'Test Shelter 2',
        address: '456 Test Blvd',
        latitude: 10.1,
        longitude: 20.1,
        capacityTotal: 50,
        coordinatorId: coordinatorId
      });
    secondShelterId = res2.body.id;
  });

  it('2. Shelter search', async () => {
    const res = await request(app).get('/api/shelters');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('3. Nearest shelter calculation', async () => {
    const res = await request(app).get('/api/shelters/nearest?latitude=10.05&longitude=20.05');
    expect(res.status).toBe(200);
    expect(res.body[0].distance).toBeDefined();
    expect(res.body[0].distance).toBeLessThanOrEqual(res.body[1].distance);
  });

  it('4. Check-in', async () => {
    const res = await request(app).post(`/api/shelters/${testShelterId}/checkin`)
      .set('x-user-id', coordinatorId)
      .send({
        personName: 'John Doe',
        familySize: 3,
        medicalFlag: false
      });
    expect(res.status).toBe(201);
    expect(res.body.familySize).toBe(3);
    testCheckinId = res.body.id;
  });

  it('5. Check-out', async () => {
    const res = await request(app).post(`/api/shelters/${testShelterId}/checkout`)
      .set('x-user-id', coordinatorId)
      .send({
        checkinId: testCheckinId,
        familySize: 3
      });
    expect(res.status).toBe(200);
    expect(res.body.checkedOutAt).not.toBeNull();
  });

  it('6. Capacity validation (Exceeds capacity)', async () => {
    const res = await request(app).post(`/api/shelters/${secondShelterId}/checkin`)
      .set('x-user-id', coordinatorId)
      .send({
        personName: 'Large Family',
        familySize: 100 // Second shelter only has 50 capacity
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Insufficient capacity');
  });

  it('7. Overcrowding check', async () => {
    await request(app).post(`/api/shelters/${secondShelterId}/checkin`)
      .set('x-user-id', coordinatorId)
      .send({
        personName: 'Big Group',
        familySize: 45
      });
    const alerts = await prisma.alertLog.findMany({ where: { shelterId: secondShelterId, alertType: 'OVERCROWDING' } });
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('8. Resource update & Low-stock detection', async () => {
    const resource = await prisma.resource.create({
      data: {
        shelterId: testShelterId,
        resourceType: 'WATER',
        quantity: 100,
        unit: 'liters',
        lowStockThreshold: 20
      }
    });
    testResourceId = resource.id;

    const res = await request(app).patch(`/api/shelters/${testShelterId}/resources/${testResourceId}`)
      .set('x-user-id', coordinatorId)
      .send({
        quantity: 10
      });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(10);

    const alerts = await prisma.alertLog.findMany({ where: { shelterId: testShelterId, alertType: 'LOW_STOCK' } });
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('9. Transfer validation (same source/destination)', async () => {
    const res = await request(app).post('/api/transfers')
      .set('x-user-id', coordinatorId)
      .send({
        fromShelterId: testShelterId,
        toShelterId: testShelterId,
        resourceType: 'WATER',
        quantity: 5
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Source and destination must be different');
  });

  it('10. Transfer validation (insufficient quantity)', async () => {
    const res = await request(app).post('/api/transfers')
      .set('x-user-id', coordinatorId)
      .send({
        fromShelterId: testShelterId,
        toShelterId: secondShelterId,
        resourceType: 'WATER',
        quantity: 500
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Insufficient resource quantity at source shelter');
  });

  it('11. Transfer creation', async () => {
    const res = await request(app).post('/api/transfers')
      .set('x-user-id', coordinatorId)
      .send({
        fromShelterId: testShelterId,
        toShelterId: secondShelterId,
        resourceType: 'WATER',
        quantity: 5
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    testTransferId = res.body.id;
  });

  it('12. Transfer approval', async () => {
    const res = await request(app).patch(`/api/transfers/${testTransferId}/approve`)
      .set('x-user-id', adminId)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.approvedById).toBe(adminId);
    
    const sourceRes = await prisma.resource.findUnique({ where: { id: testResourceId } });
    expect(sourceRes?.quantity).toBe(5);
  });
});
