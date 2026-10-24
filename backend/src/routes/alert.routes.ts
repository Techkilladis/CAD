import { Router } from 'express';
import { runCheck, acknowledgeAlert, resolveAlert } from '../controllers/alert.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/run-check', requireAuth, requireRole(['ADMIN']), runCheck);
router.patch('/:id/acknowledge', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), acknowledgeAlert);
router.patch('/:id/resolve', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), resolveAlert);

export default router;
