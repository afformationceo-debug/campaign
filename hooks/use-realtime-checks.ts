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
          const key = queryKeys.checks.byDate(date);
          switch (payload.eventType) {
            case 'INSERT':
              queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
                [...(old || []), payload.new as DailyCheck]
              );
              break;
            case 'UPDATE':
              queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
                (old || []).map((item) =>
                  item.id === (payload.new as DailyCheck).id
                    ? (payload.new as DailyCheck)
                    : item
                )
              );
              break;
            case 'DELETE':
              queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
                (old || []).filter((item) => item.id !== (payload.old as DailyCheck).id)
              );
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
