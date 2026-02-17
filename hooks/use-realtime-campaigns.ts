'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import type { Campaign } from '@/lib/types/database';

export function useRealtimeCampaigns() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('campaigns-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        (payload) => {
          const key = queryKeys.campaigns.all;
          switch (payload.eventType) {
            case 'INSERT':
              queryClient.setQueryData(key, (old: Campaign[] | undefined) =>
                [...(old || []), payload.new as Campaign]
              );
              break;
            case 'UPDATE':
              queryClient.setQueryData(key, (old: Campaign[] | undefined) =>
                (old || []).map((item) =>
                  item.id === (payload.new as Campaign).id
                    ? (payload.new as Campaign)
                    : item
                )
              );
              break;
            case 'DELETE':
              queryClient.setQueryData(key, (old: Campaign[] | undefined) =>
                (old || []).filter((item) => item.id !== (payload.old as Campaign).id)
              );
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
