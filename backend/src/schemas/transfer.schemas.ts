import { z } from 'zod';
import { resourceTypeEnum } from './common';

export const createTransferBody = z.object({
  fromShelterId: z.string().min(1),
  toShelterId: z.string().min(1),
  resourceType: resourceTypeEnum,
  quantity: z.number().int().min(1, 'Quantity must be positive').max(1_000_000_000),
  reason: z.string().trim().max(300).nullable().optional(),
});

export const reasonBody = z.object({ reason: z.string().trim().max(300).optional() });

export const listTransfersQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED']).optional(),
  shelterId: z.string().min(1).optional(),
  direction: z.enum(['incoming', 'outgoing']).optional(),
});
