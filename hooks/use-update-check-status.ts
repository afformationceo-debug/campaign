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
  result_value?: string;
}

interface CreateParams {
  campaign_id: string | null;
  task_id: string;
  check_date: string;
  assigned_user_id: string;
  status: CheckStatus;
  note?: string;
  result_value?: string;
}

export function useUpdateCheckStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: UpdateParams) => {
      const updateData: Record<string, unknown> = { status: params.status };
      if (params.note !== undefined) updateData.note = params.note;
      if (params.result_value !== undefined) updateData.result_value = params.result_value;

      // Track started_at / completed_at based on status
      if (params.status === '진행중') {
        updateData.started_at = new Date().toISOString();
        updateData.completed_at = null;
      } else if (params.status === '완료') {
        updateData.completed_at = new Date().toISOString();
      } else {
        // 미완료 or 해당없음 — reset timing
        updateData.started_at = null;
        updateData.completed_at = null;
      }

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
    onMutate: async ({ id, status, note, result_value }) => {
      // Cancel and optimistically update ALL checks queries (byDate & byDateAndUser)
      await queryClient.cancelQueries({ queryKey: ['checks'] });
      const allQueries = queryClient.getQueriesData<DailyCheck[]>({ queryKey: ['checks'] });
      const previousMap = new Map(allQueries);

      // Build optimistic timestamp fields
      const now = new Date().toISOString();
      const timestampFields: Record<string, string | null> =
        status === '진행중'
          ? { started_at: now, completed_at: null }
          : status === '완료'
            ? { completed_at: now }
            : { started_at: null, completed_at: null };

      allQueries.forEach(([key]) => {
        queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
          (old || []).map((item) =>
            item.id === id
              ? { ...item, status, ...timestampFields, ...(note !== undefined && { note }), ...(result_value !== undefined && { result_value }) }
              : item
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
    onSettled: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.checks.byDate(data.check_date),
          exact: true,
        });
        if (data.assigned_user_id) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.checks.byDateAndUser(data.check_date, data.assigned_user_id),
            exact: true,
          });
        }
        // Also invalidate monthly/periodic queries
        const ym = data.check_date.slice(0, 7); // 'yyyy-MM'
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.byMonth(ym), exact: true });
        if (data.assigned_user_id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.byMonthAndUser(ym, data.assigned_user_id), exact: true });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.onceCompleted, exact: true });
        // Invalidate results queries
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.resultsByDate(data.check_date), exact: true });
        if (data.assigned_user_id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.resultsByDateAndUser(data.check_date, data.assigned_user_id), exact: true });
        }
        // Invalidate periodic results queries
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.periodicResultsByMonth(ym), exact: true });
        if (data.assigned_user_id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.periodicResultsByMonthAndUser(ym, data.assigned_user_id), exact: true });
        }
      }
    },
  });
}

export function useCreateCheck() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: CreateParams) => {
      const insertData: Record<string, unknown> = {
        campaign_id: params.campaign_id,
        task_id: params.task_id,
        check_date: params.check_date,
        assigned_user_id: params.assigned_user_id,
        status: params.status,
      };
      if (params.note !== undefined) insertData.note = params.note;
      if (params.result_value !== undefined) insertData.result_value = params.result_value;

      // Track started_at / completed_at based on status
      if (params.status === '진행중') {
        insertData.started_at = new Date().toISOString();
      } else if (params.status === '완료') {
        const now = new Date().toISOString();
        insertData.started_at = now;
        insertData.completed_at = now;
      }

      const { data, error } = await supabase
        .from('daily_checks')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data as DailyCheck;
    },
    onSuccess: (data) => {
      // Update the byDate cache
      const key = queryKeys.checks.byDate(data.check_date);
      queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
        [...(old || []), data]
      );
      // Also update the byDateAndUser cache if applicable
      if (data.assigned_user_id) {
        const userKey = queryKeys.checks.byDateAndUser(data.check_date, data.assigned_user_id);
        queryClient.setQueryData(userKey, (old: DailyCheck[] | undefined) =>
          [...(old || []), data]
        );
      }
      // Targeted invalidation
      queryClient.invalidateQueries({
        queryKey: queryKeys.checks.byDate(data.check_date),
        exact: true,
      });
      if (data.assigned_user_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.checks.byDateAndUser(data.check_date, data.assigned_user_id),
          exact: true,
        });
      }
      // Also invalidate monthly/periodic queries
      const ym = data.check_date.slice(0, 7);
      queryClient.invalidateQueries({ queryKey: queryKeys.checks.byMonth(ym), exact: true });
      if (data.assigned_user_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.byMonthAndUser(ym, data.assigned_user_id), exact: true });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.checks.onceCompleted, exact: true });
      // Invalidate results queries
      queryClient.invalidateQueries({ queryKey: queryKeys.checks.resultsByDate(data.check_date), exact: true });
      if (data.assigned_user_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.resultsByDateAndUser(data.check_date, data.assigned_user_id), exact: true });
      }
      // Invalidate periodic results queries
      queryClient.invalidateQueries({ queryKey: queryKeys.checks.periodicResultsByMonth(ym), exact: true });
      if (data.assigned_user_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.periodicResultsByMonthAndUser(ym, data.assigned_user_id), exact: true });
      }
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
