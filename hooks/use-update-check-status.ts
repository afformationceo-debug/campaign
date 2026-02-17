'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import type { DailyCheck, CheckStatus } from '@/lib/types/database';

interface UpdateParams {
  id: string;
  status: CheckStatus;
  note?: string;
}

interface CreateParams {
  campaign_id: string | null;
  task_id: string;
  check_date: string;
  assigned_user_id: string;
  status: CheckStatus;
}

export function useUpdateCheckStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: UpdateParams) => {
      const updateData: Record<string, unknown> = { status: params.status };
      if (params.note !== undefined) updateData.note = params.note;

      const { data, error } = await supabase
        .from('daily_checks')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      logActivity({
        userId: data.assigned_user_id,
        actionType: 'update',
        targetTable: 'daily_checks',
        targetId: data.id,
        oldValue: null,
        newValue: { status: data.status, campaign_id: data.campaign_id, task_id: data.task_id },
      });
    },
    onMutate: async ({ id, status }) => {
      // Cancel and optimistically update ALL checks queries (byDate & byDateAndUser)
      await queryClient.cancelQueries({ queryKey: ['checks'] });
      const allQueries = queryClient.getQueriesData<DailyCheck[]>({ queryKey: ['checks'] });
      const previousMap = new Map(allQueries);
      allQueries.forEach(([key]) => {
        queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
          (old || []).map((item) =>
            item.id === id ? { ...item, status } : item
          )
        );
      });
      return { previousMap };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMap) {
        context.previousMap.forEach((data, key) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['checks'] });
    },
  });
}

export function useCreateCheck() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: CreateParams) => {
      const { data, error } = await supabase
        .from('daily_checks')
        .insert({
          campaign_id: params.campaign_id,
          task_id: params.task_id,
          check_date: params.check_date,
          assigned_user_id: params.assigned_user_id,
          status: params.status,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DailyCheck;
    },
    onSuccess: (data) => {
      const key = queryKeys.checks.byDate(data.check_date);
      queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
        [...(old || []), data]
      );
      queryClient.invalidateQueries({ queryKey: ['checks'] });
      logActivity({
        userId: data.assigned_user_id,
        actionType: 'insert',
        targetTable: 'daily_checks',
        targetId: data.id,
        newValue: { status: data.status, campaign_id: data.campaign_id, task_id: data.task_id },
      });
    },
  });
}
