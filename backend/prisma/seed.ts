import { PrismaClient, Role, ResourceType, ShelterStatus, CheckinStatus, AlertType, AlertStatus, TransferStatus, ReunificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data...');
  // Clear in correct order due to foreign keys
  await prisma.auditLog.deleteMany();
  await prisma.reunificationCase.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.volunteerAssignment.deleteMany();
  await prisma.volunteerShift.deleteMany();
  await prisma.alertLog.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding users...');
  
  const admin1 = await prisma.user.create({
    data: { name: 'Admin One', email: 'admin1@safehaven.local', role: Role.ADMIN }
  });
  const admin2 = await prisma.user.create({
    data: { name: 'Admin Two', email: 'admin2@safehaven.local', role: Role.ADMIN }
  });

  const coord1 = await prisma.user.create({
    data: { name: 'Alice Smith', email: 'alice@safehaven.local', role: Role.COORDINATOR }
  });
  const coord2 = await prisma.user.create({
    data: { name: 'Bob Jones', email: 'bob@safehaven.local', role: Role.COORDINATOR }
  });
  const coord3 = await prisma.user.create({
    data: { name: 'Charlie Davis', email: 'charlie@safehaven.local', role: Role.COORDINATOR }
  });

  const vol1 = await prisma.user.create({
    data: { name: 'Valerie Volunteer', email: 'valerie@safehaven.local', role: Role.VOLUNTEER }
  });
  const vol2 = await prisma.user.create({
    data: { name: 'Victor Vance', email: 'victor@safehaven.local', role: Role.VOLUNTEER }
  });

  console.log('Seeding shelters & resources...');
  const shelterData = [
    {
      name: 'Downtown Community Center',
      address: '100 Main St, Metropolis',
      latitude: 34.0522, longitude: -118.2437,
      capacityTotal: 200, capacityOccupied: 150,
      coordinatorId: coord1.id, status: ShelterStatus.ACTIVE,
      description: 'Main downtown relief center', contactInfo: '555-0101', supportedLanguages: '["English", "Spanish"]'
    },
    {
      name: 'Westside High School',
      address: '250 School Way, Metropolis',
      latitude: 34.0622, longitude: -118.2537,
      capacityTotal: 300, capacityOccupied: 300,
      coordinatorId: coord2.id, status: ShelterStatus.FULL,
      description: 'Gymnasium shelter', contactInfo: '555-0102', supportedLanguages: '["English"]'
    },
    {
      name: 'East District YMCA',
      address: '400 East Blvd, Metropolis',
      latitude: 34.0422, longitude: -118.2337,
      capacityTotal: 100, capacityOccupied: 40,
      coordinatorId: coord3.id, status: ShelterStatus.ACTIVE,
      description: 'Recreation center', contactInfo: '555-0103', supportedLanguages: '["English", "Mandarin"]'
    },
    {
      name: 'Northgate Church',
      address: '800 North Ave, Metropolis',
      latitude: 34.0822, longitude: -118.2637,
      capacityTotal: 150, capacityOccupied: 10,
      coordinatorId: admin1.id, status: ShelterStatus.ACTIVE,
      description: 'Church basement', contactInfo: '555-0104', supportedLanguages: '["English"]'
    },
    {
      name: 'Southside Arena',
      address: '1500 South Pkwy, Metropolis',
      latitude: 34.0122, longitude: -118.2737,
      capacityTotal: 1000, capacityOccupied: 0,
      coordinatorId: null, status: ShelterStatus.INACTIVE,
      description: 'Mass emergency shelter (Inactive)', contactInfo: '555-0105', supportedLanguages: '["English", "Spanish", "Vietnamese"]'
    }
  ];

  const shelters = [];
  for (const s of shelterData) {
    const shelter = await prisma.shelter.create({ data: s });
    shelters.push(shelter);

    // Seed resources
    const resourceTypes = [ResourceType.FOOD, ResourceType.WATER, ResourceType.MEDICINE, ResourceType.BLANKETS];
    const units = ['Meals', 'Liters', 'Doses', 'Items'];
    for (let i = 0; i < 4; i++) {
      let quantity = 500;
      if (s.status === ShelterStatus.INACTIVE) quantity = 0;
      if (s.status === ShelterStatus.FULL && i === 2) quantity = 5; // Low medicine for full shelter
      
      await prisma.resource.create({
        data: {
          shelterId: shelter.id,
          resourceType: resourceTypes[i],
          quantity: quantity,
          unit: units[i],
          lowStockThreshold: 50
        }
      });
    }
  }

  console.log('Seeding checkins...');
  await prisma.checkin.create({
    data: {
      shelterId: shelters[0].id,
      personName: 'Johnson Family',
      familySize: 4,
      status: CheckinStatus.CONFIRMED,
      elderlyCount: 1, childrenCount: 2, medicalFlag: true, emergencyNotes: 'Diabetic'
    }
  });
  await prisma.checkin.create({
    data: {
      shelterId: shelters[0].id,
      personName: 'Maria Garcia',
      familySize: 1,
      status: CheckinStatus.CONFIRMED,
      pregnantFlag: true, medicalFlag: true
    }
  });
  await prisma.checkin.create({
    data: {
      shelterId: shelters[1].id,
      personName: 'Smith Family',
      familySize: 5,
      status: CheckinStatus.CONFIRMED,
      childrenCount: 3
    }
  });

  console.log('Seeding transfers...');
  await prisma.transfer.create({
    data: {
      fromShelterId: shelters[0].id,
      toShelterId: shelters[1].id,
      resourceType: ResourceType.MEDICINE,
      quantity: 100,
      status: TransferStatus.PENDING,
      requestedById: coord2.id,
    }
  });
  await prisma.transfer.create({
    data: {
      fromShelterId: shelters[2].id,
      toShelterId: shelters[0].id,
      resourceType: ResourceType.BLANKETS,
      quantity: 50,
      status: TransferStatus.APPROVED,
      requestedById: coord1.id,
      approvedById: admin1.id
    }
  });
  await prisma.transfer.create({
    data: {
      fromShelterId: shelters[0].id,
      toShelterId: shelters[3].id,
      resourceType: ResourceType.FOOD,
      quantity: 200,
      status: TransferStatus.IN_TRANSIT,
      requestedById: admin1.id,
      approvedById: admin2.id
    }
  });

  console.log('Seeding alerts...');
  await prisma.alertLog.create({
    data: {
      shelterId: shelters[1].id,
      alertType: AlertType.FULL_SHELTER,
      status: AlertStatus.ACTIVE,
      message: 'Shelter has reached maximum capacity.'
    }
  });
  await prisma.alertLog.create({
    data: {
      shelterId: shelters[1].id,
      alertType: AlertType.LOW_STOCK,
      status: AlertStatus.ACTIVE,
      message: 'Critical shortage of MEDICINE.'
    }
  });
  await prisma.alertLog.create({
    data: {
      shelterId: shelters[0].id,
      alertType: AlertType.CRITICAL_MEDICAL_NEED,
      status: AlertStatus.ACKNOWLEDGED,
      message: 'Multiple occupants require urgent medical attention.'
    }
  });

  console.log('Seeding volunteer shifts...');
  const shift1 = await prisma.volunteerShift.create({
    data: {
      shelterId: shelters[0].id,
      startTime: new Date(Date.now() + 86400000), // Tomorrow
      endTime: new Date(Date.now() + 86400000 + 14400000), // +4 hours
      requiredCount: 5
    }
  });
  await prisma.volunteerAssignment.create({
    data: { shiftId: shift1.id, volunteerId: vol1.id }
  });

  console.log('Seeding donations...');
  await prisma.donation.create({
    data: {
      shelterId: shelters[0].id,
      donorName: 'Local Supermarket',
      resourceType: ResourceType.FOOD,
      quantity: 1000,
      unit: 'Meals',
      notes: 'Bulk donation of non-perishables'
    }
  });

  console.log('Seeding reunification cases...');
  await prisma.reunificationCase.create({
    data: {
      missingPersonName: 'Timmy Johnson',
      age: 8,
      gender: 'Male',
      lastKnownLocation: 'Downtown',
      contactPerson: 'Mr. Johnson',
      contactInfo: '555-9999',
      status: ReunificationStatus.MISSING
    }
  });
  await prisma.reunificationCase.create({
    data: {
      missingPersonName: 'Sarah Davis',
      age: 35,
      gender: 'Female',
      lastKnownLocation: 'East District',
      contactPerson: 'John Davis',
      contactInfo: '555-8888',
      status: ReunificationStatus.REUNITED
    }
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
