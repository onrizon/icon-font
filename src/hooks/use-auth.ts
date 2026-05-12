'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

let currentUser: User | null = null;

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      currentUser = u;
      setUser(toAuthUser(u));
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  return { user, loading, signIn, signOut };
}

export async function getIdToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not authenticated');
  return u.getIdToken();
}
