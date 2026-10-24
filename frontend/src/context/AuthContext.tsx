import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe } from '../api/auth';
import type { DemoUser, Me, ManagedShelterRef } from '../api/types';

export type { Role } from '../api/types';

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SHELTER_KEY = 'selectedShelterId';

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!safeGet('userId'));
  const [shelterPick, setShelterPick] = useState<string | null>(() => safeGet(SHELTER_KEY));

  const refresh = useCallback(async () => {
    if (!safeGet('userId')) {
      setUser(null);
      return;
    }
    try {
      setUser(await getMe());
    } catch {
      // Stored user no longer valid (deleted/deactivated): drop the session.
      safeSet('userId', null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (u: Pick<DemoUser, 'id'>) => {
    safeSet('userId', u.id);
    const me = await getMe().catch((e) => {
      safeSet('userId', null);
      throw e;
    });
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    safeSet('userId', null);
    safeSet(SHELTER_KEY, null);
    setShelterPick(null);
    setUser(null);
  }, []);

  const setSelectedShelterId = useCallback((id: string) => {
    setShelterPick(id);
    safeSet(SHELTER_KEY, id);
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const shelters = user?.managedShelters ?? [];
    const selectedShelter = shelters.find((s) => s.id === shelterPick) ?? shelters[0] ?? null;
    return {
      user,
      loading,
      login,
      logout,
      refresh,
      selectedShelterId: selectedShelter?.id ?? null,
      selectedShelter,
      setSelectedShelterId,
    };
  }, [user, loading, login, logout, refresh, shelterPick, setSelectedShelterId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
