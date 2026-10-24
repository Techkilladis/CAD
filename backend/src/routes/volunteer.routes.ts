import { Router } from 'express';
import { createShift, getShifts, signUpForShift, cancelSignup } from '../controllers/volunteer.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), createShift);
router.get('/', requireAuth, getShifts);
router.post('/:id/signup', requireAuth, requireRole(['VOLUNTEER']), signUpForShift);
router.delete('/:id/signup', requireAuth, requireRole(['VOLUNTEER']), cancelSignup);

export default router;
