import { format, formatDistanceToNow } from 'date-fns';
import type { MedicalPriority, OccupancyClass, ResourceType, ShelterStatus } from '../api/types';

export const fmtDateTime = (d: string | Date | null | undefined) => (d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '—');
export const fmtTime = (d: string | Date | null | undefined) => (d ? format(new Date(d), 'HH:mm') : '—');
export const fmtAgo = (d: string | Date | null | undefined) => (d ? `${formatDistanceToNow(new Date(d))} ago` : '—');
export const fmtNumber = (n: number) => n.toLocaleString('en-IN');

export const RESOURCE_LABEL: Record<ResourceType, string> = {
  FOOD: 'Food',
  WATER: 'Water',
  MEDICINE: 'Medicine',
  BLANKETS: 'Blankets',
};

export const PRIORITY_RANK: Record<MedicalPriority, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

/** Colour for an occupancy percentage bar. */
export const occupancyColor = (pct: number) => (pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-green-500');

/** Same rule as the backend dashboard: closed => INACTIVE, full => FULL, 90%+ => CRITICAL. */
export function classifyShelter(s: { status: ShelterStatus; capacityTotal: number; capacityOccupied: number }, threshold = 0.9): OccupancyClass {
  if (s.status === 'INACTIVE' || s.status === 'EMERGENCY_CLOSED') return 'INACTIVE';
  const ratio = s.capacityTotal > 0 ? s.capacityOccupied / s.capacityTotal : 0;
  if (s.status === 'FULL' || ratio >= 1) return 'FULL';
  if (ratio >= threshold) return 'CRITICAL';
  return 'AVAILABLE';
}
