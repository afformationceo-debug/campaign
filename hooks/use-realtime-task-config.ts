'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import type { CampaignTaskConfig } from '@/lib/types/database';

export function useRealtimeTaskConfig() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('task-config-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_task_config' },
        (payload) => {
          const key = queryKeys.taskConfig.all;
          switch (payload.eventType) {
            case 'INSERT':
              queryClient.setQueryData(key, (old: CampaignTaskConfig[] | undefined) =>
                [...(old || []), payload.new as CampaignTaskConfig]
              );
              break;
            case 'UPDATE':
              queryClient.setQueryData(key, (old: CampaignTaskConfig[] | undefined) =>
                (old || []).map((item) =>
                  item.id === (payload.new as CampaignTaskConfig).id
                    ? (payload.new as CampaignTaskConfig)
                    : item
                )
              );
              break;
            case 'DELETE':
              queryClient.setQueryData(key, (old: CampaignTaskConfig[] | undefined) =>
                (old || []).filter((item) => item.id !== (payload.old as CampaignTaskConfig).id)
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
