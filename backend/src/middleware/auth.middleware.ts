import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';

// Demo auth: the `x-user-id` header names a local user. This file is the ONLY place that reads it,
// so it can be replaced by Cognito JWT verification (AWS) without touching routes or services.

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const loadUser = async (userId: string): Promise<AuthUser | null> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;
  return { id: user.id, role: user.role, name: user.name, email: user.email };
};

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: No user ID provided' });
  }
  try {
    const user = await loadUser(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized: Invalid or inactive user' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/** Attaches req.user when a valid header is present; never rejects anonymous requests. */
export const optionalAuth = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') return next();
  try {
    const user = await loadUser(userId);
    if (user) req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    next();
  };
};
