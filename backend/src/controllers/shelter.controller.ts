import { Response } from 'express';
import { ShelterService } from '../services/shelter.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listSheltersQuery,
  nearestQuery,
  publicDetailQuery,
  createShelterBody,
  updateShelterBody,
  statusBody,
  localeParam,
  translationBody,
} from '../schemas/shelter.schemas';

export const getShelters = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ShelterService.listPublic(listSheltersQuery.parse(req.query)));
});

export const getNearestShelters = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ShelterService.nearest(nearestQuery.parse(req.query)));
});

export const getPublicStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(await ShelterService.publicStats());
});

export const getManagedShelters = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ShelterService.listManaged(req.user!));
});

export const getShelterById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const q = publicDetailQuery.parse(req.query);
  res.json(await ShelterService.getPublic(req.params.id, q.lang, q));
});

export const getStaffDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ShelterService.getStaffDetail(req.user!, req.params.id));
});

export const getOverview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await ShelterService.overview(req.user!, req.params.id));
});

export const createShelter = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createShelterBody.parse(req.body);
  res.status(201).json(await ShelterService.create(req.user!, body));
});

export const updateShelter = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = updateShelterBody.parse(req.body);
  res.json(await ShelterService.update(req.user!, req.params.id, body));
});

export const setShelterStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = statusBody.parse(req.body);
  res.json(await ShelterService.setStatus(req.user!, req.params.id, body.status, body.reason));
});

export const upsertTranslation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = localeParam.parse(req.params);
  const body = translationBody.parse(req.body);
  res.json(await ShelterService.upsertTranslation(req.user!, params.id, params.locale, body));
});
