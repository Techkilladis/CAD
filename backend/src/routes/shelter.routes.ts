import { Router } from 'express';
import {
  getShelters,
  getNearestShelters,
  getPublicStats,
  getManagedShelters,
  getShelterById,
  getStaffDetail,
  getOverview,
  createShelter,
  updateShelter,
  setShelterStatus,
  upsertTranslation,
} from '../controllers/shelter.controller';
import {
  register,
  checkIn,
  confirmCheckin,
  rejectCheckin,
  checkOut,
  listCheckins,
} from '../controllers/checkin.controller';
import { getResources, createResource, updateResource, getMovements } from '../controllers/resource.controller';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();
const staff = [requireAuth, requireRole(['ADMIN', 'COORDINATOR'])];

// Public, occupant-free
router.get('/nearest', getNearestShelters);
router.get('/stats/public', getPublicStats);
router.get('/', getShelters);

// Staff lists (must precede '/:id')
router.get('/managed', ...staff, getManagedShelters);

router.get('/:id', getShelterById);
router.get('/:id/staff', ...staff, getStaffDetail);
router.get('/:id/overview', ...staff, getOverview);

router.post('/', requireAuth, requireRole(['ADMIN']), createShelter);
router.patch('/:id', ...staff, updateShelter);
router.patch('/:id/status', requireAuth, requireRole(['ADMIN']), setShelterStatus);
router.put('/:id/translations/:locale', ...staff, upsertTranslation);

// Check-ins
router.post('/:id/register', register);
router.post('/:id/checkin', ...staff, checkIn);
router.get('/:id/checkins', ...staff, listCheckins);
router.patch('/:id/checkin/:checkinId/confirm', ...staff, confirmCheckin);
router.patch('/:id/checkin/:checkinId/reject', ...staff, rejectCheckin);
router.post('/:id/checkout', ...staff, checkOut);

// Resources (GET is public-safe; staff who manage the shelter get the full record)
router.get('/:id/resources', optionalAuth, getResources);
router.get('/:id/resources/movements', ...staff, getMovements);
router.post('/:id/resources', ...staff, createResource);
router.patch('/:id/resources/:resourceId', ...staff, updateResource);

export default router;
