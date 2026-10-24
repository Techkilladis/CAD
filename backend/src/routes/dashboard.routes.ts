import { Router } from 'express';
import { getDashboardStats, getDistrict, getResourceMatrix } from '../controllers/dashboard.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, requireRole(['ADMIN']), getDashboardStats);
router.get('/district', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getDistrict);
router.get('/resources', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getResourceMatrix);

export default router;
