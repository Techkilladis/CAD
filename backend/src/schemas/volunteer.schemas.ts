import { z } from 'zod';
import { optionalText, queryBool } from './common';

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date/time');

export const createShiftBody = z.object({
  shelterId: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(120),
  task: optionalText(200),
  notes: optionalText(1000),
  startTime: isoDate,
  endTime: isoDate,
  requiredCount: z.number().int().min(1).max(500),
});

export const updateShiftBody = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    task: optionalText(200),
    notes: optionalText(1000),
    startTime: isoDate.optional(),
    endTime: isoDate.optional(),
    requiredCount: z.number().int().min(1).max(500).optional(),
    status: z.enum(['OPEN', 'CANCELLED']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const listShiftsQuery = z.object({
  shelterId: z.string().min(1).optional(),
  upcoming: queryBool,
});
