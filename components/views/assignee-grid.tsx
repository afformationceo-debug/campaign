'use client';

import { useMemo, useCallback, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, CheckCircle2, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { useRealtimeChecks } from '@/hooks/use-realtime-checks';
import { useRealtimeTaskConfig } from '@/hooks/use-realtime-task-config';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
import { useAuth } from '@/hooks/use-auth';
import { StatusCell } from '@/components/views/status-cell';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Task,
  Campaign,
  DailyCheck,
  CampaignTaskConfig,
  TaskCategory,
} from '@/lib/types/database';

// ─── Inline Result Value Input ───────────────────────
function ResultValueInput({
  check,
  taskId,
  date,
  assigneeId,
  campaignId,
}: {
  check: DailyCheck | null;
  taskId: string;
  date: string;
  assigneeId: string;
  campaignId?: string;
}) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    setValue(check?.result_value ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (!check) {
      if (!trimmed) return;
      createCheck({
        campaign_id: campaignId ?? null,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '진행중',
        result_value: trimmed,
      });
    } else {
      if (trimmed === (check.result_value ?? '')) return;
      updateStatus({ id: check.id, status: check.status, result_value: trimmed });
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full text-[11px] bg-transparent border-b border-primary/40 outline-none px-0.5 py-0"
        placeholder="결과값 입력..."
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className={cn(
        'w-full text-left text-[11px] px-0.5 py-0 truncate rounded hover:bg-accent/50 transition-colors cursor-text min-h-[18px]',
        check?.result_value ? 'text-foreground' : 'text-muted-foreground/30'
      )}
    >
      {check?.result_value || '-'}
    </button>
  );
}

interface AssigneeGridProps {
  date: string;
  assigneeId: string | null;
  assigneeName?: string | null;
  categories: TaskCategory[];
}

export function AssigneeGrid({ date, assigneeId, assigneeName, categories }: AssigneeGridProps) {
  const supabase = createClient();
  const { profile } = useAuth();

  // When "전체 담당자" (assigneeId=null), use current user's profile ID
  // to avoid checkMap collision from multiple users' checks
  const effectiveUserId = assigneeId ?? profile?.id ?? '';

  const { mutate: bulkUpdateStatus } = useUpdateCheckStatus();
  const { mutate: bulkCreateCheck } = useCreateCheck();

  // Subscribe to realtime updates
  useRealtimeChecks(date);
  useRealtimeTaskConfig();

  // Fetch daily checks for the selected date, always filtered by user
  const { data: checks = [], isLoading: checksLoading } = useQuery({
    queryKey: queryKeys.checks.byDateAndUser(date, effectiveUserId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .eq('check_date', date)
        .eq('assigned_user_id', effectiveUserId);
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
    enabled: !!effectiveUserId,
  });

  // Fetch all tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('loop_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  // Fetch campaigns (active only)
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: queryKeys.campaigns.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active')
        .order('campaign_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  // Fetch campaign_task_config (paginated to bypass PostgREST 1000 row limit)
  const { data: taskConfigs = [], isLoading: configsLoading } = useQuery({
    queryKey: queryKeys.taskConfig.all,
    queryFn: () => fetchAll<CampaignTaskConfig>(supabase, 'campaign_task_config'),
  });

  // Build config lookup: campaign_id + task_id -> config
  const configMap = useMemo(() => {
    const map = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((config) => {
      map.set(`${config.campaign_id}:${config.task_id}`, config);
    });
    return map;
  }, [taskConfigs]);

  // Build check lookup: campaign_id + task_id -> check
  const checkMap = useMemo(() => {
    const map = new Map<string, DailyCheck>();
    checks.forEach((check) => {
      map.set(`${check.campaign_id}:${check.task_id}`, check);
    });
    return map;
  }, [checks]);

  // Filter tasks by selected categories AND by assignee's default_assignees
  // Also exclude monthly/once/as_needed tasks (they go to periodic section)
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter((t) => t.frequency === 'daily' || t.frequency === 'weekly');

    // Filter by categories
    if (categories.length > 0) {
      filtered = filtered.filter((task) => categories.includes(task.category));
    }

    // Filter by assignee name: show only tasks assigned to this user
    // If default_assignees is null or empty, the task is available to everyone
    if (assigneeName) {
      filtered = filtered.filter((task) => {
        if (!task.default_assignees || task.default_assignees.length === 0) {
          return true; // no assignees specified = available to all
        }
        return task.default_assignees.some(
          (name) => name.trim() === assigneeName
        );
      });
    }

    return filtered;
  }, [tasks, categories, assigneeName]);

  // Split into campaign-scope and global-scope tasks
  const campaignScopeTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.scope !== 'global');
  }, [filteredTasks]);

  const globalTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.scope === 'global');
  }, [filteredTasks]);

  // Group campaign-scope tasks by category in CATEGORY_ORDER
  const taskGroups = useMemo(() => {
    const groups: { category: TaskCategory; tasks: Task[] }[] = [];
    for (const category of CATEGORY_ORDER) {
      const catTasks = campaignScopeTasks.filter((t) => t.category === category);
      if (catTasks.length > 0) {
        groups.push({ category, tasks: catTasks });
      }
    }
    return groups;
  }, [campaignScopeTasks]);

  // Filter campaigns: only those with at least one applicable campaign-scope task
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      return campaignScopeTasks.some((task) => {
        const config = configMap.get(`${campaign.id}:${task.id}`);
        const applicable = config ? config.is_applicable : task.is_applicable_default;
        return applicable;
      });
    });
  }, [campaigns, campaignScopeTasks, configMap]);

  // Helper: is task applicable for a campaign?
  const isApplicable = (campaignId: string, taskId: string): boolean => {
    const config = configMap.get(`${campaignId}:${taskId}`);
    if (config) return config.is_applicable;
    const task = tasks.find((t) => t.id === taskId);
    return task?.is_applicable_default ?? true;
  };

  // Calculate summary per task row (across campaigns)
  const taskSummary = useMemo(() => {
    const summary = new Map<string, { completed: number; total: number }>();
    campaignScopeTasks.forEach((task) => {
      let completed = 0;
      let total = 0;
      filteredCampaigns.forEach((campaign) => {
        if (isApplicable(campaign.id, task.id)) {
          total++;
          const check = checkMap.get(`${campaign.id}:${task.id}`);
          if (check?.status === '완료' || check?.status === '해당없음') completed++;
        }
      });
      summary.set(task.id, { completed, total });
    });
    return summary;
  }, [campaignScopeTasks, filteredCampaigns, checkMap, configMap]);

  // Calculate summary per campaign column (across tasks)
  const campaignSummary = useMemo(() => {
    const summary = new Map<string, { completed: number; total: number }>();
    filteredCampaigns.forEach((campaign) => {
      let completed = 0;
      let total = 0;
      campaignScopeTasks.forEach((task) => {
        if (isApplicable(campaign.id, task.id)) {
          total++;
          const check = checkMap.get(`${campaign.id}:${task.id}`);
          if (check?.status === '완료' || check?.status === '해당없음') completed++;
        }
      });
      summary.set(campaign.id, { completed, total });
    });
    return summary;
  }, [filteredCampaigns, campaignScopeTasks, checkMap, configMap]);

  // Bulk complete: mark all applicable campaigns for a task as '완료'
  const handleBulkComplete = useCallback((task: Task) => {
    filteredCampaigns.forEach((campaign) => {
      if (!isApplicable(campaign.id, task.id)) return;
      const check = checkMap.get(`${campaign.id}:${task.id}`);
      if (check?.status === '완료' || check?.status === '해당없음') return;

      if (!check) {
        bulkCreateCheck({
          campaign_id: campaign.id,
          task_id: task.id,
          check_date: date,
          assigned_user_id: effectiveUserId,
          status: '완료',
        });
      } else {
        bulkUpdateStatus({ id: check.id, status: '완료' });
      }
    });
  }, [filteredCampaigns, checkMap, date, effectiveUserId, bulkCreateCheck, bulkUpdateStatus]);

  const isLoading = checksLoading || tasksLoading || campaignsLoading || configsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
          <span className="text-sm">데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (filteredCampaigns.length === 0 && globalTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground gap-2">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <span className="text-lg">📋</span>
        </div>
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
    {/* Global Tasks Section (table layout) */}
    {globalTasks.length > 0 && (
      <TooltipProvider>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 border-b bg-violet-50 dark:bg-violet-950/20 flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-violet-400" />
          <h3 className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            전역 업무
          </h3>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
            {globalTasks.length}건
          </Badge>
        </div>
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" style={{ width: '24%' }}>업무</th>
              <th className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" style={{ width: '9%' }}>카테고리</th>
              <th className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" style={{ width: '10%' }}>담당자</th>
              <th className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" style={{ width: '10%' }}>도구</th>
              <th className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground text-center" style={{ width: '7%' }}>상태</th>
              <th className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" style={{ width: '40%' }}>결과값</th>
            </tr>
          </thead>
          <tbody>
            {globalTasks.map((task) => {
              const check = checkMap.get(`null:${task.id}`) ?? null;
              const assignees = task.default_assignees?.join(', ') || null;
              const catColor = CATEGORY_COLORS[task.category];
              return (
                <tr key={task.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors h-7">
                  <td className="px-2 py-0 max-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[11px] font-medium truncate block cursor-default">{task.task_name}</span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[300px]">
                        <p className="text-xs font-medium">{task.task_name}</p>
                        {task.description && <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-2 py-0">
                    <Badge variant="outline" className={cn('text-[8px] px-1 py-0', catColor?.text ?? '', catColor?.bg ?? '')}>
                      {task.category}
                    </Badge>
                  </td>
                  <td className="px-2 py-0">
                    <span className="text-[10px] text-muted-foreground truncate block whitespace-nowrap">{assignees || '-'}</span>
                  </td>
                  <td className="px-2 py-0">
                    <span className="text-[10px] text-muted-foreground truncate block whitespace-nowrap">{task.tool || '-'}</span>
                  </td>
                  <td className="px-2 py-0">
                    <div className="flex items-center justify-center">
                      <StatusCell
                        check={check}
                        isApplicable={true}
                        taskId={task.id}
                        date={date}
                        assigneeId={effectiveUserId || undefined}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-0">
                    <ResultValueInput
                      check={check}
                      taskId={task.id}
                      date={date}
                      assigneeId={effectiveUserId}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </TooltipProvider>
    )}

    {/* Campaign-scope Tasks Grid */}
    {filteredCampaigns.length > 0 && campaignScopeTasks.length > 0 && (
    <TooltipProvider>
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="px-3 py-1.5 border-b bg-blue-50 dark:bg-blue-950/20 flex items-center gap-2">
        <div className="w-1.5 h-4 rounded-full bg-blue-400" />
        <h3 className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
          일일 캠페인별 업무
        </h3>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
          {filteredCampaigns.length}개 캠페인
        </Badge>
      </div>
    <div className="relative overflow-auto max-h-[calc(100vh-260px)]">
      <table className="w-max min-w-full border-collapse">
        {/* Header Row: Campaign Names (sticky top) */}
        <thead>
          <tr>
            {/* Top-left corner cell (sticky both directions) */}
            <th
              className={cn(
                'sticky left-0 top-0 z-30 min-w-[180px] max-w-[220px]',
                'bg-background border-b border-r px-3 py-1',
                'text-left text-[11px] font-semibold text-muted-foreground'
              )}
            >
              업무
            </th>
            {filteredCampaigns.map((campaign) => {
              const countryShort = campaign.target_country
                ? campaign.target_country.replace('중화권(홍,말,싱)', '중화').slice(0, 2)
                : '';
              return (
                <th
                  key={campaign.id}
                  className={cn(
                    'sticky top-0 z-20',
                    'bg-background border-b px-0.5 py-1',
                    'text-center min-w-[36px] max-w-[40px]'
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-0 cursor-help">
                        <span className="text-[9px] font-semibold text-foreground leading-tight">
                          {campaign.client_name.slice(0, 2)}
                        </span>
                        {countryShort && (
                          <span className="text-[7px] text-muted-foreground/70 leading-tight">
                            {countryShort}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px]">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs">{campaign.client_name}</div>
                        <div className="text-[10px] opacity-80">{campaign.campaign_name}</div>
                        {campaign.target_country && (
                          <div className="text-[10px] opacity-70">{campaign.target_country}</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </th>
              );
            })}
            {/* Summary column header */}
            <th
              className={cn(
                'sticky top-0 right-0 z-20',
                'bg-background border-b border-l px-2 py-1',
                'text-center text-[10px] font-semibold text-muted-foreground',
                'min-w-[56px]'
              )}
            >
              완료율
            </th>
          </tr>
        </thead>

        <tbody>
          {taskGroups.map((group) => {
            const catColors = CATEGORY_COLORS[group.category];
            return (
              <Fragment key={group.category}>
                {/* Category Group Header */}
                <tr>
                  <td
                    colSpan={filteredCampaigns.length + 2}
                    className={cn(
                      'sticky left-0 z-10',
                      'px-3 py-0.5 text-[11px] font-semibold',
                      catColors.bg,
                      catColors.darkBg,
                      catColors.text,
                      catColors.border,
                      'border-b'
                    )}
                  >
                    {group.category}
                  </td>
                </tr>

                {/* Task Rows */}
                {group.tasks.map((task) => {
                  const summary = taskSummary.get(task.id);
                  const pct =
                    summary && summary.total > 0
                      ? Math.round((summary.completed / summary.total) * 100)
                      : 0;

                  return (
                    <tr key={task.id} className={cn(
                      'hover:bg-muted/30 transition-colors',
                      pct === 100 && 'bg-gradient-to-r from-emerald-50/60 via-emerald-50/30 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/10 dark:to-transparent'
                    )}>
                      {/* Task Name (sticky left) */}
                      <td
                        className={cn(
                          'sticky left-0 z-10',
                          'border-b border-r px-3 py-0.5',
                          'text-[11px] font-medium text-foreground',
                          'min-w-[180px] max-w-[220px]',
                          pct === 100
                            ? 'bg-gradient-to-r from-emerald-50/80 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10 border-l-[3px] border-l-emerald-400'
                            : 'bg-background'
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          {pct === 100 && (
                            <div className="flex items-center justify-center size-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                              <Trophy className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn('truncate cursor-default', pct === 100 && 'text-emerald-800 dark:text-emerald-300')}>{task.task_name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[300px]">
                              <p className="text-xs font-medium">{task.task_name}</p>
                              {task.description && <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>}
                              {task.default_assignees?.length ? (
                                <p className="text-[10px] text-muted-foreground mt-0.5">담당: {task.default_assignees.join(', ')}</p>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                          {summary && summary.completed < summary.total && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => handleBulkComplete(task)}
                                  className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 transition-colors"
                                >
                                  <ListChecks className="size-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right"><p className="text-xs">캠페인 전체 완료</p></TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {!assigneeName && task.default_assignees && task.default_assignees.length > 0 && (
                          <span className="text-[9px] text-muted-foreground/70 truncate block">
                            {task.default_assignees.join(', ')}
                          </span>
                        )}
                      </td>

                      {/* Status Cells */}
                      {filteredCampaigns.map((campaign) => {
                        const applicable = isApplicable(campaign.id, task.id);
                        const check = checkMap.get(`${campaign.id}:${task.id}`) ?? null;

                        return (
                          <td
                            key={campaign.id}
                            className="border-b px-0.5 py-0 text-center"
                          >
                            <div className="flex items-center justify-center">
                              <StatusCell
                                check={check}
                                isApplicable={applicable}
                                campaignId={campaign.id}
                                taskId={task.id}
                                date={date}
                                assigneeId={effectiveUserId || undefined}
                              />
                            </div>
                          </td>
                        );
                      })}

                      {/* Task Summary */}
                      <td
                        className={cn(
                          'sticky right-0 z-10',
                          'border-b border-l px-2 py-0.5',
                          'text-center',
                          pct === 100
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/20'
                            : 'bg-background'
                        )}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {summary?.completed ?? 0}/{summary?.total ?? 0}
                          </span>
                          {pct === 100 ? (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 gap-0.5"
                            >
                              <CheckCircle2 className="size-2.5" />
                              100%
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[9px] px-1.5 py-0',
                                pct > 0 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                                pct === 0 && 'bg-gray-100 text-gray-500'
                              )}
                            >
                              {pct}%
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}

          {/* Bottom Summary Row */}
          <tr>
            <td
              className={cn(
                'sticky left-0 z-10',
                'bg-muted/50 border-t-2 px-3 py-1',
                'text-[11px] font-semibold text-foreground'
              )}
            >
              캠페인 완료율
            </td>
            {filteredCampaigns.map((campaign) => {
              const summary = campaignSummary.get(campaign.id);
              const cPct =
                summary && summary.total > 0
                  ? Math.round((summary.completed / summary.total) * 100)
                  : 0;

              return (
                <td
                  key={campaign.id}
                  className={cn(
                    'border-t-2 px-1 py-1 text-center',
                    cPct === 100
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/20'
                      : 'bg-muted/50'
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {summary?.completed ?? 0}/{summary?.total ?? 0}
                    </span>
                    {cPct === 100 ? (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 gap-0.5"
                      >
                        <CheckCircle2 className="size-2.5" />
                        100%
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] px-1.5 py-0',
                          cPct > 0 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                          cPct === 0 && 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {cPct}%
                      </Badge>
                    )}
                  </div>
                </td>
              );
            })}
            <td
              className={cn(
                'sticky right-0 z-10',
                'bg-muted/50 border-t-2 border-l px-2 py-1 text-center'
              )}
            >
              {(() => {
                let totalCompleted = 0;
                let totalAll = 0;
                campaignSummary.forEach((s) => {
                  totalCompleted += s.completed;
                  totalAll += s.total;
                });
                const totalPct =
                  totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;
                return (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] px-2 py-0.5 font-semibold',
                      totalPct === 100 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                      totalPct > 0 && totalPct < 100 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                      totalPct === 0 && 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {totalPct}%
                  </Badge>
                );
              })()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
    </TooltipProvider>
    )}
    </div>
  );
}

// Fragment helper for grouping without extra DOM nodes
function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
