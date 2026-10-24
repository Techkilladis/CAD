import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { TransferStatus } from '@prisma/client';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shelters = await prisma.shelter.findMany();
    const totalShelters = shelters.length;
    const totalCapacity = shelters.reduce((acc, s) => acc + s.capacityTotal, 0);
    const totalOccupied = shelters.reduce((acc, s) => acc + s.capacityOccupied, 0);
    const totalAvailableCapacity = totalCapacity - totalOccupied;

    const overcrowdedShelters = shelters.filter(s => (s.capacityOccupied / s.capacityTotal) >= 0.9);

    const allAlerts = await prisma.alertLog.findMany({
      where: { status: 'ACTIVE' },
      include: { shelter: true },
      orderBy: { triggeredAt: 'desc' }
    });

    const pendingTransfers = await prisma.transfer.findMany({
      where: { status: TransferStatus.PENDING },
      include: { fromShelter: true, toShelter: true, requestedBy: true }
    });
    
    const inTransitTransfers = await prisma.transfer.findMany({
      where: { status: TransferStatus.IN_TRANSIT },
      include: { fromShelter: true, toShelter: true, requestedBy: true }
    });

    // Resource summary could aggregate all resources
    const resources = await prisma.resource.findMany();
    const resourceSummary = resources.reduce((acc: any, r) => {
      acc[r.resourceType] = (acc[r.resourceType] || 0) + r.quantity;
      return acc;
    }, {});
    
    const reunificationCases = await prisma.reunificationCase.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      shelters,
      totalShelters,
      totalCapacity,
      totalOccupied,
      totalAvailableCapacity,
      overcrowdedShelters,
      allAlerts,
      pendingTransfers,
      inTransitTransfers,
      resourceSummary,
      reunificationCases
    });
  } catch (error) {
    next(error);
  }
};
