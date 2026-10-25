import type { ReactNode } from 'react';
import { AuthContext, safeGet, safeSet, SHELTER_KEY } from './AuthContext';
import { getMe } from '../api/auth';
import type { DemoUser, Me } from '../api/types';
import type { AuthContextType } from './AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!safeGet('userId'));
  const [shelterPick, setShelterPick] = useState<string | null>(() => safeGet(SHELTER_KEY));

  const refresh = useCallback(async () => {
    const storedId = safeGet('userId');
    // Always await first to avoid synchronous setState in the calling effect
    const me = storedId ? await getMe().catch(() => null) : null;
    if (storedId && !me) safeSet('userId', null); // stored session is no longer valid — drop it
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
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