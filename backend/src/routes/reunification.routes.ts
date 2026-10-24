import { Router } from 'express';
import { reportMissingPerson, getAllCases, updateCaseStatus } from '../controllers/reunification.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/', reportMissingPerson); // Public route
router.get('/', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getAllCases);
router.patch('/:id/status', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), updateCaseStatus);

export default router;
