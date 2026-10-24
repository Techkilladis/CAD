import { Router } from 'express';
import {
  listVolunteers, listShifts, myShifts, createShift, updateShift, signUp, cancelSignup, removeVolunteer,
} from '../controllers/volunteer.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();
const staff = [requireAuth, requireRole(['ADMIN', 'COORDINATOR'])];
const volunteer = [requireAuth, requireRole(['VOLUNTEER'])];

router.get('/', ...staff, listVolunteers);
router.get('/me/shifts', ...volunteer, myShifts);
router.get('/shifts', requireAuth, listShifts);
router.post('/shifts', ...staff, createShift);
router.patch('/shifts/:shiftId', ...staff, updateShift);
router.post('/shifts/:shiftId/signup', ...volunteer, signUp);
router.delete('/shifts/:shiftId/signup', ...volunteer, cancelSignup);
router.delete('/shifts/:shiftId/volunteers/:volunteerId', ...staff, removeVolunteer);

export default router;
