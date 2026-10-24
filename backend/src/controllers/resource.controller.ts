import { Response } from 'express';
import { ResourceService } from '../services/resource.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createResourceBody, updateResourceBody, movementsQuery } from '../schemas/resource.schemas';

export const getResources = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ResourceService.list(req.user, req.params.id));
});

export const createResource = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createResourceBody.parse(req.body);
  res.status(201).json(await ResourceService.create(req.user!, req.params.id, body));
});

export const updateResource = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = updateResourceBody.parse(req.body);
  res.json(await ResourceService.update(req.user!, req.params.id, req.params.resourceId, body));
});

export const getMovements = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ResourceService.movements(req.user!, req.params.id, movementsQuery.parse(req.query)));
});
