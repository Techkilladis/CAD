import { Router, Response } from 'express';
import { z } from 'zod';
import { AdminService } from '../services/admin.service';
import { SettingsService, SETTING_RULES } from '../services/settings.service';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { optionalText } from '../schemas/common';

const admin = [requireAuth, requireRole(['ADMIN'])];

// ---- Audit ----
const auditQuery = z.object({
  entity: z.string().trim().max(60).optional(),
  userId: z.string().min(1).optional(),
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(25),
});
export const auditRouter = Router();
auditRouter.get('/', ...admin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => res.json(await AdminService.listAudit(auditQuery.parse(req.query)))));
auditRouter.get('/facets', ...admin, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => res.json(await AdminService.auditFacets())));

// ---- Settings ----
const settingsBody = z
  .object({
    overcrowdingThreshold: z.number().optional(),
    criticalMedicalCount: z.number().optional(),
    transferSurplusMultiplier: z.number().optional(),
    alertScanIntervalMs: z.number().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export const settingsRouter = Router();
settingsRouter.get(
  '/',
  ...admin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) =>
    res.json({ settings: await SettingsService.getSettings(), rules: SETTING_RULES, integrations: SettingsService.integrationStatus() })
  )
);
settingsRouter.patch(
  '/',
  ...admin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await SettingsService.updateSettings(req.user!, settingsBody.parse(req.body));
    res.json({ settings, rules: SETTING_RULES, integrations: SettingsService.integrationStatus() });
  })
);

// ---- Users ----
const roleEnum = z.enum(['ADMIN', 'COORDINATOR', 'VOLUNTEER']);
const createUserBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: roleEnum,
  phone: optionalText(40),
  skills: optionalText(300),
  languages: optionalText(100),
});
const updateUserBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email').optional(),
    role: roleEnum.optional(),
    isActive: z.boolean().optional(),
    phone: optionalText(40),
    skills: optionalText(300),
    languages: optionalText(100),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export const usersRouter = Router();
usersRouter.get('/', ...admin, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => res.json(await AdminService.listUsers())));
usersRouter.post('/', ...admin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => res.status(201).json(await AdminService.createUser(req.user!, createUserBody.parse(req.body)))));
usersRouter.patch('/:id', ...admin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => res.json(await AdminService.updateUser(req.user!, req.params.id, updateUserBody.parse(req.body)))));

