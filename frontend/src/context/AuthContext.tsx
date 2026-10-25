import { createContext, useContext } from 'react';
import type { Me, ManagedShelterRef, Role, DemoUser } from '../api/types';

export type { Role };

export interface AuthContextType {
  user: Me | null;
  /** True while the stored session is being verified against /auth/me. */
  loading: boolean;
  login: (u: Pick<DemoUser, 'id'>) => Promise<Me>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** Coordinators / admins: shelters they manage and the one currently in focus. */
  selectedShelterId: string | null;
  selectedShelter: ManagedShelterRef | null;
  setSelectedShelterId: (id: string) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SHELTER_KEY = 'selectedShelterId';

export const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const safeSet = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};