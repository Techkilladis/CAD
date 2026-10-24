import { z } from 'zod';

/** Optional free text: trims, empty string becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** Query-string boolean: 'true' / '1' => true. */
export const queryBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === 'true' || v === '1');

export const resourceTypeEnum = z.enum(['FOOD', 'WATER', 'MEDICINE', 'BLANKETS']);
export const shelterStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'FULL', 'EMERGENCY_CLOSED']);
export const checkinStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'CHECKED_OUT', 'CANCELLED']);
export const priorityEnum = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const idParam = z.object({ id: z.string().min(1) });
