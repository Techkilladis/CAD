import { z } from 'zod';

/**
 * Single place that reads process.env. Cloud platforms inject config as environment variables
 * (any secret store can populate them), so nothing else in the backend should read env directly for new settings.
 */
const bool = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  /** Comma-separated allowed browser origins. Unset = allow any origin (local dev only). */
  CORS_ORIGIN: z.string().optional(),
  /** Set to 1 (or the number of proxy hops) when running behind a load balancer / reverse proxy. */
  TRUST_PROXY: z.string().optional(),
  /** In-process alert scan interval; unset/0 = use the saved admin setting. */
  ALERT_SCAN_INTERVAL_MS: z.coerce.number().int().min(0).optional(),
  /**
   * Set false on multi-instance deployments so the scan runs once, from an external scheduler calling
   * `POST /api/alerts/run-check` (or AlertService.runGlobalCheck), instead of on every instance.
   */
  ALERT_SCHEDULER_ENABLED: bool.default(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  if (parsed.data.NODE_ENV === 'production' && !source.DATABASE_URL) throw new Error('DATABASE_URL is required in production');
  return parsed.data;
}

export function corsOrigins(env: Env): string[] | true {
  const list = (env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : true;
}
