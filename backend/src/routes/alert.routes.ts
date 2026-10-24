import { Router } from 'express';
import { listAlerts, runCheck, acknowledgeAlert, resolveAlert } from '../controllers/alert.controller';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuth, listAlerts);
router.post('/run-check', requireAuth, requireRole(['ADMIN']), runCheck);
router.patch('/:id/acknowledge', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), acknowledgeAlert);
router.patch('/:id/resolve', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), resolveAlert);

export default router;
