'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { useRealtimeChecks } from '@/hooks/use-realtime-checks';
import { useRealtimeTaskConfig } from '@/hooks/use-realtime-task-config';
import { useAuth } from '@/hooks/use-auth';
import { StatusCell } from '@/components/views/status-cell';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Trophy } from 'lucide-react';
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

interface CampaignGridProps {
  date: string;
  countryFilter: string;
  searchText: string;
  statusFilter: string;
  onCampaignClick?: (campaignId: string) => void;
}

export function CampaignGrid({
  date,
  countryFilter,
  searchText,
  statusFilter,
  onCampaignClick,
}: CampaignGridProps) {
  const supabase = createClient();
  const { profile } = useAuth();

  // Subscribe to realtime updates
  useRealtimeChecks(date);
  useRealtimeTaskConfig();

  // Fetch daily checks for the selected date, filtered by current user
  // to avoid checkMap collision from multiple users' checks
  const effectiveUserId = profile?.id ?? '';
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

  // Fetch all campaigns
  const { data: allCampaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
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

  // Build config lookup
  const configMap = useMemo(() => {
    const map = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((config) => {
      map.set(`${config.campaign_id}:${config.task_id}`, config);
    });
    return map;
  }, [taskConfigs]);

  // Build check lookup
  const checkMap = useMemo(() => {
    const map = new Map<string, DailyCheck>();
    checks.forEach((check) => {
      map.set(`${check.campaign_id}:${check.task_id}`, check);
    });
    return map;
  }, [checks]);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    let filtered = allCampaigns;

    if (statusFilter) {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (countryFilter) {
      filtered = filtered.filter(
        (c) => c.target_country === countryFilter
      );
    }

    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.client_name.toLowerCase().includes(lower) ||
          c.campaign_name.toLowerCase().includes(lower)
      );
    }

    return filtered;
  }, [allCampaigns, statusFilter, countryFilter, searchText]);

  // Filter out global tasks AND non-daily/weekly tasks (monthly/once/as_needed go to periodic section)
  const campaignTasks = useMemo(() => {
    return tasks.filter((t) => t.scope !== 'global' && (t.frequency === 'daily' || t.frequency === 'weekly'));
  }, [tasks]);

  // Group tasks by category
  const taskGroups = useMemo(() => {
    const groups: { category: TaskCategory; tasks: Task[] }[] = [];
    for (const category of CATEGORY_ORDER) {
      const catTasks = campaignTasks.filter((t) => t.category === category);
      if (catTasks.length > 0) {
        groups.push({ category, tasks: catTasks });
      }
    }
    return groups;
  }, [campaignTasks]);

  // Helper: is task applicable for a campaign?
  const isApplicable = (campaignId: string, taskId: string): boolean => {
    const config = configMap.get(`${campaignId}:${taskId}`);
    if (config) return config.is_applicable;
    const task = tasks.find((t) => t.id === taskId);
    return task?.is_applicable_default ?? true;
  };

  // Calculate summary per campaign
  const campaignSummary = useMemo(() => {
    const summary = new Map<
      string,
      { completed: number; applicable: number; total: number }
    >();
    filteredCampaigns.forEach((campaign) => {
      let completed = 0;
      let applicable = 0;
      campaignTasks.forEach((task) => {
        if (isApplicable(campaign.id, task.id)) {
          applicable++;
          const check = checkMap.get(`${campaign.id}:${task.id}`);
          if (check?.status === '완료' || check?.status === '해당없음') completed++;
        }
      });
      summary.set(campaign.id, {
        completed,
        applicable,
        total: campaignTasks.length,
      });
    });
    return summary;
  }, [filteredCampaigns, campaignTasks, checkMap, configMap]);

  const isLoading =
    checksLoading || tasksLoading || campaignsLoading || configsLoading;

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

  if (filteredCampaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground gap-2">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <span className="text-lg">📋</span>
        </div>
        조건에 맞는 캠페인이 없습니다.
      </div>
    );
  }

  return (
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
        {/* Header Row: Task Names (sticky top) */}
        <thead>
          <tr>
            {/* Top-left corner */}
            <th
              className={cn(
                'sticky left-0 top-0 z-30 min-w-[200px] max-w-[260px]',
                'bg-background border-b border-r px-3 py-1',
                'text-left text-[11px] font-semibold text-muted-foreground'
              )}
            >
              캠페인
            </th>

            {/* Task Name Headers grouped by category */}
            {taskGroups.map((group) => {
              const catColors = CATEGORY_COLORS[group.category];
              return group.tasks.map((task, taskIdx) => (
                <th
                  key={task.id}
                  className={cn(
                    'sticky top-0 z-20',
                    'bg-background border-b px-0.5 py-1',
                    'text-center min-w-[36px] max-w-[40px]',
                    taskIdx === 0 && 'border-l',
                    taskIdx === 0 && catColors.border
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 cursor-help">
                        <span
                          className={cn(
                            'inline-block w-2 h-2 rounded-full flex-shrink-0',
                            catColors.text.replace('text-', 'bg-')
                          )}
                        />
                        <span className="text-[9px] font-semibold text-muted-foreground leading-none">
                          {task.task_name.slice(0, 2)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs">{task.task_name}</div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-block w-1.5 h-1.5 rounded-full',
                              catColors.text.replace('text-', 'bg-')
                            )}
                          />
                          <span className="text-[10px] opacity-80">{group.category}</span>
                        </div>
                        {task.default_assignees && task.default_assignees.length > 0 && (
                          <div className="text-[10px] opacity-80">
                            담당: {task.default_assignees.join(', ')}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </th>
              ));
            })}

            {/* Summary Column Header */}
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
          {filteredCampaigns.map((campaign) => {
            const summary = campaignSummary.get(campaign.id);
            const pct =
              summary && summary.applicable > 0
                ? Math.round(
                    (summary.completed / summary.applicable) * 100
                  )
                : 0;

            return (
              <tr
                key={campaign.id}
                className={cn(
                  'hover:bg-muted/30 transition-colors',
                  onCampaignClick && 'cursor-pointer',
                  pct === 100 && 'bg-gradient-to-r from-emerald-50/60 via-emerald-50/30 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/10 dark:to-transparent'
                )}
                onClick={() => onCampaignClick?.(campaign.id)}
              >
                {/* Campaign Name (sticky left) */}
                <td
                  className={cn(
                    'sticky left-0 z-10',
                    'border-b border-r px-3 py-0.5',
                    'text-[11px] font-medium text-foreground',
                    'min-w-[200px] max-w-[260px]',
                    pct === 100
                      ? 'bg-gradient-to-r from-emerald-50/80 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10 border-l-[3px] border-l-emerald-400'
                      : 'bg-background'
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 truncate cursor-default">
                        {pct === 100 && (
                          <div className="flex items-center justify-center size-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                            <Trophy className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        )}
                        <span className={cn('font-semibold truncate', pct === 100 && 'text-emerald-800 dark:text-emerald-300')}>{campaign.client_name}</span>
                        <span className={cn('truncate text-[10px]', pct === 100 ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-muted-foreground')}>
                          {campaign.campaign_name}
                        </span>
                        {campaign.target_country && (
                          <Badge
                            variant="secondary"
                            className="text-[8px] px-1 py-0 shrink-0"
                          >
                            {campaign.target_country.slice(0, 2)}
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[280px]">
                      <p className="text-xs font-medium">{campaign.client_name} - {campaign.campaign_name}</p>
                      {campaign.target_country && <p className="text-[10px] text-muted-foreground">{campaign.target_country}</p>}
                    </TooltipContent>
                  </Tooltip>
                </td>

                {/* Status Cells */}
                {taskGroups.map((group) =>
                  group.tasks.map((task, taskIdx) => {
                    const applicable = isApplicable(campaign.id, task.id);
                    const check =
                      checkMap.get(`${campaign.id}:${task.id}`) ?? null;

                    return (
                      <td
                        key={task.id}
                        className={cn(
                          'border-b px-0.5 py-0 text-center',
                          taskIdx === 0 && 'border-l',
                          taskIdx === 0 &&
                            CATEGORY_COLORS[group.category].border
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <StatusCell
                            check={check}
                            isApplicable={applicable}
                            campaignId={campaign.id}
                            taskId={task.id}
                            date={date}
                            assigneeId={profile?.id}
                          />
                        </div>
                      </td>
                    );
                  })
                )}

                {/* Campaign Summary */}
                <td
                  className={cn(
                    'sticky right-0 z-10',
                    'border-b border-l px-2 py-0.5',
                    'text-center',
                    pct === 100
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/20'
                      : 'bg-background'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {summary?.completed ?? 0}/{summary?.applicable ?? 0}
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
        </tbody>
      </table>
    </div>
    </div>
    </TooltipProvider>
  );
}
