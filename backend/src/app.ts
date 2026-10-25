import express from 'express';
import cors from 'cors';
import shelterRoutes from './routes/shelter.routes';
import transferRoutes from './routes/transfer.routes';
import dashboardRoutes from './routes/dashboard.routes';
import authRoutes from './routes/auth.routes';
import alertRoutes from './routes/alert.routes';
import volunteerRoutes from './routes/volunteer.routes';
import reunificationRoutes from './routes/reunification.routes';
import donationRoutes from './routes/donation.routes';
import { auditRouter, settingsRouter, usersRouter } from './routes/admin.routes';
import { errorHandler } from './middleware/error.middleware';
import { requestContext, securityHeaders } from './middleware/request.middleware';
import prisma from './config/prisma';
import { corsOrigins, type Env } from './config/env';

/**
 * Builds the Express app with no side effects (no listen, no timers). `server.ts` runs it as a long-lived
 * HTTP process; a serverless adapter can wrap the same app later without touching routes or services.
 */
export function createApp(env: Env) {
  const app = express();

  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', Number(env.TRUST_PROXY) || 1);
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(cors({ origin: corsOrigins(env), exposedHeaders: ['x-request-id'] }));
  app.use(express.json({ limit: '1mb' }));

  // Liveness: process is up. Used by container/load-balancer health checks.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Readiness: process can reach the database.
  app.get('/api/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/shelters', shelterRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/volunteers', volunteerRoutes);
  app.use('/api/donations', donationRoutes);
  app.use('/api/reunification', reunificationRoutes);
  app.use('/api/audit', auditRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/users', usersRouter);

  // Unknown API paths get JSON, not Express's HTML 404.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);
  return app;
}
