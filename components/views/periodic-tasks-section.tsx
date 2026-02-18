'use client';

import { Fragment, useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { CheckCircle2, Clock, Circle, CalendarDays, ChevronDown, ChevronRight, User, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { CATEGORY_COLORS } from '@/lib/utils/category-colors';
import { useAuth } from '@/hooks/use-auth';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
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
  CheckStatus,
  TaskCategory,
  User as UserType,
} from '@/lib/types/database';

interface PeriodicTasksSectionProps {
  date: string;
  userId?: string;
  campaignId?: string;
}

const FREQ_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  monthly: { label: '월간', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  once: { label: '1회성', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  as_needed: { label: '수시', color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-950/30' },
};

// ─── Inline Completion Date Cell ──────────────────────
function CompletionDateCell({
  check,
  campaignId,
  taskId,
  currentDate,
  assigneeId,
}: {
  check: DailyCheck | null;
  campaignId: string;
  taskId: string;
  currentDate: string;
  assigneeId: string;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { mutate: createCheck } = useCreateCheck();

  const handleDateChange = useCallback(async (newDate: string) => {
    if (!newDate) return;

    if (!check) {
      // Create a new check with the selected date as check_date and status '완료'
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: newDate,
        assigned_user_id: assigneeId,
        status: '완료',
      });
    } else {
      // Update existing check's check_date directly via supabase
      const { error } = await supabase
        .from('daily_checks')
        .update({ check_date: newDate, status: '완료' })
        .eq('id', check.id);
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['checks', 'month'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.checks.onceCompleted, exact: true });
      }
    }
  }, [check, campaignId, taskId, assigneeId, createCheck, supabase, queryClient]);

  return (
    <input
      type="date"
      value={check?.status === '완료' ? check.check_date : ''}
      onChange={(e) => handleDateChange(e.target.value)}
      className={cn(
        'w-full bg-transparent text-[11px] tabular-nums outline-none cursor-pointer',
        'border border-transparent rounded px-1 py-0.5',
        'hover:border-border focus:border-primary/50 transition-colors',
        check?.status === '완료' ? 'text-emerald-600 font-medium' : 'text-muted-foreground/40'
      )}
    />
  );
}

// ─── Status Button ────────────────────────────────────
function PeriodicStatusButton({
  check,
  campaignId,
  taskId,
  date,
  assigneeId,
}: {
  check: DailyCheck | null;
  campaignId: string;
  taskId: string;
  date: string;
  assigneeId: string;
}) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();

  const handleClick = () => {
    if (!check) {
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '완료',
      });
      return;
    }
    const cycle: CheckStatus[] = ['완료', '미완료', '진행중'];
    const currentIdx = cycle.indexOf(check.status);
    const nextStatus = cycle[(currentIdx + 1) % cycle.length];
    updateStatus({ id: check.id, status: nextStatus });
  };

  if (!check) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={handleClick}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-dashed border-muted-foreground/20 text-muted-foreground/30 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer hover:scale-110">
            <Circle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top"><p className="text-xs">클릭하여 완료 처리</p></TooltipContent>
      </Tooltip>
    );
  }

  const statusConfig: Record<CheckStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    '완료': { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30', label: '완료' },
    '진행중': { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30', label: '진행중' },
    '미완료': { icon: Circle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30', label: '미완료' },
    '해당없음': { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30', label: '해당없음' },
  };

  const cfg = statusConfig[check.status];
  const Icon = cfg.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={handleClick}
          className={cn('flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer hover:scale-110', cfg.bg, cfg.color)}>
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top"><p className="text-xs">{cfg.label} (클릭하여 변경)</p></TooltipContent>
    </Tooltip>
  );
}

// ─── Main Component ───────────────────────────────────
export function PeriodicTasksSection({ date, userId, campaignId }: PeriodicTasksSectionProps) {
  const supabase = createClient();
  const { profile } = useAuth();
  const effectiveUserId = userId ?? profile?.id ?? '';
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { mutate: bulkUpdateStatus } = useUpdateCheckStatus();
  const { mutate: bulkCreateCheck } = useCreateCheck();

  const currentDate = parseISO(date);
  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');
  const yearMonth = format(currentDate, 'yyyy-MM');

  // ─── Queries ───
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('loop_order');
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.active,
    queryFn: async () => {
      const { data, error } = await supabase.from('campaigns').select('*').eq('status', 'active').order('campaign_name');
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').eq('is_active', true);
      if (error) throw error;
      return data as UserType[];
    },
  });

  const { data: taskConfigs = [] } = useQuery({
    queryKey: queryKeys.taskConfig.all,
    queryFn: () => fetchAll<CampaignTaskConfig>(supabase, 'campaign_task_config'),
  });

  // Always fetch ALL monthly checks (no user filter) so periodic task data
  // is visible in both campaign view and assignee view.
  const { data: monthlyChecks = [] } = useQuery({
    queryKey: queryKeys.checks.byMonth(yearMonth),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .gte('check_date', monthStart)
        .lte('check_date', monthEnd);
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
  });

  // Fetch ALL completed checks for "once" frequency tasks (no date filter)
  const onceTaskIds = useMemo(() => {
    return tasks.filter((t) => t.frequency === 'once').map((t) => t.id);
  }, [tasks]);

  const { data: onceCompletedChecks = [] } = useQuery({
    queryKey: queryKeys.checks.onceCompleted,
    queryFn: async () => {
      if (onceTaskIds.length === 0) return [];
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .in('task_id', onceTaskIds)
        .eq('status', '완료');
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
    enabled: onceTaskIds.length > 0,
  });

  // Map of "campaign:task" -> check for once-tasks already completed (any month)
  const onceCompletedMap = useMemo(() => {
    const map = new Map<string, DailyCheck>();
    for (const c of onceCompletedChecks) {
      if (c.campaign_id) map.set(`${c.campaign_id}:${c.task_id}`, c);
    }
    return map;
  }, [onceCompletedChecks]);

  // ─── Derived Data ───
  const periodicTasks = useMemo(() => {
    return tasks.filter((t) => t.frequency === 'monthly' || t.frequency === 'once' || t.frequency === 'as_needed');
  }, [tasks]);

  const configMap = useMemo(() => {
    const map = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((c) => map.set(`${c.campaign_id}:${c.task_id}`, c));
    return map;
  }, [taskConfigs]);

  const userMap = useMemo(() => {
    const map = new Map<string, UserType>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const checkMap = useMemo(() => {
    const map = new Map<string, DailyCheck>();
    const periodicTaskIds = new Set(periodicTasks.map((t) => t.id));
    monthlyChecks
      .filter((c) => periodicTaskIds.has(c.task_id))
      .sort((a, b) => a.check_date.localeCompare(b.check_date))
      .forEach((check) => {
        map.set(`${check.campaign_id}:${check.task_id}`, check);
      });
    return map;
  }, [monthlyChecks, periodicTasks]);

  // Resolve assignee name for a task
  const getAssigneeName = useCallback((task: Task, config?: CampaignTaskConfig) => {
    // Override assignee from config
    if (config?.override_assignee) return config.override_assignee;
    // Default assignees from task
    if (task.default_assignees && task.default_assignees.length > 0) {
      return task.default_assignees.join(', ');
    }
    return null;
  }, []);

  // Build grouped display data: grouped by task
  type RowData = {
    task: Task;
    campaign: Campaign;
    check: DailyCheck | null;
    assigneeName: string | null;
    onceCompleted: boolean; // true if once-task already completed (read-only)
  };

  const groupedData = useMemo(() => {
    const groups: { task: Task; rows: RowData[]; completedCount: number }[] = [];
    const targetCampaigns = campaignId ? campaigns.filter((c) => c.id === campaignId) : campaigns;

    for (const task of periodicTasks) {
      if (task.scope === 'global') continue;

      const rows: RowData[] = [];
      for (const campaign of targetCampaigns) {
        const config = configMap.get(`${campaign.id}:${task.id}`);
        const applicable = config ? config.is_applicable : task.is_applicable_default;
        if (!applicable) continue;

        const key = `${campaign.id}:${task.id}`;
        const onceCheck = task.frequency === 'once' ? onceCompletedMap.get(key) : undefined;
        const isOnceCompleted = !!onceCheck;

        // For once-completed: use the historical check; otherwise use current month check
        const check = isOnceCompleted ? onceCheck! : (checkMap.get(key) ?? null);
        const assigneeName = getAssigneeName(task, config ?? undefined);
        rows.push({ task, campaign, check, assigneeName, onceCompleted: isOnceCompleted });
      }

      if (rows.length > 0) {
        const completedCount = rows.filter((r) => r.check?.status === '완료' || r.onceCompleted).length;
        groups.push({ task, rows, completedCount });
      }
    }

    return groups;
  }, [periodicTasks, campaigns, campaignId, configMap, checkMap, getAssigneeName, onceCompletedMap]);

  const totalItems = groupedData.reduce((s, g) => s + g.rows.length, 0);
  const completedItems = groupedData.reduce((s, g) => s + g.completedCount, 0);

  const toggleGroup = (taskId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  // Bulk complete: mark all uncompleted rows in a group as '완료'
  const handleBulkComplete = useCallback((group: { task: Task; rows: RowData[] }) => {
    for (const row of group.rows) {
      if (row.onceCompleted) continue;
      if (row.check?.status === '완료') continue;

      if (!row.check) {
        bulkCreateCheck({
          campaign_id: row.campaign.id,
          task_id: row.task.id,
          check_date: date,
          assigned_user_id: effectiveUserId,
          status: '완료',
        });
      } else {
        bulkUpdateStatus({ id: row.check.id, status: '완료' });
      }
    }
  }, [date, effectiveUserId, bulkCreateCheck, bulkUpdateStatus]);

  if (groupedData.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-xl border bg-card shadow-sm">
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors rounded-t-xl"
        >
          {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-indigo-500" />
            <span className="text-sm font-semibold">월간/주기별 업무</span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
            {totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0}% ({completedItems}/{totalItems})
          </Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(currentDate, 'yyyy년 MM월')} 기준
          </span>
        </button>

        {/* Body */}
        {expanded && (
          <div className="border-t">
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '20px' }}></th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '26%' }}>업무 / 캠페인</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '10%' }}>도구</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '14%' }}>담당자</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground text-center" style={{ width: '22%' }}>진행율 / 상태</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '22%' }}>완료일</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.map((group) => {
                    const freqCfg = FREQ_LABELS[group.task.frequency] ?? FREQ_LABELS.monthly;
                    const catColor = CATEGORY_COLORS[group.task.category as TaskCategory];
                    const isCollapsed = !expandedGroups.has(group.task.id);
                    const allDone = group.completedCount === group.rows.length;
                    const progressPct = group.rows.length > 0
                      ? Math.round((group.completedCount / group.rows.length) * 100)
                      : 0;

                    // Group-level assignee (from task default_assignees)
                    const groupAssignees = group.task.default_assignees?.join(', ') ?? null;

                    // Latest completion date among completed rows
                    const latestDate = group.rows
                      .filter((r) => r.check?.status === '완료')
                      .map((r) => r.check!.check_date)
                      .sort((a, b) => b.localeCompare(a))[0] ?? null;

                    return (
                      <Fragment key={group.task.id}>
                        {/* Group Header Row */}
                        <tr
                          className={cn(
                            'border-b border-border/60 cursor-pointer hover:bg-accent/20 transition-colors h-8',
                            allDone && 'bg-emerald-50/30 dark:bg-emerald-950/10'
                          )}
                          onClick={() => toggleGroup(group.task.id)}
                        >
                          {/* Toggle icon */}
                          <td className="px-2 py-0.5">
                            {isCollapsed
                              ? <ChevronRight className="size-3 text-muted-foreground/60" />
                              : <ChevronDown className="size-3 text-muted-foreground/60" />
                            }
                          </td>
                          {/* Task Name + Badges */}
                          <td className="px-2 py-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <Badge variant="outline" className={cn('text-[8px] px-1 py-0 shrink-0', freqCfg.color, freqCfg.bg)}>
                                {freqCfg.label}
                              </Badge>
                              <span className="text-[11px] font-semibold truncate">{group.task.task_name}</span>
                              <Badge variant="outline" className={cn('text-[8px] px-1 py-0 shrink-0', catColor?.text ?? '', catColor?.bg ?? '')}>
                                {group.task.category}
                              </Badge>
                            </div>
                          </td>
                          {/* Tool */}
                          <td className="px-2 py-0.5">
                            <span className="text-[10px] text-muted-foreground truncate block whitespace-nowrap">{group.task.tool || '-'}</span>
                          </td>
                          {/* Assignee */}
                          <td className="px-2 py-0.5">
                            <span className="text-[10px] text-muted-foreground truncate block whitespace-nowrap">{groupAssignees || '-'}</span>
                          </td>
                          {/* Progress */}
                          <td className="px-2 py-0.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    allDone ? 'bg-emerald-500' : progressPct > 0 ? 'bg-amber-400' : 'bg-transparent'
                                  )}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className={cn('text-[9px] font-medium tabular-nums whitespace-nowrap', allDone ? 'text-emerald-600' : 'text-muted-foreground')}>
                                {progressPct}% ({group.completedCount}/{group.rows.length})
                              </span>
                            </div>
                          </td>
                          {/* Latest Date + Bulk Complete */}
                          <td className="px-2 py-0.5">
                            <div className="flex items-center gap-1">
                              <span className={cn('text-[10px] tabular-nums whitespace-nowrap', latestDate ? 'text-emerald-600 font-medium' : 'text-muted-foreground/30')}>
                                {latestDate || '-'}
                              </span>
                              {!allDone && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleBulkComplete(group); }}
                                      className="ml-auto shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/30 transition-colors"
                                    >
                                      <ListChecks className="size-2.5" />
                                      일괄완료
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><p className="text-xs">미완료 항목을 모두 완료 처리</p></TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Campaign Rows (collapsed/expanded) */}
                        {!isCollapsed && group.rows.map((row) => (
                          <tr
                            key={`${row.campaign.id}:${row.task.id}`}
                            className={cn(
                              'border-b border-border/30 hover:bg-accent/10 transition-colors h-7',
                              (row.check?.status === '완료' || row.onceCompleted) && 'bg-emerald-50/20 dark:bg-emerald-950/5',
                              row.onceCompleted && 'opacity-60'
                            )}
                          >
                            <td className="px-2 py-0.5"></td>
                            <td className="px-2 py-0.5">
                              <div className="flex items-center gap-1 pl-4 min-w-0">
                                <span className={cn('text-[10px] truncate', row.onceCompleted ? 'text-muted-foreground line-through' : 'text-foreground/80')}>
                                  {row.campaign.campaign_name}
                                </span>
                                {row.onceCompleted && (
                                  <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                                    완료됨
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-0.5"></td>
                            <td className="px-2 py-0.5">
                              <span className="text-[10px] text-muted-foreground truncate block whitespace-nowrap">{row.assigneeName || '-'}</span>
                            </td>
                            <td className="px-2 py-0.5 text-center">
                              <div className="flex items-center justify-center">
                                {row.onceCompleted ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                                        <CheckCircle2 className="size-3.5" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">1회성 완료 (변경 불가)</p></TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <PeriodicStatusButton
                                    check={row.check}
                                    campaignId={row.campaign.id}
                                    taskId={row.task.id}
                                    date={date}
                                    assigneeId={effectiveUserId}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-0.5">
                              {row.onceCompleted ? (
                                <span className="text-[10px] text-emerald-600 font-medium tabular-nums">
                                  {row.check?.check_date ?? '-'}
                                </span>
                              ) : (
                                <CompletionDateCell
                                  check={row.check}
                                  campaignId={row.campaign.id}
                                  taskId={row.task.id}
                                  currentDate={date}
                                  assigneeId={effectiveUserId}
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
