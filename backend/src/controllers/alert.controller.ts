import { Response } from 'express';
import { AlertService } from '../services/alert.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const runCheck = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(await AlertService.runGlobalCheck());
});

export const acknowledgeAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await AlertService.acknowledgeAlert(req.params.id, req.user));
});

export const resolveAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await AlertService.resolveAlert(req.params.id, req.user));
});
