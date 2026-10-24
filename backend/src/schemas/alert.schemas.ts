import { z } from 'zod';

export const listAlertsQuery = z.object({
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  type: z.enum(['LOW_STOCK', 'OVERCROWDING', 'FULL_SHELTER', 'CRITICAL_MEDICAL_NEED', 'TRANSFER_REQUIRED']).optional(),
  shelterId: z.string().min(1).optional(),
});
