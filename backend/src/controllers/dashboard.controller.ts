import { Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { dashboardQuery } from '../schemas/dashboard.schemas';

export const getDashboardStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(await DashboardService.adminOverview());
});

export const getDistrict = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const q = dashboardQuery.parse(req.query);
  res.json(await DashboardService.district(req.user!, q.shelterId));
});

export const getResourceMatrix = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const q = dashboardQuery.parse(req.query);
  res.json(await DashboardService.resources(req.user!, q.shelterId));
});

export const getMedical = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const q = dashboardQuery.parse(req.query);
  res.json(await DashboardService.medical(req.user!, q.shelterId));
});

export const getVolunteerCoverage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await DashboardService.volunteers(req.user!, dashboardQuery.parse(req.query).shelterId));
});
export const getDonationTotals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await DashboardService.donations(req.user!, dashboardQuery.parse(req.query).shelterId));
});
export const getReports = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await DashboardService.reports(req.user!, dashboardQuery.parse(req.query).shelterId));
});
