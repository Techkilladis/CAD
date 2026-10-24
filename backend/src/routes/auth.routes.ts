import { Router } from 'express';
import prisma from '../config/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { patchMeBody } from '../schemas/auth.schemas';
import { getManagedShelterIds } from '../utils/access';
import { log as audit } from '../services/audit.service';

const router = Router();

// Public demo user picker: no emails, no contact data.
router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(users);
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const ids = await getManagedShelterIds(req.user);
    const managedShelters = await prisma.shelter.findMany({
      where: ids === null ? {} : { id: { in: ids } },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });
    res.json({ ...user, managedShelters });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = patchMeBody.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: req.user!.id }, data: body });
      await audit(tx, { userId: u.id, action: 'USER_PROFILE_UPDATE', entity: 'User', entityId: u.id, metadata: { fields: Object.keys(body) } });
      return u;
    });
    res.json(updated);
  })
);

export default router;
