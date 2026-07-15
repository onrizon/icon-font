'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from '@/lib/auth-domain';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export const DOMAIN_ERROR_MESSAGE = `Use your @${ALLOWED_EMAIL_DOMAIN} Google account to sign in.`;

let currentUser: User | null = null;
// Module-level so the message survives the sign-out redirect chain and the
// login page can still show why the session was rejected after remounting.
let domainError: string | null = null;

function isAllowedUser(u: User): boolean {
  return isAllowedEmail(u.email) && u.emailVerified;
}

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return {
    id: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(toAuthUser(currentUser));
  const [loading, setLoading] = useState(currentUser === null);
  const [authError, setAuthError] = useState<string | null>(domainError);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (u && !isAllowedUser(u)) {
        // Non-domain session (e.g. signed in before enforcement): sign out and
        // surface a friendly message. Rules + API routes are the real gate.
        domainError = DOMAIN_ERROR_MESSAGE;
        currentUser = null;
        setUser(null);
        setAuthError(domainError);
        setLoading(false);
        void fbSignOut(auth);
        return;
      }
      currentUser = u;
      setUser(toAuthUser(u));
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    domainError = null;
    setAuthError(null);
    const result = await signInWithPopup(auth, googleProvider);
    if (!isAllowedUser(result.user)) {
      await fbSignOut(auth);
      throw new Error(DOMAIN_ERROR_MESSAGE); // login page's catch renders it
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  return { user, loading, authError, signIn, signOut };
}

export async function getIdToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not authenticated');
  return u.getIdToken();
}
