import { Router } from 'express';
import { listDonations, createDonation, updateDonation } from '../controllers/donation.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireRole(['ADMIN', 'COORDINATOR']));
router.get('/', listDonations);
router.post('/', createDonation);
router.patch('/:id', updateDonation);

export default router;
