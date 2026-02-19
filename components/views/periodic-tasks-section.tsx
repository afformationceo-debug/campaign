'use client';

import { Fragment, useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { CheckCircle2, Clock, Circle, Minus, CalendarDays, ChevronDown, ChevronRight, User, ListChecks, Trophy, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { CATEGORY_COLORS } from '@/lib/utils/category-colors';
import { useAuth } from '@/hooks/use-auth';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

// ─── Result Value Input ──────────────────────────────
function ResultValueInput({
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
  const { mutate: updateCheck } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();
  const [localValue, setLocalValue] = useState(check?.result_value ?? '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setLocalValue(check?.result_value ?? '');
    }
  }, [check?.result_value, editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    const trimmed = localValue.trim();
    if (trimmed === (check?.result_value ?? '')) return;

    if (!check) {
      if (!trimmed) return;
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '진행중',
        result_value: trimmed,
      });
    } else {
      updateCheck({
        id: check.id,
        status: check.status,
        result_value: trimmed || undefined,
      });
    }
  }, [localValue, check, campaignId, taskId, date, assigneeId, createCheck, updateCheck]);

  // Detect if it looks like a URL
  const isUrl = check?.result_value && /^https?:\/\//.test(check.result_value);

  return (
    <div className="flex items-center gap-1 w-full">
      <input
        type="text"
        value={localValue}
        onChange={(e) => { setLocalValue(e.target.value); setEditing(true); }}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
        placeholder="결과값 입력 (URL, 수치 등)..."
        className={cn(
          'flex-1 min-w-0 bg-transparent text-[11px] outline-none',
          'border border-transparent rounded px-1.5 py-0.5',
          'hover:border-border focus:border-primary/50 transition-colors',
          'placeholder:text-muted-foreground/30',
          check?.result_value ? 'text-foreground' : ''
        )}
      />
      {isUrl && (
        <a
          href={check!.result_value!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[9px] text-blue-500 hover:text-blue-700 shrink-0"
        >
          열기
        </a>
      )}
    </div>
  );
}

// ─── Status config for dropdown ──────────────────────
const CHECK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  '완료': { label: '완료', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950' },
  '진행중': { label: '진행중', color: 'text-blue-600', icon: Clock, bg: 'bg-blue-50 dark:bg-blue-950' },
  '미완료': { label: '미완료', color: 'text-red-500', icon: Circle, bg: 'bg-red-50 dark:bg-red-950' },
  '해당없음': { label: '해당없음', color: 'text-gray-400', icon: Minus, bg: 'bg-gray-50 dark:bg-gray-800' },
};
const CHECK_STATUSES = ['완료', '진행중', '미완료', '해당없음'] as const;

// ─── Status Select Dropdown ──────────────────────────
function PeriodicStatusSelect({
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

  const currentStatus = check?.status ?? null;
  const config = currentStatus ? CHECK_STATUS_CONFIG[currentStatus] : null;
  const StatusIcon = config?.icon ?? Circle;

  const handleChange = (value: string) => {
    if (!check) {
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: value as CheckStatus,
      });
    } else {
      updateStatus({ id: check.id, status: value as CheckStatus });
    }
  };

  return (
    <Select value={currentStatus ?? ''} onValueChange={handleChange}>
      <SelectTrigger className={cn(
        'h-6 w-[80px] text-[11px] border-0 bg-transparent px-1',
        config?.color ?? 'text-muted-foreground/40'
      )}>
        <div className="flex items-center gap-1">
          <StatusIcon className="size-3" />
          <span>{config?.label ?? '미체크'}</span>
        </div>
      </SelectTrigger>
      <SelectContent position="popper" className="min-w-[100px]">
        {CHECK_STATUSES.map((s) => {
          const sc = CHECK_STATUS_CONFIG[s];
          const SI = sc.icon;
          return (
            <SelectItem key={s} value={s}>
              <div className="flex items-center gap-1.5">
                <SI className={cn('size-3', sc.color)} />
                {sc.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ─── Main Component ───────────────────────────────────
export function PeriodicTasksSection({ date, userId, campaignId }: PeriodicTasksSectionProps) {
  const supabase = createClient();
  const { profile } = useAuth();
  const effectiveUserId = userId ?? profile?.id ?? '';
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubTasks, setExpandedSubTasks] = useState<Set<string>>(new Set());
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

  type SubTaskGroup = {
    task: Task;
    rows: RowData[];
    completedCount: number;
  };

  type HierarchicalGroup = {
    task: Task;               // parent task (or standalone task)
    subTasks: SubTaskGroup[]; // empty if no sub-tasks
    rows: RowData[];          // campaign rows (for standalone tasks only)
    completedCount: number;
    targetCount: number | null; // from campaign_task_config
    isParent: boolean;
  };

  // Build target count map from configs
  const targetCountMap = useMemo(() => {
    const map = new Map<string, number | null>();
    taskConfigs.forEach(c => {
      if (c.target_count != null) {
        map.set(`${c.campaign_id}:${c.task_id}`, c.target_count);
      }
    });
    return map;
  }, [taskConfigs]);

  // Helper: build rows for a single task
  const buildRowsForTask = useCallback((task: Task, targetCampaigns: Campaign[]): RowData[] => {
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
    return rows;
  }, [configMap, checkMap, onceCompletedMap, getAssigneeName]);

  const groupedData = useMemo(() => {
    const groups: HierarchicalGroup[] = [];
    const targetCampaigns = campaignId ? campaigns.filter((c) => c.id === campaignId) : campaigns;

    // Identify which tasks are sub-tasks (have parent_task_id)
    const subTasksByParent = new Map<string, Task[]>();
    const subTaskIds = new Set<string>();
    for (const task of periodicTasks) {
      if (task.parent_task_id) {
        subTaskIds.add(task.id);
        const existing = subTasksByParent.get(task.parent_task_id) ?? [];
        existing.push(task);
        subTasksByParent.set(task.parent_task_id, existing);
      }
    }

    // Sort sub-tasks by sub_order
    for (const [, subs] of subTasksByParent) {
      subs.sort((a, b) => a.sub_order - b.sub_order);
    }

    for (const task of periodicTasks) {
      if (task.scope === 'global') continue;
      // Skip sub-tasks from top-level iteration; they're nested under parents
      if (subTaskIds.has(task.id)) continue;

      const childTasks = subTasksByParent.get(task.id);
      const isParent = !!childTasks && childTasks.length > 0;

      if (isParent) {
        // Parent task with sub-tasks
        // IMPORTANT: Only show sub-tasks for campaigns where the PARENT task is applicable
        const parentApplicableCampaigns = targetCampaigns.filter((campaign) => {
          const parentConfig = configMap.get(`${campaign.id}:${task.id}`);
          return parentConfig ? parentConfig.is_applicable : task.is_applicable_default;
        });

        const subTaskGroups: SubTaskGroup[] = [];
        let totalCompleted = 0;
        let totalRows = 0;

        for (const subTask of childTasks!) {
          const rows = buildRowsForTask(subTask, parentApplicableCampaigns);
          if (rows.length > 0) {
            const completedCount = rows.filter((r) => r.check?.status === '완료' || r.onceCompleted).length;
            subTaskGroups.push({ task: subTask, rows, completedCount });
            totalCompleted += completedCount;
            totalRows += rows.length;
          }
        }

        if (subTaskGroups.length > 0) {
          // Compute aggregate target_count for the parent task across applicable campaigns only
          let aggregateTargetCount: number | null = null;
          for (const campaign of parentApplicableCampaigns) {
            const tc = targetCountMap.get(`${campaign.id}:${task.id}`);
            if (tc != null) {
              aggregateTargetCount = (aggregateTargetCount ?? 0) + tc;
            }
          }

          groups.push({
            task,
            subTasks: subTaskGroups,
            rows: [],
            completedCount: totalCompleted,
            targetCount: aggregateTargetCount,
            isParent: true,
          });
        }
      } else {
        // Standalone task (no children)
        const rows = buildRowsForTask(task, targetCampaigns);

        if (rows.length > 0) {
          const completedCount = rows.filter((r) => r.check?.status === '완료' || r.onceCompleted).length;
          groups.push({
            task,
            subTasks: [],
            rows,
            completedCount,
            targetCount: null,
            isParent: false,
          });
        }
      }
    }

    return groups;
  }, [periodicTasks, campaigns, campaignId, buildRowsForTask, targetCountMap]);

  const totalItems = groupedData.reduce((s, g) => {
    if (g.isParent) return s + g.subTasks.reduce((ss, st) => ss + st.rows.length, 0);
    return s + g.rows.length;
  }, 0);
  const completedItems = groupedData.reduce((s, g) => s + g.completedCount, 0);

  const toggleGroup = (taskId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const toggleSubTask = (subTaskId: string) => {
    setExpandedSubTasks((prev) => {
      const next = new Set(prev);
      if (next.has(subTaskId)) next.delete(subTaskId); else next.add(subTaskId);
      return next;
    });
  };

  // Bulk complete: mark all uncompleted rows in a group as '완료'
  const handleBulkComplete = useCallback((rows: RowData[]) => {
    for (const row of rows) {
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

  // Bulk complete for entire hierarchical group (parent with sub-tasks)
  const handleBulkCompleteGroup = useCallback((group: HierarchicalGroup) => {
    if (group.isParent) {
      for (const subGroup of group.subTasks) {
        handleBulkComplete(subGroup.rows);
      }
    } else {
      handleBulkComplete(group.rows);
    }
  }, [handleBulkComplete]);

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
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '20%' }}>업무 / 캠페인</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '10%' }}>담당자</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground text-center" style={{ width: '14%' }}>진행율 / 상태</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '40%' }}>결과값</th>
                    <th className="px-2 py-1 text-[10px] font-semibold text-muted-foreground" style={{ width: '14%' }}>완료일</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.map((group) => {
                    const freqCfg = FREQ_LABELS[group.task.frequency] ?? FREQ_LABELS.monthly;
                    const catColor = CATEGORY_COLORS[group.task.category as TaskCategory];
                    const isCollapsed = !expandedGroups.has(group.task.id);

                    // Compute total row count for progress calculation
                    const groupTotalRows = group.isParent
                      ? group.subTasks.reduce((s, st) => s + st.rows.length, 0)
                      : group.rows.length;
                    const allDone = group.completedCount === groupTotalRows && groupTotalRows > 0;
                    const progressPct = groupTotalRows > 0
                      ? Math.round((group.completedCount / groupTotalRows) * 100)
                      : 0;

                    // Group-level assignee (from task default_assignees)
                    const groupAssignees = group.task.default_assignees?.join(', ') ?? null;

                    // Collect all rows for aggregation (standalone: group.rows, parent: all sub-task rows)
                    const allGroupRows = group.isParent
                      ? group.subTasks.flatMap((st) => st.rows)
                      : group.rows;

                    // Latest completion date among completed rows
                    const latestDate = allGroupRows
                      .filter((r) => r.check?.status === '완료')
                      .map((r) => r.check!.check_date)
                      .sort((a, b) => b.localeCompare(a))[0] ?? null;

                    return (
                      <Fragment key={group.task.id}>
                        {/* Group Header Row */}
                        <tr
                          className={cn(
                            'border-b border-border/60 cursor-pointer hover:bg-accent/20 transition-colors h-8',
                            allDone && 'bg-gradient-to-r from-emerald-50/60 via-emerald-50/30 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/10 dark:to-transparent'
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
                          <td className={cn(
                            'px-2 py-0.5',
                            allDone && 'border-l-[3px] border-l-emerald-400'
                          )}>
                            <div className="flex items-center gap-1 min-w-0">
                              {allDone && (
                                <div className="flex items-center justify-center size-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                                  <Trophy className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                              )}
                              <Badge variant="outline" className={cn('text-[8px] px-1 py-0 shrink-0', freqCfg.color, freqCfg.bg)}>
                                {freqCfg.label}
                              </Badge>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={cn('text-[11px] font-semibold truncate cursor-default', allDone && 'text-emerald-800 dark:text-emerald-300')}>{group.task.task_name}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[300px]">
                                  <p className="text-xs font-medium">{group.task.task_name}</p>
                                  {group.task.description && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{group.task.description}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                              <Badge variant="outline" className={cn('text-[8px] px-1 py-0 shrink-0', catColor?.text ?? '', catColor?.bg ?? '')}>
                                {group.task.category}
                              </Badge>
                              {group.targetCount != null && (
                                <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                                  목표: {group.targetCount}건
                                </Badge>
                              )}
                            </div>
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
                                {progressPct}% ({group.completedCount}/{groupTotalRows})
                              </span>
                            </div>
                          </td>
                          {/* Result Value Summary */}
                          <td className="px-2 py-0.5">
                            {(() => {
                              const filledCount = allGroupRows.filter((r) => r.check?.result_value).length;
                              return filledCount > 0 ? (
                                <span className="text-[9px] text-muted-foreground">
                                  {filledCount}/{groupTotalRows} 입력됨
                                </span>
                              ) : (
                                <span className="text-[9px] text-muted-foreground/30">-</span>
                              );
                            })()}
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
                                      onClick={(e) => { e.stopPropagation(); handleBulkCompleteGroup(group); }}
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

                        {/* Expanded content: differs for parent vs standalone */}
                        {!isCollapsed && group.isParent && group.subTasks.map((subGroup) => {
                          const isSubExpanded = expandedSubTasks.has(subGroup.task.id);
                          const subAllDone = subGroup.completedCount === subGroup.rows.length && subGroup.rows.length > 0;
                          const subPct = subGroup.rows.length > 0 ? Math.round((subGroup.completedCount / subGroup.rows.length) * 100) : 0;
                          return (
                          <Fragment key={subGroup.task.id}>
                            {/* Sub-Task Header Row (clickable toggle) */}
                            <tr
                              className={cn(
                                'bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors',
                                subAllDone && 'bg-emerald-50/30 dark:bg-emerald-950/10',
                              )}
                              onClick={() => toggleSubTask(subGroup.task.id)}
                            >
                              <td className="px-2 py-1">
                                <div className="pl-6">
                                  {isSubExpanded
                                    ? <ChevronDown className="size-3 text-muted-foreground/60" />
                                    : <ChevronRight className="size-3 text-muted-foreground/60" />
                                  }
                                </div>
                              </td>
                              <td className="px-2 py-1" colSpan={2}>
                                <div className="flex items-center gap-2 pl-2">
                                  <CornerDownRight className="size-3 text-muted-foreground/50 shrink-0" />
                                  {subAllDone && (
                                    <div className="flex items-center justify-center size-3.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                                      <Trophy className="size-2 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                  )}
                                  <span className={cn(
                                    'text-xs font-medium',
                                    subAllDone && 'text-emerald-700 dark:text-emerald-300',
                                  )}>
                                    {subGroup.task.task_name}
                                  </span>
                                  <Badge variant="secondary" className={cn(
                                    'text-[9px] px-1.5 py-0',
                                    subAllDone && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                                    subPct > 0 && !subAllDone && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                                  )}>
                                    {subGroup.completedCount}/{subGroup.rows.length}
                                  </Badge>
                                </div>
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all',
                                        subAllDone ? 'bg-emerald-500' : subPct > 0 ? 'bg-amber-400' : 'bg-transparent'
                                      )}
                                      style={{ width: `${subPct}%` }}
                                    />
                                  </div>
                                  <span className={cn('text-[9px] font-medium tabular-nums whitespace-nowrap', subAllDone ? 'text-emerald-600' : 'text-muted-foreground')}>
                                    {subPct}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-1" colSpan={2}></td>
                            </tr>
                            {/* Sub-Task Campaign Rows (only when expanded) */}
                            {isSubExpanded && subGroup.rows.map((row) => {
                              const rowCompleted = row.check?.status === '완료' || row.onceCompleted;
                              return (
                                <tr
                                  key={`${row.campaign.id}:${row.task.id}`}
                                  className={cn(
                                    'border-b border-border/30 hover:bg-accent/10 transition-colors h-7',
                                    rowCompleted && 'bg-gradient-to-r from-emerald-50/60 via-emerald-50/30 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/10 dark:to-transparent',
                                    row.onceCompleted && 'opacity-60'
                                  )}
                                >
                                  <td className="px-2 py-0.5"></td>
                                  <td className={cn(
                                    'px-2 py-0.5',
                                    rowCompleted && 'border-l-[3px] border-l-emerald-400'
                                  )}>
                                    <div className="flex items-center gap-1 pl-8 min-w-0">
                                      {rowCompleted && !row.onceCompleted && (
                                        <div className="flex items-center justify-center size-3.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                                          <Trophy className="size-2 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                      )}
                                      <span className={cn(
                                        'text-[10px] truncate',
                                        row.onceCompleted ? 'text-muted-foreground line-through' : rowCompleted ? 'text-emerald-800 dark:text-emerald-300 font-medium' : 'text-foreground/80'
                                      )}>
                                        {row.campaign.campaign_name}
                                      </span>
                                      {row.onceCompleted && (
                                        <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                                          완료됨
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-0.5">
                                    <span className="text-[10px] text-muted-foreground truncate block whitespace-nowrap">{row.assigneeName || '-'}</span>
                                  </td>
                                  <td className="px-2 py-0.5 text-center">
                                    <div className="flex items-center justify-center">
                                      {row.onceCompleted ? (
                                        <div className="flex items-center gap-1 text-[11px] text-emerald-600">
                                          <CheckCircle2 className="size-3" />
                                          <span>완료</span>
                                        </div>
                                      ) : (
                                        <PeriodicStatusSelect
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
                                      <span className="text-[10px] text-muted-foreground truncate block">
                                        {row.check?.result_value || '-'}
                                      </span>
                                    ) : (
                                      <ResultValueInput
                                        check={row.check}
                                        campaignId={row.campaign.id}
                                        taskId={row.task.id}
                                        date={date}
                                        assigneeId={effectiveUserId}
                                      />
                                    )}
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
                              );
                            })}
                          </Fragment>
                          );
                        })}

                        {/* Standalone task Campaign Rows (same as original) */}
                        {!isCollapsed && !group.isParent && group.rows.map((row) => {
                          const rowCompleted = row.check?.status === '완료' || row.onceCompleted;
                          return (
                          <tr
                            key={`${row.campaign.id}:${row.task.id}`}
                            className={cn(
                              'border-b border-border/30 hover:bg-accent/10 transition-colors h-7',
                              rowCompleted && 'bg-gradient-to-r from-emerald-50/60 via-emerald-50/30 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/10 dark:to-transparent',
                              row.onceCompleted && 'opacity-60'
                            )}
                          >
                            <td className="px-2 py-0.5"></td>
                            <td className={cn(
                              'px-2 py-0.5',
                              rowCompleted && 'border-l-[3px] border-l-emerald-400'
                            )}>
                              <div className="flex items-center gap-1 pl-4 min-w-0">
                                {rowCompleted && !row.onceCompleted && (
                                  <div className="flex items-center justify-center size-3.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                                    <Trophy className="size-2 text-emerald-600 dark:text-emerald-400" />
                                  </div>
                                )}
                                <span className={cn(
                                  'text-[10px] truncate',
                                  row.onceCompleted ? 'text-muted-foreground line-through' : rowCompleted ? 'text-emerald-800 dark:text-emerald-300 font-medium' : 'text-foreground/80'
                                )}>
                                  {row.campaign.campaign_name}
                                </span>
                                {row.onceCompleted && (
                                  <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                                    완료됨
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-0.5">
                              <span className="text-[10px] text-muted-foreground truncate block whitespace-nowrap">{row.assigneeName || '-'}</span>
                            </td>
                            <td className="px-2 py-0.5 text-center">
                              <div className="flex items-center justify-center">
                                {row.onceCompleted ? (
                                  <div className="flex items-center gap-1 text-[11px] text-emerald-600">
                                    <CheckCircle2 className="size-3" />
                                    <span>완료</span>
                                  </div>
                                ) : (
                                  <PeriodicStatusSelect
                                    check={row.check}
                                    campaignId={row.campaign.id}
                                    taskId={row.task.id}
                                    date={date}
                                    assigneeId={effectiveUserId}
                                  />
                                )}
                              </div>
                            </td>
                            {/* Result Value Input */}
                            <td className="px-2 py-0.5">
                              {row.onceCompleted ? (
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  {row.check?.result_value || '-'}
                                </span>
                              ) : (
                                <ResultValueInput
                                  check={row.check}
                                  campaignId={row.campaign.id}
                                  taskId={row.task.id}
                                  date={date}
                                  assigneeId={effectiveUserId}
                                />
                              )}
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
                          );
                        })}
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
