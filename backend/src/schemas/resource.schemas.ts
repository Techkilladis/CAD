import { z } from 'zod';
import { resourceTypeEnum } from './common';

const qty = z.number().int().min(0).max(1_000_000_000);

export const createResourceBody = z.object({
  resourceType: resourceTypeEnum,
  quantity: qty,
  unit: z.string().trim().min(1).max(30),
  lowStockThreshold: qty.optional(),
  note: z.string().trim().max(300).optional(),
});

export const updateResourceBody = z
  .object({
    quantity: qty.optional(),
    delta: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
    lowStockThreshold: qty.optional(),
    unit: z.string().trim().min(1).max(30).optional(),
    isActive: z.boolean().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((v) => !(v.quantity !== undefined && v.delta !== undefined), {
    message: 'Provide either quantity (set) or delta (adjust), not both',
  });

export const movementsQuery = z.object({
  resourceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
