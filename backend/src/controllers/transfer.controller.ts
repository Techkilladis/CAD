import { Response } from 'express';
import { TransferService } from '../services/transfer.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createTransferBody, reasonBody, listTransfersQuery } from '../schemas/transfer.schemas';

export const createTransfer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createTransferBody.parse(req.body);
  const t = await TransferService.create(req.user!, body);
  res.status(201).json(await TransferService.get(req.user!, t.id));
});
export const getTransfers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await TransferService.list(req.user!, listTransfersQuery.parse(req.query)));
});
export const getTransfer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await TransferService.get(req.user!, req.params.id));
});
export const approveTransfer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await TransferService.approve(req.user!, req.params.id));
});
export const rejectTransfer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await TransferService.reject(req.user!, req.params.id, reasonBody.parse(req.body ?? {}).reason));
});
export const markInTransit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await TransferService.markInTransit(req.user!, req.params.id));
});
export const receiveTransfer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await TransferService.receive(req.user!, req.params.id));
});
export const cancelTransfer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(await TransferService.cancel(req.user!, req.params.id, reasonBody.parse(req.body ?? {}).reason));
});
