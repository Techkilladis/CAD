import { AlertService } from '../services/alert.service';
import { logger } from '../utils/logger';

// AWS replacement: Amazon EventBridge Scheduler invoking a Lambda that calls AlertService.runGlobalCheck().
let timer: NodeJS.Timeout | null = null;
let running = false;

export interface SchedulerOptions {
  intervalMs: number;
  /** Injected for tests; defaults to the real engine. */
  run?: () => Promise<unknown>;
}

/**
 * Starts the periodic alert scan. Safe to call repeatedly (second call is a no-op) and refuses to start
 * under NODE_ENV=test or with a non-positive interval. A scan that is still running is never overlapped.
 * Returns true when this call started the timer.
 */
export function startAlertScheduler(opts: SchedulerOptions): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (!Number.isFinite(opts.intervalMs) || opts.intervalMs < 1000) return false;
  if (timer) return false;
  const run = opts.run ?? (() => AlertService.runGlobalCheck());
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await run();
      logger.info('alert scan complete', { result: r });
    } catch (e) {
      logger.error('alert scan failed', { err: e });
    } finally {
      running = false;
    }
  }, opts.intervalMs);
  timer.unref();
  return true;
}

export function stopAlertScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  running = false;
}

export const isAlertSchedulerRunning = () => timer !== null;
