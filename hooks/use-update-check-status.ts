'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import type { DailyCheck, CheckStatus } from '@/lib/types/database';

interface UpdateParams {
  id: string;
  status: CheckStatus;
  assigned_user_id?: string;
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
  start_time?: string | null;
  end_time?: string | null;
}

export function useUpdateCheckStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: UpdateParams) => {
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status: params.status,
        updated_at: now,
      };
      if (params.note !== undefined) updateData.note = params.note;
      if (params.result_value !== undefined) updateData.result_value = params.result_value;

      // started_at = 최초 입력 시간 (한번 설정되면 유지)
      // First, check if started_at already exists
      const { data: existing } = await supabase
        .from('daily_checks')
        .select('started_at, assigned_user_id')
        .eq('id', params.id)
        .single();

      if (!existing?.started_at) {
        updateData.started_at = now;
      }

      if (
        params.assigned_user_id !== undefined &&
        params.assigned_user_id !== existing?.assigned_user_id
      ) {
        updateData.assigned_user_id = params.assigned_user_id;
      }

      // completed_at tracks completion
      if (params.status === '완료') {
        updateData.completed_at = now;
      } else {
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from('daily_checks')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return {
        data: data as DailyCheck,
        previousAssignedUserId: existing?.assigned_user_id ?? null,
      };
    },
    onSuccess: ({ data }) => {
      logActivity({
        userId: data.assigned_user_id,
        actionType: 'update',
        targetTable: 'daily_checks',
        targetId: data.id,
        oldValue: null,
        newValue: { status: data.status, campaign_id: data.campaign_id, task_id: data.task_id },
      });
    },
    onMutate: async ({ id, status, assigned_user_id, note, result_value }) => {
      // Cancel and optimistically update ALL checks queries (byDate & byDateAndUser)
      await queryClient.cancelQueries({ queryKey: ['checks'] });
      const allQueries = queryClient.getQueriesData<DailyCheck[]>({ queryKey: ['checks'] });
      const previousMap = new Map(allQueries);

      // Build optimistic timestamp fields
      const now = new Date().toISOString();

      allQueries.forEach(([key]) => {
        queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
          (old || []).map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              status,
              updated_at: now,
              // started_at: keep existing or set if first time
              started_at: item.started_at || now,
              completed_at: status === '완료' ? now : null,
              ...(assigned_user_id !== undefined && { assigned_user_id }),
              ...(note !== undefined && { note }),
              ...(result_value !== undefined && { result_value }),
            };
          })
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
    onSettled: (result) => {
      if (result) {
        const data = result.data;
        const previousAssignedUserId = result.previousAssignedUserId;
        queryClient.invalidateQueries({
          queryKey: queryKeys.checks.byDate(data.check_date),
          exact: true,
        });
        if (previousAssignedUserId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.checks.byDateAndUser(data.check_date, previousAssignedUserId),
            exact: true,
          });
        }
        if (data.assigned_user_id) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.checks.byDateAndUser(data.check_date, data.assigned_user_id),
            exact: true,
          });
        }
        // Also invalidate monthly/periodic queries
        const ym = data.check_date.slice(0, 7); // 'yyyy-MM'
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.byMonth(ym), exact: true });
        if (previousAssignedUserId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.byMonthAndUser(ym, previousAssignedUserId), exact: true });
        }
        if (data.assigned_user_id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.byMonthAndUser(ym, data.assigned_user_id), exact: true });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.onceCompleted, exact: true });
        // Invalidate results queries
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.resultsByDate(data.check_date), exact: true });
        if (previousAssignedUserId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.resultsByDateAndUser(data.check_date, previousAssignedUserId), exact: true });
        }
        if (data.assigned_user_id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.resultsByDateAndUser(data.check_date, data.assigned_user_id), exact: true });
        }
        // Invalidate periodic results queries
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.periodicResultsByMonth(ym), exact: true });
        if (previousAssignedUserId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.checks.periodicResultsByMonthAndUser(ym, previousAssignedUserId), exact: true });
        }
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

      // Timeslot: use explicit params or copy from most recent check
      if (params.start_time !== undefined) {
        insertData.start_time = params.start_time;
        insertData.end_time = params.end_time ?? null;
      } else {
        // Copy timeslot from the most recent check for same task+user
        const { data: prev } = await supabase
          .from('daily_checks')
          .select('start_time, end_time')
          .eq('task_id', params.task_id)
          .eq('assigned_user_id', params.assigned_user_id)
          .not('start_time', 'is', null)
          .order('check_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prev?.start_time) {
          insertData.start_time = prev.start_time;
          insertData.end_time = prev.end_time;
        }
      }

      // Always set started_at on first creation (최초 입력시간)
      const now = new Date().toISOString();
      insertData.started_at = now;
      insertData.updated_at = now;
      if (params.status === '완료') {
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

interface TimeslotParams {
  checkId: string;
  start_time: string | null;
  end_time: string | null;
}

export function useUpdateTimeslot() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: TimeslotParams) => {
      const { data, error } = await supabase
        .from('daily_checks')
        .update({
          start_time: params.start_time,
          end_time: params.end_time,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.checkId)
        .select()
        .single();
      if (error) throw error;
      return data as DailyCheck;
    },
    onMutate: async ({ checkId, start_time, end_time }) => {
      await queryClient.cancelQueries({ queryKey: ['checks'] });
      const allQueries = queryClient.getQueriesData<DailyCheck[]>({ queryKey: ['checks'] });
      const previousMap = new Map(allQueries);

      allQueries.forEach(([key]) => {
        queryClient.setQueryData(key, (old: DailyCheck[] | undefined) =>
          (old || []).map((item) =>
            item.id === checkId ? { ...item, start_time, end_time } : item
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
