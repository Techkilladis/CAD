import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

const VALID_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Tags every request with an id (reuses an upstream `x-request-id` from a load balancer/proxy when valid),
 * echoes it on the response, and writes one access-log line when the response finishes.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path.startsWith('/api/health')) return;
    logger.info('request', {
      requestId: id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n),
    });
  });
  next();
}

/** Baseline security headers for a JSON API (no extra dependency). HSTS only when served over HTTPS in production. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
