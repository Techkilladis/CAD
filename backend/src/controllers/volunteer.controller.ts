import { Request, Response, NextFunction } from 'express';
import { VolunteerService } from '../services/volunteer.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const createShift = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = {
      shelterId: req.body.shelterId,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
      requiredCount: req.body.requiredCount
    };
    const shift = await VolunteerService.createShift(data);
    res.status(201).json(shift);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const getShifts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shelterId = req.query.shelterId as string | undefined;
    const shifts = await VolunteerService.getShifts(shelterId);
    res.json(shifts);
  } catch (error) {
    next(error);
  }
};

export const signUpForShift = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const assignment = await VolunteerService.signUpForShift(req.params.id, req.user!.id);
    res.json(assignment);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const cancelSignup = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await VolunteerService.cancelSignup(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};
