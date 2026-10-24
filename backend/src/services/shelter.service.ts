import prisma from '../config/prisma';
import { calculateDistance } from '../utils/haversine';
import { AlertType } from '@prisma/client';

export class ShelterService {
  static async getAllShelters() {
    const shelters = await prisma.shelter.findMany({
      include: { resources: true },
    });
    return shelters.map(s => ({
      ...s,
      availableCapacity: s.capacityTotal - s.capacityOccupied
    }));
  }

  static async getNearestShelters(lat: number, lon: number) {
    const shelters = await prisma.shelter.findMany({
      include: { resources: true }
    });

    const sheltersWithDistance = shelters.map(shelter => {
      const distance = calculateDistance(lat, lon, shelter.latitude, shelter.longitude);
      return {
        ...shelter,
        distance,
        availableCapacity: shelter.capacityTotal - shelter.capacityOccupied
      };
    });

    sheltersWithDistance.sort((a, b) => a.distance - b.distance);
    return sheltersWithDistance;
  }

  static async getShelterById(id: string) {
    const shelter = await prisma.shelter.findUnique({
      where: { id },
      include: { resources: true, checkins: { where: { checkedOutAt: null } } }
    });
    if (!shelter) return null;
    return {
      ...shelter,
      availableCapacity: shelter.capacityTotal - shelter.capacityOccupied
    };
  }

  static async createShelter(data: any) {
    return prisma.shelter.create({ data });
  }

  static async updateShelter(id: string, data: any) {
    return prisma.shelter.update({
      where: { id },
      data
    });
  }

  static async register(shelterId: string, data: any) {
    return prisma.$transaction(async (tx) => {
      const shelter = await tx.shelter.findUnique({ where: { id: shelterId } });
      if (!shelter) throw new Error('Shelter not found');

      const availableCapacity = shelter.capacityTotal - shelter.capacityOccupied;
      if (availableCapacity < data.familySize) {
        throw { statusCode: 400, message: 'Insufficient capacity for this registration' };
      }

      return tx.checkin.create({
        data: { 
          shelterId, 
          personName: data.personName, 
          familySize: data.familySize, 
          medicalFlag: data.medicalFlag || false,
          elderlyCount: data.elderlyCount || 0,
          pregnantFlag: data.pregnantFlag || false,
          disabledFlag: data.disabledFlag || false,
          childrenCount: data.childrenCount || 0,
          emergencyNotes: data.emergencyNotes || '',
          status: 'PENDING'
        }
      });
    });
  }

  static async confirmCheckin(shelterId: string, checkinId: string) {
    return prisma.$transaction(async (tx) => {
      const checkin = await tx.checkin.findUnique({ where: { id: checkinId } });
      if (!checkin || checkin.shelterId !== shelterId) throw new Error('Checkin not found');
      if (checkin.status !== 'PENDING') throw new Error('Checkin is not pending');

      const shelter = await tx.shelter.findUnique({ where: { id: shelterId } });
      if (!shelter) throw new Error('Shelter not found');

      const availableCapacity = shelter.capacityTotal - shelter.capacityOccupied;
      if (availableCapacity < checkin.familySize) {
        throw { statusCode: 400, message: 'Insufficient capacity to confirm' };
      }

      const updatedCheckin = await tx.checkin.update({
        where: { id: checkinId },
        data: { status: 'CONFIRMED' }
      });

      const updatedShelter = await tx.shelter.update({
        where: { id: shelterId },
        data: { 
          capacityOccupied: shelter.capacityOccupied + checkin.familySize,
          status: (shelter.capacityOccupied + checkin.familySize >= shelter.capacityTotal) ? 'FULL' : shelter.status
        }
      });

      // Overcrowding check
      const occupancyRate = updatedShelter.capacityOccupied / updatedShelter.capacityTotal;
      if (occupancyRate >= 0.9 && occupancyRate < 1.0) {
        await tx.alertLog.create({
          data: { shelterId, alertType: AlertType.OVERCROWDING, notifiedVia: 'SYSTEM' }
        });
      } else if (occupancyRate >= 1.0) {
        await tx.alertLog.create({
          data: { shelterId, alertType: AlertType.FULL_SHELTER, notifiedVia: 'SYSTEM' }
        });
      }

      return updatedCheckin;
    });
  }

  static async checkIn(shelterId: string, data: any) {
    return prisma.$transaction(async (tx) => {
      const shelter = await tx.shelter.findUnique({ where: { id: shelterId } });
      if (!shelter) throw new Error('Shelter not found');

      const availableCapacity = shelter.capacityTotal - shelter.capacityOccupied;
      if (availableCapacity < data.familySize) {
        throw { statusCode: 400, message: 'Insufficient capacity' };
      }

      const checkin = await tx.checkin.create({
        data: { 
          shelterId, 
          personName: data.personName, 
          familySize: data.familySize, 
          medicalFlag: data.medicalFlag || false,
          elderlyCount: data.elderlyCount || 0,
          pregnantFlag: data.pregnantFlag || false,
          disabledFlag: data.disabledFlag || false,
          childrenCount: data.childrenCount || 0,
          emergencyNotes: data.emergencyNotes || '',
          status: 'CONFIRMED'
        }
      });

      const updatedShelter = await tx.shelter.update({
        where: { id: shelterId },
        data: { 
          capacityOccupied: shelter.capacityOccupied + data.familySize,
          status: (shelter.capacityOccupied + data.familySize >= shelter.capacityTotal) ? 'FULL' : shelter.status
        }
      });

      // Overcrowding check
      const occupancyRate = updatedShelter.capacityOccupied / updatedShelter.capacityTotal;
      if (occupancyRate >= 0.9 && occupancyRate < 1.0) {
        await tx.alertLog.create({
          data: {
            shelterId,
            alertType: AlertType.OVERCROWDING,
            notifiedVia: 'SYSTEM'
          }
        });
      } else if (occupancyRate >= 1.0) {
        await tx.alertLog.create({
          data: {
            shelterId,
            alertType: AlertType.FULL_SHELTER,
            notifiedVia: 'SYSTEM'
          }
        });
      }

      return checkin;
    });
  }

  static async checkOut(shelterId: string, checkinId: string, familySize: number) {
    return prisma.$transaction(async (tx) => {
      const shelter = await tx.shelter.findUnique({ where: { id: shelterId } });
      if (!shelter) throw new Error('Shelter not found');

      if (shelter.capacityOccupied - familySize < 0) {
        throw { statusCode: 400, message: 'Occupancy cannot be negative' };
      }

      const updatedCheckin = await tx.checkin.update({
        where: { id: checkinId },
        data: { checkedOutAt: new Date(), status: 'CHECKED_OUT' }
      });

      const newOccupied = shelter.capacityOccupied - familySize;
      await tx.shelter.update({
        where: { id: shelterId },
        data: { 
          capacityOccupied: newOccupied,
          status: (shelter.status === 'FULL' && newOccupied < shelter.capacityTotal) ? 'ACTIVE' : shelter.status
        }
      });

      return updatedCheckin;
    });
  }

  static async getResources(shelterId: string) {
    return prisma.resource.findMany({ where: { shelterId } });
  }

  static async updateResource(shelterId: string, resourceId: string, quantity: number) {
    return prisma.$transaction(async (tx) => {
      const resource = await tx.resource.update({
        where: { id: resourceId },
        data: { quantity }
      });

      if (resource.quantity <= resource.lowStockThreshold) {
        await tx.alertLog.create({
          data: {
            shelterId,
            alertType: AlertType.LOW_STOCK,
            notifiedVia: 'SYSTEM'
          }
        });
      }

      return resource;
    });
  }
}
