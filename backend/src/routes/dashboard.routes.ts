import { Router } from 'express';
import { getDashboardStats, getDistrict, getResourceMatrix, getMedical, getVolunteerCoverage, getDonationTotals, getReports } from '../controllers/dashboard.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, requireRole(['ADMIN']), getDashboardStats);
router.get('/district', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getDistrict);
router.get('/resources', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getResourceMatrix);

router.get('/medical', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getMedical);

router.get('/volunteers', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getVolunteerCoverage);
router.get('/donations', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getDonationTotals);
router.get('/reports', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), getReports);

export default router;
