import { Request, Response, NextFunction } from 'express';
import { ReunificationService } from '../services/reunification.service';

export const reportMissingPerson = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReunificationService.reportMissingPerson(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAllCases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cases = await ReunificationService.getAllCases();
    res.json(cases);
  } catch (error) {
    next(error);
  }
};

export const updateCaseStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedCase = await ReunificationService.updateCaseStatus(req.params.id, req.body.status);
    res.json(updatedCase);
  } catch (error) {
    next(error);
  }
};
