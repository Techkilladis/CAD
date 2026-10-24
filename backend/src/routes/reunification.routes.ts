import { Router } from 'express';
import { reportMissingPerson, publicSearch, getAllCases, updateCase } from '../controllers/reunification.controller';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();
const staff = [requireAuth, requireRole(['ADMIN', 'COORDINATOR'])];

router.post('/', optionalAuth, reportMissingPerson); // public
router.get('/public-search', publicSearch); // public, privacy-limited
router.get('/', ...staff, getAllCases);
router.patch('/:id', ...staff, updateCase);
router.patch('/:id/status', ...staff, updateCase); // kept for compatibility

export default router;
