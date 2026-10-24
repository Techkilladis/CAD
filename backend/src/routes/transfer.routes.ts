import { Router } from 'express';
import { createTransfer, approveTransfer, rejectTransfer, getTransfers, markInTransit, receiveTransfer } from '../controllers/transfer.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, requireRole(['COORDINATOR', 'ADMIN']), createTransfer);
router.patch('/:id/approve', requireAuth, requireRole(['ADMIN']), approveTransfer);
router.patch('/:id/reject', requireAuth, requireRole(['ADMIN']), rejectTransfer);
router.patch('/:id/transit', requireAuth, requireRole(['COORDINATOR', 'ADMIN']), markInTransit);
router.patch('/:id/receive', requireAuth, requireRole(['COORDINATOR', 'ADMIN']), receiveTransfer);
router.get('/', requireAuth, getTransfers);

export default router;
