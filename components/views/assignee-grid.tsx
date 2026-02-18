'use client';

import { useMemo } from 'react';
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
import type {
  Task,
  Campaign,
  DailyCheck,
  CampaignTaskConfig,
  TaskCategory,
} from '@/lib/types/database';

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
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

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
    {/* Global Tasks Section (simple checklist) */}
    {globalTasks.length > 0 && (
      <div className="rounded-lg border bg-background">
        <div className="px-4 py-3 border-b bg-violet-50 dark:bg-violet-950/20">
          <h3 className="text-sm font-semibold text-violet-700 dark:text-violet-300">
            전역 업무 (캠페인 무관)
          </h3>
        </div>
        <div className="divide-y">
          {globalTasks.map((task) => {
            // For global tasks, check lookup uses null campaign_id
            const check = checkMap.get(`null:${task.id}`) ?? null;
            return (
              <div key={task.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{task.task_name}</span>
                  {!assigneeName && task.default_assignees && task.default_assignees.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/70 ml-2">
                      {task.default_assignees.join(', ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center ml-3">
                  <StatusCell
                    check={check}
                    isApplicable={true}
                    taskId={task.id}
                    date={date}
                    assigneeId={effectiveUserId || undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* Campaign-scope Tasks Grid */}
    {filteredCampaigns.length > 0 && campaignScopeTasks.length > 0 && (
    <div className="relative overflow-auto rounded-lg border bg-background">
      <table className="w-max min-w-full border-collapse">
        {/* Header Row: Campaign Names (sticky top) */}
        <thead>
          <tr>
            {/* Top-left corner cell (sticky both directions) */}
            <th
              className={cn(
                'sticky left-0 top-0 z-30 min-w-[180px] max-w-[220px]',
                'bg-background border-b border-r px-3 py-2',
                'text-left text-xs font-semibold text-muted-foreground'
              )}
            >
              업무
            </th>
            {filteredCampaigns.map((campaign) => (
              <th
                key={campaign.id}
                className={cn(
                  'sticky top-0 z-20',
                  'bg-background border-b px-0.5 py-1',
                  'text-center min-w-[44px] max-w-[52px]'
                )}
              >
                <div
                  className="flex flex-col items-center gap-0.5"
                  title={`${campaign.client_name} - ${campaign.campaign_name}`}
                >
                  <span
                    className={cn(
                      'text-[10px] font-semibold text-foreground',
                      'whitespace-nowrap leading-tight'
                    )}
                    style={{
                      writingMode: 'vertical-lr',
                    }}
                  >
                    {campaign.client_name}
                  </span>
                  {campaign.target_country && (
                    <span className="text-[8px] text-muted-foreground/70 leading-tight flex-shrink-0">
                      {campaign.target_country}
                    </span>
                  )}
                </div>
              </th>
            ))}
            {/* Summary column header */}
            <th
              className={cn(
                'sticky top-0 right-0 z-20',
                'bg-background border-b border-l px-2 py-2',
                'text-center text-[10px] font-semibold text-muted-foreground',
                'min-w-[60px]'
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
                      'px-3 py-1.5 text-xs font-semibold',
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
                    <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                      {/* Task Name (sticky left) */}
                      <td
                        className={cn(
                          'sticky left-0 z-10',
                          'bg-background border-b border-r px-3 py-1.5',
                          'text-xs font-medium text-foreground',
                          'min-w-[180px] max-w-[220px]'
                        )}
                        title={`${task.task_name}${task.default_assignees?.length ? `\n담당: ${task.default_assignees.join(', ')}` : ''}`}
                      >
                        <span className="truncate block">{task.task_name}</span>
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
                            className="border-b px-1 py-1 text-center"
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
                          'bg-background border-b border-l px-2 py-1.5',
                          'text-center'
                        )}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {summary?.completed ?? 0}/{summary?.total ?? 0}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[9px] px-1.5 py-0',
                              pct === 100 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                              pct > 0 && pct < 100 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                              pct === 0 && 'bg-gray-100 text-gray-500'
                            )}
                          >
                            {pct}%
                          </Badge>
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
                'bg-muted/50 border-t-2 px-3 py-2',
                'text-xs font-semibold text-foreground'
              )}
            >
              캠페인 완료율
            </td>
            {filteredCampaigns.map((campaign) => {
              const summary = campaignSummary.get(campaign.id);
              const pct =
                summary && summary.total > 0
                  ? Math.round((summary.completed / summary.total) * 100)
                  : 0;

              return (
                <td
                  key={campaign.id}
                  className="bg-muted/50 border-t-2 px-1 py-2 text-center"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {summary?.completed ?? 0}/{summary?.total ?? 0}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[9px] px-1.5 py-0',
                        pct === 100 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                        pct > 0 && pct < 100 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                        pct === 0 && 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {pct}%
                    </Badge>
                  </div>
                </td>
              );
            })}
            <td
              className={cn(
                'sticky right-0 z-10',
                'bg-muted/50 border-t-2 border-l px-2 py-2 text-center'
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
    )}
    </div>
  );
}

// Fragment helper for grouping without extra DOM nodes
function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
