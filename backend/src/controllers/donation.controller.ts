import { Response } from 'express';
import { DonationService } from '../services/donation.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createDonationBody, updateDonationBody, listDonationsQuery } from '../schemas/donation.schemas';

export const listDonations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await DonationService.list(req.user!, listDonationsQuery.parse(req.query)));
});
export const createDonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(await DonationService.create(req.user!, createDonationBody.parse(req.body)));
});
export const updateDonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await DonationService.update(req.user!, req.params.id, updateDonationBody.parse(req.body)));
});
