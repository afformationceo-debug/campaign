'use client';

import { useAuth } from './use-auth';

export function useIsAdmin(): boolean | null {
  const { profile, isLoading } = useAuth();
  if (isLoading) return null;
  return profile?.role === 'admin';
}
