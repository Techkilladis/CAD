import { Router } from 'express';
import {
  createTransfer, getTransfers, getTransfer, approveTransfer, rejectTransfer, markInTransit, receiveTransfer, cancelTransfer,
} from '../controllers/transfer.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();
const staff = [requireAuth, requireRole(['ADMIN', 'COORDINATOR'])];

router.post('/', ...staff, createTransfer);
router.get('/', ...staff, getTransfers);
router.get('/:id', ...staff, getTransfer);
router.patch('/:id/approve', requireAuth, requireRole(['ADMIN']), approveTransfer);
router.patch('/:id/reject', requireAuth, requireRole(['ADMIN']), rejectTransfer);
router.patch('/:id/transit', ...staff, markInTransit);
router.patch('/:id/received', ...staff, receiveTransfer);
router.patch('/:id/receive', ...staff, receiveTransfer); // alias kept for compatibility
router.patch('/:id/cancel', ...staff, cancelTransfer);

export default router;
