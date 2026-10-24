import { z } from 'zod';
import { optionalText } from './common';

export const patchMeBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: optionalText(40),
  skills: optionalText(300),
  languages: optionalText(100),
});
