'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import type { DailyCheck } from '@/lib/types/database';

export function useRealtimeChecks(date: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`daily-checks-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_checks',
          filter: `check_date=eq.${date}`,
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as DailyCheck;
          const byDateKey = queryKeys.checks.byDate(date);

          // Also update the user-specific query cache
          const userId = record?.assigned_user_id;
          const byUserKey = userId
            ? queryKeys.checks.byDateAndUser(date, userId)
            : null;

          const keysToUpdate = byUserKey ? [byDateKey, byUserKey] : [byDateKey];

          switch (payload.eventType) {
            case 'INSERT':
              keysToUpdate.forEach((key) => {
                queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
                  [...(old || []), payload.new as DailyCheck]
                );
              });
              break;
            case 'UPDATE':
              keysToUpdate.forEach((key) => {
                queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
                  (old || []).map((item) =>
                    item.id === (payload.new as DailyCheck).id
                      ? (payload.new as DailyCheck)
                      : item
                  )
                );
              });
              break;
            case 'DELETE':
              keysToUpdate.forEach((key) => {
                queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
                  (old || []).filter((item) => item.id !== (payload.old as DailyCheck).id)
                );
              });
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [date, queryClient]);
}
