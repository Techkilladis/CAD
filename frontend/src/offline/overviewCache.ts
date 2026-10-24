import type { ShelterOverview } from '../api/types';

// The last successfully loaded shelter overview, kept so the occupants list can still be shown while offline.
const key = (shelterId: string) => `safehaven.overview.${shelterId}`;

export interface CachedOverview {
  savedAt: string;
  overview: ShelterOverview;
}

export function saveOverview(shelterId: string, overview: ShelterOverview) {
  try {
    localStorage.setItem(key(shelterId), JSON.stringify({ savedAt: new Date().toISOString(), overview } satisfies CachedOverview));
  } catch {
    /* quota or blocked storage: offline view simply has nothing cached */
  }
}

export function loadOverview(shelterId: string): CachedOverview | null {
  try {
    const raw = localStorage.getItem(key(shelterId));
    return raw ? (JSON.parse(raw) as CachedOverview) : null;
  } catch {
    return null;
  }
}
