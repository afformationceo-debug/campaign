'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import type { CampaignConfig } from '@/lib/types/database';

/**
 * Subscribe to realtime changes on campaign_configs table.
 * Updates both per-campaign and all-configs query caches so every
 * open browser tab/PC reflects changes instantly.
 */
export function useRealtimeConfigs(campaignId?: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('campaign-configs-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_configs' },
        (payload) => {
          const record = (payload.new ?? payload.old) as CampaignConfig;

          // Update the all-configs cache (used by config-matrix)
          queryClient.invalidateQueries({ queryKey: queryKeys.configs.all });

          // Update the per-campaign cache if it matches
          if (record?.campaign_id) {
            const key = queryKeys.configs.byCampaign(record.campaign_id);
            switch (payload.eventType) {
              case 'INSERT':
                queryClient.setQueryData(key, (old: CampaignConfig[] | undefined) =>
                  [...(old || []), payload.new as CampaignConfig]
                );
                break;
              case 'UPDATE':
                queryClient.setQueryData(key, (old: CampaignConfig[] | undefined) =>
                  (old || []).map((item) =>
                    item.id === (payload.new as CampaignConfig).id
                      ? (payload.new as CampaignConfig)
                      : item
                  )
                );
                break;
              case 'DELETE':
                queryClient.setQueryData(key, (old: CampaignConfig[] | undefined) =>
                  (old || []).filter(
                    (item) => item.id !== (payload.old as CampaignConfig).id
                  )
                );
                break;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
