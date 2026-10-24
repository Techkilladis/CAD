import { Request, Response, NextFunction } from 'express';
import { TransferService } from '../services/transfer.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const createTransfer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = { ...req.body, requestedById: req.user!.id }; // Enforce requestedById
    const transfer = await TransferService.createTransfer(data);
    res.status(201).json(transfer);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const approveTransfer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await TransferService.approveTransfer(req.params.id, req.user!.id); // Use authenticated admin ID
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const rejectTransfer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transfer = await TransferService.rejectTransfer(req.params.id, req.user!.id); // Use authenticated admin ID
    res.json(transfer);
  } catch (error) {
    next(error);
  }
};

export const markInTransit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await TransferService.markInTransit(req.params.id);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const receiveTransfer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await TransferService.receiveTransfer(req.params.id);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const getTransfers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfers = await TransferService.getTransfers();
    res.json(transfers);
  } catch (error) {
    next(error);
  }
};
