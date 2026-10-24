import { Router } from 'express';
import prisma from '../config/prisma';

const router = Router();

router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true, email: true },
      orderBy: { role: 'asc' }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

export default router;
