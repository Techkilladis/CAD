import prisma from '../config/prisma';
import { TransferStatus, ResourceType } from '@prisma/client';

export class TransferService {
  static async createTransfer(data: { fromShelterId: string; toShelterId: string; resourceType: ResourceType; quantity: number; requestedById: string }) {
    if (data.fromShelterId === data.toShelterId) {
      throw { statusCode: 400, message: 'Source and destination must be different' };
    }

    if (data.quantity <= 0) {
      throw { statusCode: 400, message: 'Quantity must be positive' };
    }

    const sourceResource = await prisma.resource.findFirst({
      where: { shelterId: data.fromShelterId, resourceType: data.resourceType }
    });

    if (!sourceResource || sourceResource.quantity < data.quantity) {
      throw { statusCode: 400, message: 'Insufficient resource quantity at source shelter' };
    }

    return prisma.transfer.create({ data });
  }

  static async approveTransfer(transferId: string, approvedById: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({ where: { id: transferId } });
      if (!transfer) throw { statusCode: 404, message: 'Transfer not found' };
      if (transfer.status !== TransferStatus.PENDING) throw { statusCode: 400, message: 'Transfer is not pending' };

      const sourceResource = await tx.resource.findFirst({
        where: { shelterId: transfer.fromShelterId, resourceType: transfer.resourceType }
      });
      if (!sourceResource || sourceResource.quantity < transfer.quantity) {
        throw { statusCode: 400, message: 'Insufficient resource quantity at source shelter' };
      }

      // Deduct from source
      await tx.resource.update({
        where: { id: sourceResource.id },
        data: { quantity: sourceResource.quantity - transfer.quantity }
      });

      return tx.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.APPROVED, approvedById }
      });
    });
  }

  static async markInTransit(transferId: string) {
    const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw { statusCode: 404, message: 'Transfer not found' };
    if (transfer.status !== TransferStatus.APPROVED) throw { statusCode: 400, message: 'Transfer must be approved first' };

    return prisma.transfer.update({
      where: { id: transferId },
      data: { status: TransferStatus.IN_TRANSIT }
    });
  }

  static async receiveTransfer(transferId: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({ where: { id: transferId } });
      if (!transfer) throw { statusCode: 404, message: 'Transfer not found' };
      if (transfer.status !== TransferStatus.IN_TRANSIT && transfer.status !== TransferStatus.APPROVED) {
        throw { statusCode: 400, message: 'Transfer not in a receivable state' };
      }

      // Add to destination
      const destResource = await tx.resource.findFirst({
        where: { shelterId: transfer.toShelterId, resourceType: transfer.resourceType }
      });

      if (destResource) {
        await tx.resource.update({
          where: { id: destResource.id },
          data: { quantity: destResource.quantity + transfer.quantity }
        });
      } else {
        await tx.resource.create({
          data: {
            shelterId: transfer.toShelterId,
            resourceType: transfer.resourceType,
            quantity: transfer.quantity,
            unit: 'Units' // Fallback
          }
        });
      }

      return tx.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.RECEIVED }
      });
    });
  }

  static async rejectTransfer(transferId: string, approvedById: string) {
    return prisma.transfer.update({
      where: { id: transferId },
      data: { status: TransferStatus.REJECTED, approvedById }
    });
  }

  static async getTransfers() {
    return prisma.transfer.findMany({
      include: {
        fromShelter: true,
        toShelter: true,
        requestedBy: true,
        approvedBy: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
