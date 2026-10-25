import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { loadEnv } from './config/env';
import prisma from './config/prisma';
import { startAlertScheduler, stopAlertScheduler } from './integrations/alertScheduler';
import { getSettings } from './services/settings.service';
import { logger } from './utils/logger';

const env = loadEnv();
const app = createApp(env);

async function resolveScanInterval(): Promise<number> {
  // ALERT_SCAN_INTERVAL_MS wins, else the saved setting (0 = off). Never starts under test.
  if (env.ALERT_SCAN_INTERVAL_MS && env.ALERT_SCAN_INTERVAL_MS > 0) return env.ALERT_SCAN_INTERVAL_MS;
  try {
    return (await getSettings()).alertScanIntervalMs;
  } catch {
    return 0;
  }
}

if (require.main === module) {
  const server = app.listen(env.PORT, async () => {
    logger.info('server started', { port: env.PORT, env: env.NODE_ENV });
    if (!env.ALERT_SCHEDULER_ENABLED) {
      logger.info('alert scheduler disabled by ALERT_SCHEDULER_ENABLED');
      return;
    }
    const interval = await resolveScanInterval();
    if (startAlertScheduler({ intervalMs: interval })) logger.info('alert scheduler started', { intervalMs: interval });
  });

  // Graceful shutdown: containers get SIGTERM on every deploy/scale-in.
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('shutting down', { signal });
    stopAlertScheduler();
    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error('unhandled rejection', { err }));
}

export default app;
