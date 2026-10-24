import { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
