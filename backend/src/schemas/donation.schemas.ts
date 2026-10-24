import { z } from 'zod';
import { optionalText, resourceTypeEnum } from './common';

export const createDonationBody = z.object({
  shelterId: z.string().min(1),
  donorName: z.string().trim().min(1, 'Donor name is required').max(120),
  resourceType: resourceTypeEnum,
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(1_000_000_000),
  unit: z.string().trim().min(1).max(30),
  receivedDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').optional(),
  notes: optionalText(500),
  receiptRef: optionalText(100),
  receiptFileName: optionalText(200),
  applyToInventory: z.boolean().optional(),
});

export const updateDonationBody = z
  .object({
    notes: optionalText(500),
    receiptRef: optionalText(100),
    receiptFileName: optionalText(200),
    status: z.enum(['ACCEPTED', 'REJECTED']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const listDonationsQuery = z.object({
  shelterId: z.string().min(1).optional(),
  resourceType: resourceTypeEnum.optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']).optional(),
  from: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').optional(),
  to: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').optional(),
});
