import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/httpError';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ error: err.message, ...(err.details !== undefined ? { details: err.details } : {}) });
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = details[0];
    return res.status(400).json({
      error: first ? `Validation failed: ${first.path ? first.path + ': ' : ''}${first.message}` : 'Validation failed',
      details,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'A record with these values already exists' });
    if (err.code === 'P2003') return res.status(409).json({ error: 'Operation conflicts with related records' });
  }

  // Body parser errors (malformed JSON)
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }

  // Legacy thrown objects: { statusCode, message }
  if (err && typeof err.statusCode === 'number' && err.statusCode < 500) {
    return res.status(err.statusCode).json({ error: err.message || 'Request failed' });
  }

  if (process.env.NODE_ENV !== 'test') console.error(err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Internal Server Error' });
};
