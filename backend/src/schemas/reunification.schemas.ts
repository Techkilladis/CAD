import { z } from 'zod';
import { optionalText } from './common';

export const reportBody = z.object({
  missingPersonName: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  age: z.number().int().min(0).max(120).nullable().optional(),
  gender: optionalText(30),
  lastKnownLocation: optionalText(200),
  lastKnownShelterId: z.string().min(1).nullable().optional(),
  contactPerson: z.string().trim().min(1, 'Contact person is required').max(120),
  contactInfo: z.string().trim().min(5, 'Contact details are required').max(200),
  description: optionalText(1000),
});

export const publicSearchQuery = z.object({ q: z.string().trim().min(2, 'Enter at least 2 characters').max(100) });

export const staffListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['MISSING', 'POTENTIAL_MATCH', 'REUNITED', 'CLOSED']).optional(),
});

export const updateCaseBody = z
  .object({
    status: z.enum(['MISSING', 'POTENTIAL_MATCH', 'REUNITED', 'CLOSED']).optional(),
    staffNotes: optionalText(2000),
    matchedCheckinId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
