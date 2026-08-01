import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { hydrateTokens, getTokens, setAuthFailureHandler } from '../api/client';
import { login as apiLogin, logout as apiLogout, getMe } from '../api/endpoints';
import { UserProfile, Role } from '../api/types';

export type AuthState = 'loading' | 'signedOut' | 'signedIn';

/** Which role experience a user lands in. Admin/dispatcher/sales → admin tree. */
export type ActiveView = 'driver' | 'admin';

type AuthContextValue = {
  state: AuthState;
  user: UserProfile | null;
  activeView: ActiveView;
  isAdmin: boolean;
  isDriver: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveView: (v: ActiveView) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ADMIN_ROLES: Role[] = ['admin', 'dispatcher', 'sales'];
const hasAny = (roles: Role[] = [], set: Role[]) => roles.some((r) => set.includes(r));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('driver');

  const isAdmin = hasAny(user?.roles, ADMIN_ROLES);
  const isDriver = hasAny(user?.roles, ['driver', 'agent']);

  const loadUser = useCallback(async () => {
    const me = await getMe();
    setUser(me);
    // Default landing view based on roles (admin-ish → admin, else driver).
    setActiveView(hasAny(me.roles, ADMIN_ROLES) ? 'admin' : 'driver');
    return me;
  }, []);

  // Restore session on startup.
  useEffect(() => {
    let alive = true;
    (async () => {
      await hydrateTokens();
      if (!getTokens()) {
        if (alive) setState('signedOut');
        return;
      }
      try {
        await loadUser();
        if (alive) setState('signedIn');
      } catch {
        if (alive) setState('signedOut');
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadUser]);

  // Forced logout when a token refresh fails mid-session.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setState('signedOut');
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const signIn = useCallback(
    async (phone: string, password: string) => {
      await apiLogin(phone, password);
      await loadUser();
      setState('signedIn');
    },
    [loadUser]
  );

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setState('signedOut');
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, user, activeView, isAdmin, isDriver, signIn, signOut, setActiveView, refreshUser }),
    [state, user, activeView, isAdmin, isDriver, signIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
