import { z } from 'zod';

export const dashboardQuery = z.object({
  shelterId: z.string().min(1).optional(),
});
