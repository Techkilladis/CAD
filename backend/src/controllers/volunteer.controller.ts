import { Response } from 'express';
import { VolunteerService } from '../services/volunteer.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createShiftBody, updateShiftBody, listShiftsQuery } from '../schemas/volunteer.schemas';

export const listVolunteers = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(await VolunteerService.listVolunteers());
});
export const listShifts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await VolunteerService.listShifts(req.user!, listShiftsQuery.parse(req.query)));
});
export const myShifts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await VolunteerService.myShifts(req.user!));
});
export const createShift = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(await VolunteerService.createShift(req.user!, createShiftBody.parse(req.body)));
});
export const updateShift = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await VolunteerService.updateShift(req.user!, req.params.shiftId, updateShiftBody.parse(req.body)));
});
export const signUp = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(await VolunteerService.signUp(req.user!, req.params.shiftId));
});
export const cancelSignup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await VolunteerService.cancelSignup(req.user!, req.params.shiftId));
});
export const removeVolunteer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await VolunteerService.removeVolunteer(req.user!, req.params.shiftId, req.params.volunteerId));
});
