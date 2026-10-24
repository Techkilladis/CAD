import { Response } from 'express';
import { ReunificationService } from '../services/reunification.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { reportBody, publicSearchQuery, staffListQuery, updateCaseBody } from '../schemas/reunification.schemas';

export const reportMissingPerson = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(await ReunificationService.report(req.user, reportBody.parse(req.body)));
});
export const publicSearch = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ReunificationService.publicSearch(publicSearchQuery.parse(req.query).q));
});
export const getAllCases = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ReunificationService.list(req.user!, staffListQuery.parse(req.query)));
});
export const updateCase = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ReunificationService.update(req.user!, req.params.id, updateCaseBody.parse(req.body)));
});
