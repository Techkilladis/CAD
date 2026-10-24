import { z } from 'zod';
import { optionalText, queryBool, resourceTypeEnum, shelterStatusEnum } from './common';

export const listSheltersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  minAvailable: z.coerce.number().int().min(0).optional(),
  resource: resourceTypeEnum.optional(),
  status: shelterStatusEnum.optional(),
  includeInactive: queryBool,
  lang: z.string().trim().max(10).optional(),
});

export const nearestQuery = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  onlyAvailable: queryBool,
  lang: z.string().trim().max(10).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const publicDetailQuery = z.object({
  lang: z.string().trim().max(10).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const shelterFields = {
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capacityTotal: z.number().int().min(1).max(1_000_000),
  coordinatorId: z.string().min(1).nullable().optional(),
  status: shelterStatusEnum.optional(),
  description: optionalText(2000),
  contactInfo: optionalText(200),
  contactPhone: optionalText(40),
  contactEmail: optionalText(120),
  medicalSupport: z.boolean().optional(),
};

export const createShelterBody = z.object(shelterFields);
export const updateShelterBody = z.object(shelterFields).partial();

/** Fields a coordinator may change on their own shelter. */
export const COORDINATOR_EDITABLE_FIELDS = ['description', 'contactInfo', 'contactPhone', 'contactEmail', 'medicalSupport', 'status'];

export const statusBody = z.object({
  status: shelterStatusEnum,
  reason: z.string().trim().max(300).optional(),
});

export const localeParam = z.object({
  id: z.string().min(1),
  locale: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, 'Invalid locale code'),
});

export const translationBody = z.object({
  name: optionalText(150),
  description: optionalText(2000),
  instructions: optionalText(2000),
});
