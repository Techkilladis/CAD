import { Router } from 'express';
import {
  getShelters,
  getNearestShelters,
  getShelterById,
  createShelter,
  updateShelter,
  checkIn,
  checkOut,
  getResources,
  updateResource,
  register,
  confirmCheckin
} from '../controllers/shelter.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/nearest', getNearestShelters);
router.get('/', getShelters);
router.get('/:id', getShelterById);
router.post('/', requireAuth, requireRole(['ADMIN']), createShelter);
router.patch('/:id', requireAuth, requireRole(['ADMIN', 'COORDINATOR']), updateShelter);
router.post('/:id/register', register);
router.post('/:id/checkin', requireAuth, requireRole(['COORDINATOR']), checkIn);
router.patch('/:id/checkin/:checkinId/confirm', requireAuth, requireRole(['COORDINATOR']), confirmCheckin);
router.post('/:id/checkout', requireAuth, requireRole(['COORDINATOR']), checkOut);
router.get('/:id/resources', getResources);
router.patch('/:id/resources/:resourceId', requireAuth, requireRole(['COORDINATOR']), updateResource);

export default router;
