import type { MedicalPriority } from '@prisma/client';

export interface MedicalInput {
  criticalMedical?: boolean;
  medicalFlag?: boolean;
  pregnantFlag?: boolean;
  disabledFlag?: boolean;
  elderlyCount?: number;
  childrenCount?: number;
}

/** critical -> CRITICAL; pregnant/disabled/medical flag -> HIGH; elderly -> MEDIUM; children -> LOW; else NONE. */
export function computeMedicalPriority(i: MedicalInput): MedicalPriority {
  if (i.criticalMedical) return 'CRITICAL';
  if (i.pregnantFlag || i.disabledFlag || i.medicalFlag) return 'HIGH';
  if ((i.elderlyCount ?? 0) > 0) return 'MEDIUM';
  if ((i.childrenCount ?? 0) > 0) return 'LOW';
  return 'NONE';
}

export const PRIORITY_ORDER: Record<MedicalPriority, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
