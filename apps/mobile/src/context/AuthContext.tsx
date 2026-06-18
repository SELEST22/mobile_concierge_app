/**
 * Auth state for the whole app: the current user + token, persisted securely.
 *
 * On launch we restore the token from secure storage and verify it with the
 * backend (`/auth/me`) before deciding which navigator to show.
 */
import type { LoginPayload, RegisterPayload, User } from '@concierge/shared';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { clearToken, loadToken, saveToken } from '../lib/storage';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore a saved session on first launch.
  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        if (token) {
          api.setToken(token);
          setUser(await api.me());
        }
      } catch {
        // Token invalid/expired — start signed out.
        await clearToken();
        api.setToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function persistSession(token: string, nextUser: User) {
    api.setToken(token);
    await saveToken(token);
    setUser(nextUser);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === 'admin',
      async login(payload) {
        const { token, user: u } = await api.login(payload);
        await persistSession(token, u);
      },
      async register(payload) {
        const { token, user: u } = await api.register(payload);
        await persistSession(token, u);
      },
      async logout() {
        await clearToken();
        api.setToken(null);
        setUser(null);
      },
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
