'use client';

import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { User as AppUser } from '@/lib/types/database';
import type { User as AuthUser } from '@supabase/supabase-js';

const AUTH_QUERY_KEY = ['auth', 'user'] as const;
const PROFILE_QUERY_KEY = ['auth', 'profile'] as const;

export function useAuth() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Cache auth user with TanStack Query
  const { data: authUser = null, isLoading: authLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Cache profile with TanStack Query (depends on authUser)
  const { data: profile = null, isLoading: profileLoading } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: async () => {
      if (!authUser) return null;
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      return data as AppUser | null;
    },
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,
  });

  // Listen for auth state changes and invalidate cache
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          queryClient.setQueryData(AUTH_QUERY_KEY, session.user);
          queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        } else {
          queryClient.setQueryData(AUTH_QUERY_KEY, null);
          queryClient.setQueryData(PROFILE_QUERY_KEY, null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [queryClient, supabase]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    }
    return { error };
  }, [supabase, queryClient]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    queryClient.setQueryData(PROFILE_QUERY_KEY, null);
  }, [supabase, queryClient]);

  const isLoading = authLoading || (!!authUser && profileLoading);

  return { user: authUser as AuthUser | null, profile, isLoading, signIn, signOut };
}
