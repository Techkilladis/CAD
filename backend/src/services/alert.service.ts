import prisma from '../config/prisma';
import { AlertType, AlertStatus, ShelterStatus } from '@prisma/client';

export class AlertService {
  static async runGlobalCheck() {
    const shelters = await prisma.shelter.findMany({
      include: { resources: true, checkins: { where: { status: 'CONFIRMED' } } }
    });

    let newAlerts = 0;

    for (const shelter of shelters) {
      // 1. Capacity Checks
      const occupancyRate = shelter.capacityOccupied / shelter.capacityTotal;
      if (occupancyRate >= 1.0) {
        if (shelter.status !== ShelterStatus.FULL) {
          await prisma.shelter.update({ where: { id: shelter.id }, data: { status: ShelterStatus.FULL }});
        }
        await this.createOrUpdateAlert(shelter.id, AlertType.FULL_SHELTER, 'Shelter is completely full.');
      } else if (occupancyRate >= 0.9) {
        await this.createOrUpdateAlert(shelter.id, AlertType.OVERCROWDING, 'Shelter is nearing maximum capacity.');
      }

      // 2. Resource Checks
      for (const res of shelter.resources) {
        if (res.quantity <= res.lowStockThreshold) {
          await this.createOrUpdateAlert(
            shelter.id, 
            AlertType.LOW_STOCK, 
            `Critical shortage of ${res.resourceType}. Current: ${res.quantity} ${res.unit}`
          );
        }
      }

      // 3. Medical Needs
      const medicalCheckins = shelter.checkins.filter(c => c.medicalFlag || c.pregnantFlag || c.disabledFlag);
      if (medicalCheckins.length >= 5) {
        await this.createOrUpdateAlert(
          shelter.id, 
          AlertType.CRITICAL_MEDICAL_NEED, 
          `High volume of occupants with medical needs (${medicalCheckins.length}).`
        );
      }
    }

    return { success: true, message: 'Global alert check completed.' };
  }

  private static async createOrUpdateAlert(shelterId: string, alertType: AlertType, message: string) {
    const existing = await prisma.alertLog.findFirst({
      where: { shelterId, alertType, status: AlertStatus.ACTIVE }
    });

    if (!existing) {
      await prisma.alertLog.create({
        data: {
          shelterId,
          alertType,
          message,
          status: AlertStatus.ACTIVE,
          notifiedVia: 'SYSTEM'
        }
      });
    }
  }

  static async acknowledgeAlert(alertId: string) {
    return prisma.alertLog.update({
      where: { id: alertId },
      data: { acknowledged: true, status: AlertStatus.ACKNOWLEDGED }
    });
  }

  static async resolveAlert(alertId: string) {
    return prisma.alertLog.update({
      where: { id: alertId },
      data: { status: AlertStatus.RESOLVED }
    });
  }
}
