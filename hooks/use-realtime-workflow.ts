'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';

export function useRealtimeWorkflow(campaignId?: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channels = [
      supabase
        .channel('collab-products-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'collaboration_products' }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.collabProducts.all });
        })
        .subscribe(),

      supabase
        .channel('campaign-products-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_products' }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.campaignProducts.all });
          if (campaignId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaignProducts.byCampaign(campaignId) });
          }
        })
        .subscribe(),

      supabase
        .channel('workflow-checks-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_workflow_checks' }, () => {
          if (campaignId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(campaignId) });
          }
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient, campaignId]);
}
