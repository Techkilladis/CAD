import { Response } from 'express';
import { CheckinService } from '../services/checkin.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { checkinBody, registerBody, checkoutBody, rejectBody, checkinsQuery } from '../schemas/checkin.schemas';

export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = registerBody.parse(req.body);
  res.status(201).json(await CheckinService.register(req.params.id, body));
});

export const checkIn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = checkinBody.parse(req.body);
  const result = await CheckinService.checkIn(req.user!, req.params.id, body);
  if (result.duplicate) return res.status(200).json({ duplicate: true, checkin: result.checkin });
  res.status(201).json(result.checkin);
});

export const confirmCheckin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await CheckinService.confirm(req.user!, req.params.id, req.params.checkinId));
});

export const rejectCheckin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = rejectBody.parse(req.body ?? {});
  res.json(await CheckinService.reject(req.user!, req.params.id, req.params.checkinId, body.reason));
});

export const checkOut = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = checkoutBody.parse(req.body);
  res.json(await CheckinService.checkOut(req.user!, req.params.id, body.checkinId));
});

export const listCheckins = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await CheckinService.list(req.user!, req.params.id, checkinsQuery.parse(req.query)));
});
