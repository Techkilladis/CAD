import { z } from 'zod';
import { optionalText, checkinStatusEnum, priorityEnum } from './common';

const occupantFields = {
  personName: z.string().trim().min(1, 'Name is required').max(120),
  familySize: z.number().int().min(1).max(1000),
  phone: optionalText(40),
  medicalFlag: z.boolean().optional(),
  elderlyCount: z.number().int().min(0).max(1000).optional(),
  pregnantFlag: z.boolean().optional(),
  disabledFlag: z.boolean().optional(),
  childrenCount: z.number().int().min(0).max(1000).optional(),
  emergencyNotes: optionalText(1000),
  medicalNotes: optionalText(1000),
};

const countsWithinFamily = (v: { familySize: number; elderlyCount?: number; childrenCount?: number }) =>
  (v.elderlyCount ?? 0) <= v.familySize && (v.childrenCount ?? 0) <= v.familySize;
const countsMessage = { message: 'Elderly and children counts cannot exceed family size' };

/** Coordinator / admin check-in. */
export const checkinBody = z
  .object({
    ...occupantFields,
    criticalMedical: z.boolean().optional(),
    clientRequestId: z.string().trim().min(8).max(100).optional(),
    source: z.enum(['COORDINATOR', 'OFFLINE_SYNC']).optional(),
  })
  .refine(countsWithinFamily, countsMessage);

/** Public family registration (no critical flag, no source, no idempotency key). */
export const registerBody = z.object(occupantFields).refine(countsWithinFamily, countsMessage);

/** familySize from the client is intentionally not part of this schema. */
export const checkoutBody = z.object({ checkinId: z.string().min(1) });

export const rejectBody = z.object({ reason: z.string().trim().max(300).optional() });

export const checkinsQuery = z.object({
  status: checkinStatusEnum.optional(),
  priority: priorityEnum.optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
