import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

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

/** Typed settings with defaults; rows in SystemSetting override them. */
export async function getSettings(db: Db = prisma): Promise<Settings> {
  const rows = await db.systemSetting.findMany();
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    if (row.key in SETTING_DEFAULTS) {
      const n = Number(row.value);
      if (Number.isFinite(n)) (out as any)[row.key] = n;
    }
  }
  return out;
}

export const SettingsService = { getSettings };
