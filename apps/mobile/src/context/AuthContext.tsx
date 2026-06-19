/**
 * Auth state for the whole app: the current user, backed by Firebase Auth.
 *
 * Sessions persist via AsyncStorage (configured in `../firebase`), so we just
 * subscribe to `onAuthStateChanged` and load the matching `users/{uid}`
 * Firestore profile — the same user record the web app uses.
 */
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase';
import { createUserProfile, readUserProfile } from '../lib/firestore';
import type { LoginPayload, RegisterPayload, User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return e instanceof Error ? e.message : 'Something went wrong.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore / track the Firebase session.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        setUser(fbUser ? await readUserProfile(fbUser.uid) : null);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });
    return unsub;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === 'admin',
      async login(payload) {
        try {
          const cred = await signInWithEmailAndPassword(auth, payload.email, payload.password);
          setUser(await readUserProfile(cred.user.uid));
        } catch (e) {
          throw new Error(friendlyAuthError(e));
        }
      },
      async register(payload) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
          await updateProfile(cred.user, { displayName: payload.name });
          await createUserProfile(cred.user.uid, {
            email: payload.email,
            name: payload.name,
            role: payload.role ?? 'user',
            organization: payload.organization,
            notificationsConsent: payload.notificationsConsent,
          });
          setUser(await readUserProfile(cred.user.uid));
        } catch (e) {
          throw new Error(friendlyAuthError(e));
        }
      },
      async logout() {
        await signOut(auth);
        setUser(null);
      },
      async refresh() {
        if (auth.currentUser) setUser(await readUserProfile(auth.currentUser.uid));
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
