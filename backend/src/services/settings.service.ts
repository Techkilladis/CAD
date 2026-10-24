import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthUser } from '../middleware/auth.middleware';
import { badRequest } from '../utils/httpError';
import { log as audit } from './audit.service';

type Db = Prisma.TransactionClient | typeof prisma;

export interface Settings {
  overcrowdingThreshold: number;
  criticalMedicalCount: number;
  transferSurplusMultiplier: number;
  alertScanIntervalMs: number;
}

export const SETTING_DEFAULTS: Settings = {
  overcrowdingThreshold: 0.9,
  criticalMedicalCount: 5,
  transferSurplusMultiplier: 3,
  alertScanIntervalMs: 0,
};

/** Validation ranges for each setting. */
export const SETTING_RULES: Record<keyof Settings, { min: number; max: number; integer: boolean; label: string }> = {
  overcrowdingThreshold: { min: 0.5, max: 0.99, integer: false, label: 'Overcrowding threshold (fraction of capacity)' },
  criticalMedicalCount: { min: 1, max: 1000, integer: true, label: 'High-priority medical cases that raise an alert' },
  transferSurplusMultiplier: { min: 1, max: 100, integer: false, label: 'Surplus multiplier (donor stock must exceed threshold x this)' },
  alertScanIntervalMs: { min: 0, max: 86_400_000, integer: true, label: 'Alert scan interval in ms (0 = off, takes effect on restart)' },
};

/** Typed settings with defaults; rows in SystemSetting override them. */
export async function getSettings(db: Db = prisma): Promise<Settings> {
  const rows = await db.systemSetting.findMany();
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    if (row.key in SETTING_DEFAULTS) {
      const n = Number(row.value);
      if (Number.isFinite(n)) (out as unknown as Record<string, number>)[row.key] = n;
    }
  }
  return out;
}

export async function updateSettings(user: AuthUser, patch: Partial<Settings>): Promise<Settings> {
  for (const [key, value] of Object.entries(patch)) {
    const rule = SETTING_RULES[key as keyof Settings];
    if (!rule) throw badRequest(`Unknown setting: ${key}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw badRequest(`${key} must be a number`);
    if (value < rule.min || value > rule.max) throw badRequest(`${key} must be between ${rule.min} and ${rule.max}`);
    if (rule.integer && !Number.isInteger(value)) throw badRequest(`${key} must be a whole number`);
  }
  return prisma.$transaction(async (tx) => {
    const before = await getSettings(tx);
    for (const [key, value] of Object.entries(patch)) {
      await tx.systemSetting.upsert({
        where: { key },
        create: { key, value: String(value), updatedById: user.id },
        update: { value: String(value), updatedById: user.id },
      });
    }
    await audit(tx, { userId: user.id, action: 'SETTINGS_UPDATE', entity: 'SystemSetting', entityId: 'global', metadata: { before, patch } as unknown as Record<string, unknown> });
    return getSettings(tx);
  });
}

/** What each pluggable seam currently runs on, shown in Admin -> Settings. */
export function integrationStatus() {
  return [
    { name: 'NotificationPublisher', local: 'Console log + AlertLog.notifiedVia = LOCAL', aws: 'Amazon SNS / SES' },
    { name: 'AuditSink', local: 'PostgreSQL AuditLog table', aws: 'CloudWatch Logs' },
    { name: 'ReceiptStorage', local: 'Reference string only (no file stored)', aws: 'Amazon S3' },
    { name: 'TransferWorkflow', local: 'Synchronous state machine in transfer.service', aws: 'AWS Step Functions' },
    { name: 'Alert scheduler', local: 'setInterval inside the API process', aws: 'Amazon EventBridge Scheduler' },
    { name: 'Authentication', local: 'Demo x-user-id header (no passwords)', aws: 'Amazon Cognito' },
  ];
}

export const SettingsService = { getSettings, updateSettings, integrationStatus };
