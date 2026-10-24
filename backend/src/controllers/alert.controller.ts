import { Request, Response, NextFunction } from 'express';
import { AlertService } from '../services/alert.service';

export const runCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AlertService.runGlobalCheck();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const acknowledgeAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AlertService.acknowledgeAlert(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const resolveAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AlertService.resolveAlert(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
