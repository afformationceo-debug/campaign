'use client';

import { useMemo, useCallback, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, CheckCircle2, Trophy, Clock, Circle, Minus, MessageSquare, Info, ChevronRight, ChevronDown, ExternalLink, Check } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TaskDetailPanel } from '@/components/views/task-detail-panel';
import type {
  Task,
  Campaign,
  DailyCheck,
  CampaignTaskConfig,
  TaskCategory,
  User,
  TaskStep,
  StepCheck,
} from '@/lib/types/database';

// ─── Status config for dropdown ───────────────────────
const CHECK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  '완료': { label: '완료', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950' },
  '진행중': { label: '진행중', color: 'text-blue-600', icon: Clock, bg: 'bg-blue-50 dark:bg-blue-950' },
  '미완료': { label: '미완료', color: 'text-red-500', icon: Circle, bg: 'bg-red-50 dark:bg-red-950' },
  '해당없음': { label: '해당없음', color: 'text-gray-400', icon: Minus, bg: 'bg-gray-50 dark:bg-gray-800' },
};
const CHECK_STATUSES = ['완료', '진행중', '미완료', '해당없음'] as const;

import type { CheckStatus } from '@/lib/types/database';

// ─── Priority left-border color ──────────────────────
const getPriorityBorderClass = (priority?: string) => {
  switch (priority) {
    case '긴급': return 'border-l-2 border-l-red-500';
    case '높음': return 'border-l-2 border-l-orange-400';
    default: return 'border-l-2 border-l-transparent';
  }
};

// ─── Global Status Select Dropdown ───────────────────
function GlobalStatusSelect({
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

  const currentStatus = check?.status ?? null;
  const config = currentStatus ? CHECK_STATUS_CONFIG[currentStatus] : null;
  const StatusIcon = config?.icon ?? Circle;

  const handleChange = (value: string) => {
    if (!check) {
      createCheck({
        campaign_id: campaignId ?? null,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: value as CheckStatus,
      });
    } else {
      updateStatus({ id: check.id, status: value as CheckStatus, assigned_user_id: assigneeId });
    }
  };

  return (
    <Select value={currentStatus ?? ''} onValueChange={handleChange}>
      <SelectTrigger className={cn(
        'h-7 w-[84px] text-[11px] font-medium border-0 bg-transparent px-1 rounded-lg hover:bg-stone-50',
        config?.color ?? 'text-stone-400'
      )}>
        <div className="flex items-center gap-1.5">
          <StatusIcon className="size-3.5" />
          <span>{config?.label ?? '미체크'}</span>
        </div>
      </SelectTrigger>
      <SelectContent position="popper" className="min-w-[120px] rounded-xl">
        {CHECK_STATUSES.map((s) => {
          const sc = CHECK_STATUS_CONFIG[s];
          const SI = sc.icon;
          return (
            <SelectItem key={s} value={s} className="text-[12px] rounded-lg">
              <div className="flex items-center gap-2">
                <SI className={cn('size-3.5', sc.color)} />
                {sc.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

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
      updateStatus({ id: check.id, status: check.status, assigned_user_id: assigneeId, result_value: trimmed });
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full text-[12px] bg-orange-50/50 border-b-2 border-orange-400 outline-none px-1.5 py-1 rounded-t"
        placeholder="결과값 입력..."
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className={cn(
        'w-full text-left text-[12px] px-1.5 py-1 truncate rounded-lg hover:bg-orange-50/60 transition-colors cursor-text min-h-[24px]',
        check?.result_value ? 'text-stone-800 font-medium' : 'text-stone-300'
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
  users?: User[];
}

export function AssigneeGrid({ date, assigneeId, assigneeName, categories, users = [] }: AssigneeGridProps) {
  const supabase = createClient();
  const { profile } = useAuth();

  // Task detail side panel
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Multi-assignee collapse/expand state for global tasks
  const [expandedGlobalTaskIds, setExpandedGlobalTaskIds] = useState<Set<string>>(new Set());
  const toggleGlobalTaskExpand = useCallback((taskId: string) => {
    setExpandedGlobalTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Campaign type filter
  const [activeCampaignTypes, setActiveCampaignTypes] = useState<Set<string>>(() => {
    return new Set(['해외마케팅', '국내챗닥', '제품브랜드']);
  });

  // For global tasks, use the selected user or the logged-in user
  const effectiveUserId = assigneeId ?? profile?.id ?? '';

  // Name → ID mapping for resolving default_assignees names to user IDs
  const nameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.name, u.id));
    return map;
  }, [users]);

  const idToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  // Resolve the correct user ID for a global task.
  // When a specific assignee is filtered, use that ID.
  // When "전체 담당자", resolve from the task's default_assignees
  // so that check lookups find the correct per-user record.
  const resolveGlobalUserId = useCallback((task: Task): string => {
    if (assigneeId) return assigneeId;
    const names = task.default_assignees?.map((n) => n.trim()).filter(Boolean) ?? [];
    if (names.length === 1) {
      const resolvedId = nameToIdMap.get(names[0]);
      if (resolvedId) return resolvedId;
    }
    return effectiveUserId;
  }, [assigneeId, nameToIdMap, effectiveUserId]);

  const { mutate: bulkUpdateStatus } = useUpdateCheckStatus();
  const { mutate: bulkCreateCheck } = useCreateCheck();

  // Subscribe to realtime updates
  useRealtimeChecks(date);
  useRealtimeTaskConfig();

  // Fetch ALL daily checks for the selected date (no user filter).
  // Campaign-scope checks are unique per (campaign_id, task_id, check_date) and shared.
  // Global checks are unique per (task_id, check_date, assigned_user_id) and per-user.
  const { data: checks = [], isLoading: checksLoading } = useQuery({
    queryKey: queryKeys.checks.byDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .eq('check_date', date);
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
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

  // Fetch all task_steps for step count display
  const { data: allSteps = [] } = useQuery({
    queryKey: ['taskSteps', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_steps')
        .select('*')
        .order('step_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskStep[];
    },
  });

  // Build task_id → steps[] lookup
  const stepsMap = useMemo(() => {
    const map = new Map<string, TaskStep[]>();
    allSteps.forEach((step) => {
      if (!map.has(step.task_id)) map.set(step.task_id, []);
      map.get(step.task_id)!.push(step);
    });
    return map;
  }, [allSteps]);

  // Fetch step_checks for current date (via daily_checks)
  const { data: stepChecks = [] } = useQuery({
    queryKey: queryKeys.stepChecks.byDate(date),
    queryFn: async () => {
      const checkIds = checks.map((c) => c.id);
      if (checkIds.length === 0) return [];
      const { data, error } = await supabase
        .from('step_checks')
        .select('*')
        .in('daily_check_id', checkIds);
      if (error) throw error;
      return (data ?? []) as StepCheck[];
    },
    enabled: checks.length > 0,
  });

  // Build step_check lookup: daily_check_id:step_id → StepCheck
  const stepCheckMap = useMemo(() => {
    const map = new Map<string, StepCheck>();
    stepChecks.forEach((sc) => {
      map.set(`${sc.daily_check_id}:${sc.step_id}`, sc);
    });
    return map;
  }, [stepChecks]);

  const queryClient = useQueryClient();

  // Track which tasks have their steps expanded inline
  const [expandedStepTaskIds, setExpandedStepTaskIds] = useState<Set<string>>(new Set());
  const toggleStepExpand = useCallback((taskId: string) => {
    setExpandedStepTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Build config lookup: campaign_id + task_id -> config
  const configMap = useMemo(() => {
    const map = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((config) => {
      map.set(`${config.campaign_id}:${config.task_id}`, config);
    });
    return map;
  }, [taskConfigs]);

  const resolveCampaignAssigneeId = useCallback((campaignId: string, task: Task): string => {
    const config = configMap.get(`${campaignId}:${task.id}`);
    if (config?.override_assignee) {
      const overrideId = nameToIdMap.get(config.override_assignee.trim());
      if (overrideId) return overrideId;
    }

    if (assigneeId) return assigneeId;

    const normalizedDefaults = (task.default_assignees ?? [])
      .map((name) => name.trim())
      .filter(Boolean);
    if (normalizedDefaults.length === 1) {
      const defaultId = nameToIdMap.get(normalizedDefaults[0]);
      if (defaultId) return defaultId;
    }

    return effectiveUserId;
  }, [assigneeId, configMap, effectiveUserId, nameToIdMap]);

  // Build check lookup:
  // Campaign-scope: campaign_id:task_id -> check (shared, one per combo)
  // Global-scope: null:task_id:assigned_user_id -> check (per-user)
  const checkMap = useMemo(() => {
    const map = new Map<string, DailyCheck>();
    checks.forEach((check) => {
      if (check.campaign_id) {
        // Campaign-scope: unique per (campaign_id, task_id, check_date)
        map.set(`${check.campaign_id}:${check.task_id}`, check);
      } else {
        // Global-scope: unique per (task_id, check_date, assigned_user_id)
        map.set(`null:${check.task_id}:${check.assigned_user_id}`, check);
      }
    });
    return map;
  }, [checks]);

  // Helper: ensure daily_check exists, then upsert step_check
  const upsertStepCheck = useCallback(async (
    taskId: string,
    stepId: string,
    assigneeId: string,
    campaignId: string | null,
    updates: { is_completed?: boolean; result_value?: string }
  ) => {
    // 1) Find or create the parent daily_check
    const checkKey = campaignId
      ? `${campaignId}:${taskId}`
      : `null:${taskId}:${assigneeId}`;
    let parentCheck = checkMap.get(checkKey);

    if (!parentCheck) {
      const { data: newCheck, error } = await supabase
        .from('daily_checks')
        .insert({
          campaign_id: campaignId,
          task_id: taskId,
          check_date: date,
          assigned_user_id: assigneeId,
          status: '진행중',
        })
        .select()
        .single();
      if (error) throw error;
      parentCheck = newCheck as DailyCheck;
      queryClient.invalidateQueries({ queryKey: queryKeys.checks.byDate(date) });
    }

    // 2) Find existing step_check
    const existingStepCheck = stepCheckMap.get(`${parentCheck.id}:${stepId}`);

    if (existingStepCheck) {
      const updatePayload: Record<string, unknown> = {};
      if (updates.is_completed !== undefined) {
        updatePayload.is_completed = updates.is_completed;
        updatePayload.completed_at = updates.is_completed ? new Date().toISOString() : null;
      }
      if (updates.result_value !== undefined) {
        updatePayload.result_value = updates.result_value;
      }
      await supabase
        .from('step_checks')
        .update(updatePayload)
        .eq('id', existingStepCheck.id);
    } else {
      await supabase
        .from('step_checks')
        .insert({
          daily_check_id: parentCheck.id,
          step_id: stepId,
          is_completed: updates.is_completed ?? false,
          result_value: updates.result_value ?? null,
          completed_at: updates.is_completed ? new Date().toISOString() : null,
        });
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.stepChecks.byDate(date) });
  }, [supabase, date, checkMap, stepCheckMap, queryClient]);

  // Filter tasks by selected categories AND by assignee's default_assignees
  // Campaign-scope: only daily/weekly (monthly/once/as_needed go to periodic section)
  // Global-scope: ALL frequencies (global tasks don't go to periodic section)
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter((t) => !t.parent_task_id && (t.frequency === 'daily' || t.frequency === 'weekly'));

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

  // Build parent → children map for sub-tasks (하위 업무)
  // Sub-tasks follow their parent regardless of their own frequency
  const childTasksMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.parent_task_id) return;
      if (!map.has(t.parent_task_id)) map.set(t.parent_task_id, []);
      map.get(t.parent_task_id)!.push(t);
    });
    // Sort each group by sub_order
    map.forEach((children) => children.sort((a, b) => a.sub_order - b.sub_order));
    return map;
  }, [tasks]);

  // Campaign-scope tasks: from filteredTasks (daily/weekly only)
  const campaignScopeTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.scope !== 'global');
  }, [filteredTasks]);

  // Global-scope tasks: ALL frequencies (not limited to daily/weekly)
  // Global tasks are per-assignee and don't appear in periodic section
  const globalTasks = useMemo(() => {
    let filtered = tasks.filter((t) => !t.parent_task_id && t.scope === 'global');

    if (categories.length > 0) {
      filtered = filtered.filter((task) => categories.includes(task.category));
    }

    if (assigneeName) {
      filtered = filtered.filter((task) => {
        if (!task.default_assignees || task.default_assignees.length === 0) {
          return true;
        }
        return task.default_assignees.some(
          (name) => name.trim() === assigneeName
        );
      });
    }

    return filtered;
  }, [tasks, categories, assigneeName]);

  // Group global tasks by assignee combo for better visibility
  // e.g. ['강상우','심윤우','쇼코'] → one group "강상우, 심윤우, 쇼코"
  const globalTasksByAssignee = useMemo(() => {
    const groups: { assignee: string; tasks: Task[] }[] = [];
    const assigneeMap = new Map<string, Task[]>();

    globalTasks.forEach((task) => {
      // Group by the FULL assignee combo, not individual names
      const key = (!task.default_assignees || task.default_assignees.length === 0)
        ? '전체'
        : task.default_assignees.map((n) => n.trim()).sort((a, b) => a.localeCompare(b, 'ko')).join(', ');
      if (!assigneeMap.has(key)) assigneeMap.set(key, []);
      assigneeMap.get(key)!.push(task);
    });

    // '전체' first, then sort groups by their tasks' minimum loop_order (퍼널 순서 유지)
    if (assigneeMap.has('전체')) {
      groups.push({ assignee: '전체', tasks: assigneeMap.get('전체')! });
    }
    Array.from(assigneeMap.entries())
      .filter(([key]) => key !== '전체')
      .sort(([, tasksA], [, tasksB]) => {
        const minA = Math.min(...tasksA.map((t) => t.loop_order));
        const minB = Math.min(...tasksB.map((t) => t.loop_order));
        return minA - minB;
      })
      .forEach(([assignee, tasks]) => groups.push({ assignee, tasks }));

    return groups;
  }, [globalTasks]);

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

  // Visible campaigns filtered by active campaign type toggles
  const visibleCampaigns = useMemo(() => {
    return filteredCampaigns.filter(c => activeCampaignTypes.has(c.campaign_type));
  }, [filteredCampaigns, activeCampaignTypes]);

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
    const uncompleted = filteredCampaigns.filter((campaign) => {
      if (!isApplicable(campaign.id, task.id)) return false;
      const check = checkMap.get(`${campaign.id}:${task.id}`);
      return !check || (check.status !== '완료' && check.status !== '해당없음');
    });

    if (uncompleted.length === 0) return;
    if (!window.confirm(`"${task.task_name}" 업무를 ${uncompleted.length}개 캠페인에서 일괄 완료 처리하시겠습니까?`)) return;

    uncompleted.forEach((campaign) => {
      const resolvedAssigneeId = resolveCampaignAssigneeId(campaign.id, task);
      const check = checkMap.get(`${campaign.id}:${task.id}`);
      if (!check) {
        bulkCreateCheck({
          campaign_id: campaign.id,
          task_id: task.id,
          check_date: date,
          assigned_user_id: resolvedAssigneeId,
          status: '완료',
        });
      } else {
        bulkUpdateStatus({ id: check.id, status: '완료', assigned_user_id: resolvedAssigneeId });
      }
    });
  }, [filteredCampaigns, checkMap, date, resolveCampaignAssigneeId, bulkCreateCheck, bulkUpdateStatus]);

  const isLoading = checksLoading || tasksLoading || campaignsLoading || configsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-stone-500">
          <div className="size-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
          <span className="text-sm font-medium">데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (filteredCampaigns.length === 0 && globalTasks.length === 0) {
    const message = assigneeName
      ? '선택한 담당자에게 할당된 업무가 없습니다.'
      : categories.length < CATEGORY_ORDER.length
      ? '선택한 카테고리에 해당하는 업무가 없습니다.'
      : '표시할 데이터가 없습니다.';

    return (
      <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground gap-2">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <ListChecks className="size-5 text-muted-foreground/50" />
        </div>
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-3">
    {/* Global Tasks Section (table layout, grouped by assignee) */}
    {globalTasks.length > 0 && (
      <TooltipProvider>
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50/80 flex items-center gap-2">
          <h3 className="text-[12px] font-bold text-stone-700 tracking-tight">
            전역 업무
          </h3>
          <Badge variant="secondary" className="text-[11px] rounded-full px-2.5 py-0.5 ml-auto bg-orange-50 text-orange-600 border-orange-200 font-bold">
            {globalTasks.length}건
          </Badge>
        </div>
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="px-3 py-2.5 text-[11px] font-semibold text-stone-500" style={{ width: '30%' }}>업무</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-stone-500" style={{ width: '7%' }}>카테고리</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-stone-500" style={{ width: '9%' }}>담당자</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-stone-500" style={{ width: '8%' }}>도구</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-stone-500 text-center" style={{ width: '7%' }}>상태</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-stone-500 text-center" style={{ width: '9%' }}>시간</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-stone-500" style={{ width: '30%' }}>결과값</th>
            </tr>
          </thead>
          <tbody>
            {globalTasksByAssignee.map((group) => (
              <Fragment key={group.assignee}>
                {/* Assignee Group Header */}
                {globalTasksByAssignee.length > 1 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-2 bg-amber-50/50 border-b border-stone-100"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center -space-x-1">
                          {(group.assignee === '전체' ? ['전'] : group.assignee.split(', ')).map((name, i) => (
                            <div key={i} className="size-5 rounded-full bg-orange-100 flex items-center justify-center border border-background" style={{ zIndex: 10 - i }}>
                              <span className="text-[9px] font-bold text-orange-700">
                                {name.charAt(0)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <span className="text-[12px] font-bold text-stone-700">
                          {group.assignee}
                        </span>
                        <span className="text-[10px] text-stone-400 ml-1">{group.tasks.length}건</span>
                      </div>
                    </td>
                  </tr>
                )}
                {group.tasks.map((task) => {
                  const catColor = CATEGORY_COLORS[task.category];
                  const subTasks = childTasksMap.get(task.id) || [];

                  // Multi-assignee: collapsible rows (default collapsed)
                  const taskAssigneeNames = task.default_assignees && task.default_assignees.length > 0
                    ? task.default_assignees
                    : null;
                  const isMultiAssignee = !assigneeId && taskAssigneeNames && taskAssigneeNames.length > 1;
                  const isExpanded = expandedGlobalTaskIds.has(task.id);

                  if (isMultiAssignee) {
                    // Count completed for summary badge
                    const completedCount = taskAssigneeNames.filter((aName) => {
                      const aId = nameToIdMap.get(aName.trim()) ?? '';
                      const c = aId ? checkMap.get(`null:${task.id}:${aId}`) : null;
                      return c?.status === '완료' || c?.status === '해당없음';
                    }).length;
                    const allDone = completedCount === taskAssigneeNames.length;

                    return (
                      <Fragment key={`${group.assignee}-${task.id}`}>
                        {/* Collapsed summary row */}
                        <tr className={cn(
                          'border-b border-stone-100 hover:bg-orange-50/40 transition-colors h-[38px]',
                          allDone && 'bg-muted/20',
                          getPriorityBorderClass(task.priority)
                        )}>
                          <td className={cn('px-3 py-1 max-w-0', allDone && 'border-l-[2px] border-l-foreground/30')}>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="shrink-0 p-0 rounded hover:bg-muted/60 transition-colors"
                                onClick={() => toggleGlobalTaskExpand(task.id)}
                              >
                                {isExpanded
                                  ? <ChevronDown className="size-3 text-muted-foreground" />
                                  : <ChevronRight className="size-3 text-muted-foreground" />}
                              </button>
                              <span className="text-[10px] font-mono text-stone-400 shrink-0">{task.loop_order}</span>
                              {allDone && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className={cn('text-[13px] font-semibold truncate block cursor-pointer hover:underline hover:text-orange-600', allDone && 'text-foreground')}
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    {task.task_name}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[300px]">
                                  <p className="text-xs font-medium">{task.task_name}</p>
                                  {task.description && <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>}
                                </TooltipContent>
                              </Tooltip>
                              {task.frequency !== 'daily' && (
                                <span className={cn(
                                  'text-[9px] px-1.5 py-0.5 rounded-md font-semibold shrink-0',
                                  task.frequency === 'weekly' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                                    : task.frequency === 'monthly' ? 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400'
                                    : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                                )}>
                                  {task.frequency === 'weekly' ? '주간' : task.frequency === 'monthly' ? '월간' : task.frequency === 'once' ? '1회' : '수시'}
                                </span>
                              )}
                              {task.description && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button type="button" className="shrink-0 p-0.5 rounded hover:bg-muted/60 transition-colors" onClick={(e) => e.stopPropagation()}>
                                      <Info className="size-3 text-muted-foreground/60 hover:text-primary" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent side="right" align="start" className="w-72 p-3">
                                    <p className="text-xs font-semibold mb-1">{task.task_name}</p>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.description}</p>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {(() => {
                                const taskSteps = stepsMap.get(task.id) || [];
                                return taskSteps.length > 0 ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      'shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded border transition-colors',
                                      expandedStepTaskIds.has(task.id)
                                        ? 'border-primary/40 bg-primary/10 text-primary'
                                        : 'border-border bg-secondary/50 hover:bg-secondary hover:border-foreground/20 text-muted-foreground'
                                    )}
                                    onClick={(e) => { e.stopPropagation(); toggleStepExpand(task.id); }}
                                    title="단계 보기"
                                  >
                                    <ListChecks className="size-3" />
                                    <span className="text-[9px] font-bold">{taskSteps.length}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-border/50 bg-transparent opacity-30 cursor-default"
                                    title="등록된 단계 없음"
                                  >
                                    <ListChecks className="size-2.5 text-muted-foreground" />
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-3 py-1">
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 rounded-md', catColor?.text ?? '', catColor?.bg ?? '')}>
                              {task.category}
                            </Badge>
                          </td>
                          <td className="px-3 py-1">
                            <button
                              type="button"
                              className="text-[11px] text-stone-500 block font-medium hover:text-stone-800 transition-colors text-left"
                              onClick={() => toggleGlobalTaskExpand(task.id)}
                            >
                              <span className="break-words">{taskAssigneeNames.join(', ')}</span>
                              <span className="ml-1 text-[10px] whitespace-nowrap text-stone-400">
                                ({completedCount}/{taskAssigneeNames.length})
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-1">
                            <span className="text-[11px] text-stone-600 truncate block whitespace-nowrap">{task.tool || '-'}</span>
                          </td>
                          <td className="px-3 py-1">
                            <div className="flex items-center justify-center">
                              <span className={cn(
                                'text-[11px] font-semibold',
                                allDone ? 'text-emerald-600' : completedCount > 0 ? 'text-blue-600' : 'text-muted-foreground/40'
                              )}>
                                {allDone ? '전체완료' : `${completedCount}/${taskAssigneeNames.length}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1 text-center">
                            <span className="text-[11px] text-stone-300">-</span>
                          </td>
                          <td className="px-3 py-1">
                            <span className="text-[11px] text-stone-300">펼쳐서 입력</span>
                          </td>
                        </tr>
                        {/* Expanded: individual assignee rows */}
                        {isExpanded && taskAssigneeNames.map((aName) => {
                          const aId = nameToIdMap.get(aName.trim()) ?? '';
                          const check = aId ? (checkMap.get(`null:${task.id}:${aId}`) ?? null) : null;
                          const isCompleted = check?.status === '완료';
                          return (
                            <tr key={`${group.assignee}-${task.id}-${aName}`} className={cn(
                              'border-b border-border/30 hover:bg-orange-50/30 transition-colors h-[38px] bg-stone-50/40',
                              isCompleted && 'bg-muted/20',
                            )}>
                              <td className="px-3 py-1 max-w-0">
                                <span className="text-[10px] text-stone-400 pl-5">↳</span>
                              </td>
                              <td className="px-3 py-1" />
                              <td className="px-3 py-1">
                                <span className="text-[11px] text-stone-600 truncate block whitespace-nowrap font-medium">
                                  {aName.trim()}
                                </span>
                              </td>
                              <td className="px-3 py-1" />
                              <td className="px-3 py-1">
                                <div className="flex items-center justify-center gap-0.5">
                                  <GlobalStatusSelect
                                    check={check}
                                    taskId={task.id}
                                    date={date}
                                    assigneeId={aId || effectiveUserId}
                                  />
                                  {check?.note && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <MessageSquare className="size-3 text-blue-500/50 shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p className="text-xs">메모: {check.note}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-1 text-center">
                                {check?.started_at ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex flex-col items-center leading-tight cursor-default">
                                        <span className="text-[10px] tabular-nums text-stone-400">
                                          {new Date(check.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-[11px] tabular-nums text-stone-800 font-bold">
                                          {new Date(check.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="text-xs space-y-0.5">
                                        <p>최초: {new Date(check.started_at).toLocaleString('ko-KR')}</p>
                                        <p>최근: {new Date(check.updated_at).toLocaleString('ko-KR')}</p>
                                        {check.completed_at && <p>완료: {new Date(check.completed_at).toLocaleString('ko-KR')}</p>}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-[11px] text-stone-300">-</span>
                                )}
                              </td>
                              <td className="px-3 py-1">
                                <ResultValueInput
                                  check={check}
                                  taskId={task.id}
                                  date={date}
                                  assigneeId={aId || effectiveUserId}
                                />
                              </td>
                            </tr>
                          );
                        })}
                        {/* Sub-tasks (하위 업무) for multi-assignee parent */}
                        {subTasks.map((subTask) => {
                          const subCatColor = CATEGORY_COLORS[subTask.category];
                          const subUserId = resolveGlobalUserId(subTask);
                          const subCheck = checkMap.get(`null:${subTask.id}:${subUserId}`) ?? null;
                          return (
                            <tr key={`sub-${subTask.id}`} className="border-b border-stone-50 hover:bg-orange-50/30 transition-colors h-[38px] bg-stone-50/30">
                              <td className="px-3 py-1 max-w-0">
                                <div className="flex items-center gap-1 pl-5">
                                  <span className="text-[10px] font-mono text-stone-400">{task.loop_order}-{subTask.sub_order}</span>
                                  <span className="text-[12px] text-stone-600 font-medium truncate">{subTask.task_name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-1">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 rounded-md', subCatColor?.text ?? '', subCatColor?.bg ?? '')}>
                                  {subTask.category}
                                </Badge>
                              </td>
                              <td className="px-3 py-1">
                                <span className="text-[11px] text-stone-600 truncate block">{subTask.default_assignees?.join(', ') || '-'}</span>
                              </td>
                              <td className="px-3 py-1">
                                <span className="text-[11px] text-stone-600 truncate block whitespace-nowrap">{subTask.tool || '-'}</span>
                              </td>
                              <td className="px-3 py-1">
                                <div className="flex items-center justify-center">
                                  <GlobalStatusSelect check={subCheck} taskId={subTask.id} date={date} assigneeId={subUserId} />
                                </div>
                              </td>
                              <td className="px-3 py-1 text-center">
                                <span className="text-[11px] text-stone-300">-</span>
                              </td>
                              <td className="px-3 py-1">
                                <ResultValueInput check={subCheck} taskId={subTask.id} date={date} assigneeId={subUserId} />
                              </td>
                            </tr>
                          );
                        })}
                        {/* Inline Step rows (interactive) */}
                        {expandedStepTaskIds.has(task.id) && (stepsMap.get(task.id) || []).map((step) => {
                          const resolvedId = resolveGlobalUserId(task);
                          const parentCheck = checkMap.get(`null:${task.id}:${resolvedId}`);
                          const sc = parentCheck ? stepCheckMap.get(`${parentCheck.id}:${step.id}`) : undefined;
                          return (
                            <StepCheckRow
                              key={`step-${step.id}`}
                              step={step}
                              stepCheck={sc}
                              colSpan={7}
                              paddingLeft="pl-5"
                              onToggle={() => upsertStepCheck(task.id, step.id, resolvedId, null, { is_completed: !sc?.is_completed })}
                              onResultSave={(val) => upsertStepCheck(task.id, step.id, resolvedId, null, { result_value: val })}
                            />
                          );
                        })}
                      </Fragment>
                    );
                  }

                  // Single assignee or specific assignee view: original single-row rendering
                  const resolvedUserId = resolveGlobalUserId(task);
                  const check = checkMap.get(`null:${task.id}:${resolvedUserId}`) ?? null;
                  const assignees = task.default_assignees?.join(', ') || null;
                  const isCompleted = check?.status === '완료';
                  return (
                    <Fragment key={`${group.assignee}-${task.id}-wrap`}>
                    <tr key={`${group.assignee}-${task.id}`} className={cn(
                      'border-b border-stone-100 hover:bg-orange-50/40 transition-colors h-[38px]',
                      isCompleted && 'bg-muted/20',
                      getPriorityBorderClass(task.priority)
                    )}>
                      <td className={cn(
                        'px-3 py-1 max-w-0',
                        isCompleted && 'border-l-[2px] border-l-foreground/30'
                      )}>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-stone-400 shrink-0">{task.loop_order}</span>
                          {isCompleted && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn('text-[13px] font-semibold truncate block cursor-pointer hover:underline hover:text-orange-600', isCompleted && 'text-foreground')}
                                onClick={() => setSelectedTask(task)}
                              >{task.task_name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[300px]">
                              <p className="text-xs font-medium">{task.task_name}</p>
                              {task.description && <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>}
                            </TooltipContent>
                          </Tooltip>
                          {task.frequency !== 'daily' && (
                            <span className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded-md font-semibold shrink-0',
                              task.frequency === 'weekly' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                                : task.frequency === 'monthly' ? 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400'
                                : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                            )}>
                              {task.frequency === 'weekly' ? '주간' : task.frequency === 'monthly' ? '월간' : task.frequency === 'once' ? '1회' : '수시'}
                            </span>
                          )}
                          {task.description && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className="shrink-0 p-0.5 rounded hover:bg-muted/60 transition-colors" onClick={(e) => e.stopPropagation()}>
                                  <Info className="size-3 text-muted-foreground/60 hover:text-primary" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="right" align="start" className="w-72 p-3">
                                <p className="text-xs font-semibold mb-1">{task.task_name}</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.description}</p>
                              </PopoverContent>
                            </Popover>
                          )}
                          {(() => {
                            const taskSteps = stepsMap.get(task.id) || [];
                            return taskSteps.length > 0 ? (
                              <button
                                type="button"
                                className={cn(
                                  'shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded border transition-colors',
                                  expandedStepTaskIds.has(task.id)
                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                    : 'border-border bg-secondary/50 hover:bg-secondary hover:border-foreground/20 text-muted-foreground'
                                )}
                                onClick={(e) => { e.stopPropagation(); toggleStepExpand(task.id); }}
                                title="단계 보기"
                              >
                                <ListChecks className="size-3" />
                                <span className="text-[9px] font-bold">{taskSteps.length}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-border/50 bg-transparent opacity-30 cursor-default"
                                title="등록된 단계 없음"
                              >
                                <ListChecks className="size-2.5 text-muted-foreground" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-1">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 rounded-md', catColor?.text ?? '', catColor?.bg ?? '')}>
                          {task.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-1">
                        {assignees ? (
                          <span className="text-[11px] text-stone-600 truncate block whitespace-nowrap">{assignees}</span>
                        ) : (
                          <span className="text-[11px] text-red-500 font-semibold truncate block whitespace-nowrap">지정안됨</span>
                        )}
                      </td>
                      <td className="px-3 py-1">
                        <span className="text-[11px] text-stone-600 truncate block whitespace-nowrap">{task.tool || '-'}</span>
                      </td>
                      <td className="px-3 py-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <GlobalStatusSelect
                            check={check}
                            taskId={task.id}
                            date={date}
                            assigneeId={resolvedUserId}
                          />
                          {check?.note && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <MessageSquare className="size-3 text-blue-500/50 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">메모: {check.note}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1 text-center">
                        {check?.started_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center leading-tight cursor-default">
                                <span className="text-[10px] tabular-nums text-stone-400">
                                  {new Date(check.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[11px] tabular-nums text-stone-800 font-bold">
                                  {new Date(check.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="text-xs space-y-0.5">
                                <p>최초: {new Date(check.started_at).toLocaleString('ko-KR')}</p>
                                <p>최근: {new Date(check.updated_at).toLocaleString('ko-KR')}</p>
                                {check.completed_at && <p>완료: {new Date(check.completed_at).toLocaleString('ko-KR')}</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-[11px] text-stone-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1">
                        <ResultValueInput
                          check={check}
                          taskId={task.id}
                          date={date}
                          assigneeId={resolvedUserId}
                        />
                      </td>
                    </tr>
                    {/* Sub-tasks (하위 업무) for single-assignee parent */}
                    {subTasks.map((subTask) => {
                      const subCatColor = CATEGORY_COLORS[subTask.category];
                      const subUserId = resolveGlobalUserId(subTask);
                      const subCheck = checkMap.get(`null:${subTask.id}:${subUserId}`) ?? null;
                      return (
                        <tr key={`sub-${subTask.id}`} className="border-b border-stone-50 hover:bg-orange-50/30 transition-colors h-[38px] bg-stone-50/30">
                          <td className="px-3 py-1 max-w-0">
                            <div className="flex items-center gap-1 pl-4">
                              <span className="text-[10px] font-mono text-stone-400">{task.loop_order}-{subTask.sub_order}</span>
                              <span className="text-[12px] text-stone-600 font-medium truncate">{subTask.task_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1">
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 rounded-md', subCatColor?.text ?? '', subCatColor?.bg ?? '')}>
                              {subTask.category}
                            </Badge>
                          </td>
                          <td className="px-3 py-1">
                            <span className="text-[11px] text-stone-600 truncate block">{subTask.default_assignees?.join(', ') || '-'}</span>
                          </td>
                          <td className="px-3 py-1">
                            <span className="text-[11px] text-stone-600 truncate block whitespace-nowrap">{subTask.tool || '-'}</span>
                          </td>
                          <td className="px-3 py-1">
                            <div className="flex items-center justify-center">
                              <GlobalStatusSelect check={subCheck} taskId={subTask.id} date={date} assigneeId={subUserId} />
                            </div>
                          </td>
                          <td className="px-3 py-1 text-center">
                            <span className="text-[11px] text-stone-300">-</span>
                          </td>
                          <td className="px-3 py-1">
                            <ResultValueInput check={subCheck} taskId={subTask.id} date={date} assigneeId={subUserId} />
                          </td>
                        </tr>
                      );
                    })}
                    {/* Inline Step rows (interactive) */}
                    {expandedStepTaskIds.has(task.id) && (stepsMap.get(task.id) || []).map((step) => {
                      const parentCheck = checkMap.get(`null:${task.id}:${resolvedUserId}`);
                      const sc = parentCheck ? stepCheckMap.get(`${parentCheck.id}:${step.id}`) : undefined;
                      return (
                        <StepCheckRow
                          key={`step-${step.id}`}
                          step={step}
                          stepCheck={sc}
                          colSpan={7}
                          paddingLeft="pl-4"
                          onToggle={() => upsertStepCheck(task.id, step.id, resolvedUserId, null, { is_completed: !sc?.is_completed })}
                          onResultSave={(val) => upsertStepCheck(task.id, step.id, resolvedUserId, null, { result_value: val })}
                        />
                      );
                    })}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      </TooltipProvider>
    )}

    {/* Campaign-scope Tasks Grid */}
    {filteredCampaigns.length > 0 && campaignScopeTasks.length > 0 && (
    <TooltipProvider>
    <div>
    {/* Campaign Type Filter */}
    <div className="flex items-center gap-1.5 mb-1.5">
      {(['해외마케팅', '국내챗닥', '제품브랜드'] as const).map((type) => {
        const count = filteredCampaigns.filter(c => c.campaign_type === type).length;
        if (count === 0) return null;
        const isActive = activeCampaignTypes.has(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => {
              setActiveCampaignTypes(prev => {
                const next = new Set(prev);
                if (next.has(type)) next.delete(type);
                else next.add(type);
                return next;
              });
            }}
            className={cn(
              'text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors',
              isActive
                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                : 'bg-white text-stone-500 border-stone-200 hover:border-orange-300 hover:text-orange-600'
            )}
          >
            {type} ({count})
          </button>
        );
      })}
    </div>
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50/80 flex items-center gap-2">
        <h3 className="text-[12px] font-bold text-stone-700 tracking-tight">
          일일 캠페인별 업무
        </h3>
        <Badge variant="secondary" className="text-[11px] rounded-full px-2.5 py-0.5 ml-auto bg-blue-50 text-blue-600 border-blue-200 font-bold">
          {visibleCampaigns.length}개 캠페인
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
                'bg-white border-b border-r border-stone-200 px-3 py-2',
                'text-left text-[11px] font-bold text-stone-600'
              )}
            >
              업무
            </th>
            {visibleCampaigns.map((campaign) => {
              const countryShort = campaign.target_country
                ? campaign.target_country.replace('중화권(홍,말,싱)', '중화').slice(0, 2)
                : '';
              return (
                <th
                  key={campaign.id}
                  className={cn(
                    'sticky top-0 z-20',
                    'bg-white border-b border-stone-100 px-1 py-2',
                    'text-center min-w-[44px] max-w-[50px]'
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-0 cursor-help">
                        <span className="text-[10px] font-bold text-stone-800 leading-tight">
                          {campaign.client_name.slice(0, 3)}
                        </span>
                        <span className="text-[9px] text-stone-400 leading-tight">
                          {campaign.campaign_name.slice(0, 3)}
                        </span>
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
                'bg-white border-b border-l border-stone-200 px-2 py-2',
                'text-center text-[10px] font-bold text-stone-600',
                'min-w-[50px]'
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
                    colSpan={visibleCampaigns.length + 2}
                    className={cn(
                      'sticky left-0 z-10',
                      'px-3 py-2 text-[11px] font-bold tracking-tight',
                      'bg-stone-50 text-stone-600',
                      'border-b border-stone-200'
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
                  const subTasks = childTasksMap.get(task.id) || [];

                  return (
                    <Fragment key={`${task.id}-wrap`}>
                    <tr key={task.id} className={cn(
                      'hover:bg-orange-50/40 transition-colors',
                      getPriorityBorderClass(task.priority)
                    )}>
                      {/* Task Name (sticky left) */}
                      <td
                        className={cn(
                          'sticky left-0 z-10',
                          'border-b border-r border-stone-100 px-3 py-2',
                          'text-[13px] font-semibold text-stone-800',
                          'min-w-[200px] max-w-[240px]',
                          'bg-white'
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-stone-400 shrink-0">{task.loop_order}</span>
                          {pct === 100 && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="truncate cursor-pointer hover:underline font-medium text-[12px]"
                                onClick={() => setSelectedTask(task)}
                              >{task.task_name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[300px]">
                              <p className="text-xs font-medium">{task.task_name}</p>
                              {task.description && <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>}
                              {task.default_assignees?.length ? (
                                <p className="text-[10px] text-muted-foreground mt-0.5">담당: {task.default_assignees.join(', ')}</p>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                          {task.description && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className="shrink-0 p-0.5 rounded hover:bg-muted/60 transition-colors" onClick={(e) => e.stopPropagation()}>
                                  <Info className="size-3 text-muted-foreground/60 hover:text-primary" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="right" align="start" className="w-72 p-3 z-50">
                                <p className="text-xs font-semibold mb-1">{task.task_name}</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.description}</p>
                              </PopoverContent>
                            </Popover>
                          )}
                          {summary && summary.completed < summary.total && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => handleBulkComplete(task)}
                                  className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                                >
                                  <Trophy className="size-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right"><p className="text-xs">캠페인 전체 완료</p></TooltipContent>
                            </Tooltip>
                          )}
                          {(() => {
                            const taskSteps = stepsMap.get(task.id) || [];
                            return taskSteps.length > 0 ? (
                              <button
                                type="button"
                                className={cn(
                                  'shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded border transition-colors',
                                  expandedStepTaskIds.has(task.id)
                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                    : 'border-border bg-secondary/50 hover:bg-secondary hover:border-foreground/20 text-muted-foreground'
                                )}
                                onClick={(e) => { e.stopPropagation(); toggleStepExpand(task.id); }}
                                title="단계 보기"
                              >
                                <ListChecks className="size-3" />
                                <span className="text-[9px] font-bold">{taskSteps.length}</span>
                              </button>
                            ) : null;
                          })()}
                        </div>
                        {!assigneeName && task.default_assignees && task.default_assignees.length > 0 && (
                          <span className="text-[11px] text-stone-400 truncate block">
                            {task.default_assignees.join(', ')}
                          </span>
                        )}
                      </td>

                      {/* Status Cells */}
                      {visibleCampaigns.map((campaign) => {
                        const applicable = isApplicable(campaign.id, task.id);
                        const check = checkMap.get(`${campaign.id}:${task.id}`) ?? null;
                        const campaignAssigneeId = resolveCampaignAssigneeId(campaign.id, task);

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
                                assigneeId={campaignAssigneeId || undefined}
                              />
                            </div>
                          </td>
                        );
                      })}

                      {/* Task Summary */}
                      <td
                        className={cn(
                          'sticky right-0 z-10',
                          'border-b border-l px-1.5 py-0',
                          'text-center',
                          'bg-background'
                        )}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {summary?.completed ?? 0}/{summary?.total ?? 0}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[11px] rounded-full px-1.5 py-0"
                          >
                            {pct}%
                          </Badge>
                        </div>
                      </td>
                    </tr>
                    {/* Sub-tasks (하위 업무) for campaign-scope parent */}
                    {subTasks.map((subTask) => (
                      <tr key={`sub-${subTask.id}`} className="hover:bg-muted/10 transition-colors">
                        <td
                          className={cn(
                            'sticky left-0 z-10',
                            'border-b border-r border-border px-2 py-0.5',
                            'text-[11px] text-muted-foreground',
                            'min-w-[180px] max-w-[220px]',
                            'bg-background'
                          )}
                        >
                          <div className="flex items-center gap-1 pl-4">
                            <span className="text-[10px] font-mono text-stone-400">{task.loop_order}-{subTask.sub_order}</span>
                            <span className="truncate font-medium">{subTask.task_name}</span>
                          </div>
                        </td>
                        {visibleCampaigns.map((campaign) => {
                          const applicable = isApplicable(campaign.id, subTask.id);
                          const subCheck = checkMap.get(`${campaign.id}:${subTask.id}`) ?? null;
                          const campaignAssigneeId = resolveCampaignAssigneeId(campaign.id, subTask);
                          return (
                            <td key={campaign.id} className="border-b px-0.5 py-0 text-center">
                              <div className="flex items-center justify-center">
                                <StatusCell
                                  check={subCheck}
                                  isApplicable={applicable}
                                  campaignId={campaign.id}
                                  taskId={subTask.id}
                                  date={date}
                                  assigneeId={campaignAssigneeId || undefined}
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className={cn('sticky right-0 z-10', 'border-b border-l px-1.5 py-0', 'text-center', 'bg-background')}>
                          <span className="text-[11px] text-stone-300">-</span>
                        </td>
                      </tr>
                    ))}
                    {/* Inline Step rows for campaign-scope tasks (interactive) */}
                    {expandedStepTaskIds.has(task.id) && (stepsMap.get(task.id) || []).map((step) => (
                      <tr key={`step-${step.id}`} className="h-[30px] bg-orange-50/30">
                        <td
                          className={cn('sticky left-0 z-10', 'border-b border-r border-border px-2 py-0', 'bg-orange-50/30', 'min-w-[200px] max-w-[240px]')}
                        >
                          <div className="flex items-center gap-1.5 pl-4">
                            <span className="text-[9px] font-bold text-orange-600 bg-orange-100 rounded-full size-5 flex items-center justify-center shrink-0">{step.step_order}</span>
                            <span className="text-[11px] text-stone-700 font-medium truncate">{step.step_name}</span>
                            {step.tool_url && (
                              <a href={step.tool_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground/50 hover:text-primary transition-colors">
                                <ExternalLink className="size-2.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        {visibleCampaigns.map((campaign) => {
                          const parentCheck = checkMap.get(`${campaign.id}:${task.id}`);
                          const sc = parentCheck ? stepCheckMap.get(`${parentCheck.id}:${step.id}`) : undefined;
                          return (
                            <CampaignStepCell
                              key={campaign.id}
                              stepCheck={sc}
                              onToggle={() => upsertStepCheck(task.id, step.id, effectiveUserId, campaign.id, { is_completed: !sc?.is_completed })}
                            />
                          );
                        })}
                        <td className={cn('sticky right-0 z-10', 'border-b border-l px-1.5 py-0', 'bg-primary/5')} />
                      </tr>
                    ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}

          {/* Bottom Summary Row */}
          <tr className="sticky bottom-0 z-15 shadow-[0_-2px_6px_rgba(0,0,0,0.06)]">
            <td
              className={cn(
                'sticky left-0 z-20',
                'bg-background border-t-2 px-2 py-0.5',
                'text-[10px] font-semibold text-foreground'
              )}
            >
              캠페인 완료율
            </td>
            {visibleCampaigns.map((campaign) => {
              const summary = campaignSummary.get(campaign.id);
              const cPct =
                summary && summary.total > 0
                  ? Math.round((summary.completed / summary.total) * 100)
                  : 0;

              return (
                <td
                  key={campaign.id}
                  className={cn(
                    'border-t-2 px-1 py-0.5 text-center',
                    cPct === 100
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/20'
                      : 'bg-background'
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {summary?.completed ?? 0}/{summary?.total ?? 0}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[11px] rounded-full px-1.5 py-0"
                    >
                      {cPct}%
                    </Badge>
                  </div>
                </td>
              );
            })}
            <td
              className={cn(
                'sticky right-0 z-20',
                'bg-background border-t-2 border-l px-1.5 py-0.5 text-center'
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
                    className="text-[11px] rounded-full px-2 py-0.5 font-semibold"
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
    </div>
    </TooltipProvider>
    )}

    {/* Task Detail Side Panel */}
    <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

// ─── CampaignStepCell: checkbox for campaign-scope step in each campaign column ───
function CampaignStepCell({
  stepCheck,
  onToggle,
}: {
  stepCheck: StepCheck | undefined;
  onToggle: () => void;
}) {
  return (
    <td className="border-b px-0.5 py-0 bg-primary/5">
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'size-3.5 rounded border flex items-center justify-center transition-colors',
            stepCheck?.is_completed
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-border/50 hover:border-primary/50'
          )}
        >
          {stepCheck?.is_completed && <Check className="size-2.5" />}
        </button>
      </div>
    </td>
  );
}

// ─── StepCheckRow: interactive step row with checkbox + result input ───
function StepCheckRow({
  step,
  stepCheck,
  colSpan,
  paddingLeft,
  onToggle,
  onResultSave,
}: {
  step: TaskStep;
  stepCheck: StepCheck | undefined;
  colSpan: number;
  paddingLeft: string;
  onToggle: () => void;
  onResultSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    setValue(stepCheck?.result_value ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed !== (stepCheck?.result_value ?? '')) {
      onResultSave(trimmed);
    }
  };

  return (
    <tr className="h-[20px] bg-primary/5 border-b border-border/20">
      <td colSpan={colSpan} className="px-3 py-1">
        <div className={cn('flex items-center gap-1.5', paddingLeft)}>
          {/* Checkbox */}
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'shrink-0 size-3.5 rounded border flex items-center justify-center transition-colors',
              stepCheck?.is_completed
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border hover:border-primary/50'
            )}
          >
            {stepCheck?.is_completed && <Check className="size-2.5" />}
          </button>
          {/* Step order badge */}
          <span className="text-[9px] font-bold text-orange-600 bg-orange-100 rounded-full size-5 flex items-center justify-center shrink-0">
            {step.step_order}
          </span>
          {/* Step name */}
          <span className={cn(
            'text-[11px] font-medium truncate',
            stepCheck?.is_completed ? 'text-stone-400 line-through' : 'text-stone-700'
          )}>
            {step.step_name}
          </span>
          {/* Tool URL */}
          {step.tool_url && (
            <a
              href={step.tool_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground/50 hover:text-primary transition-colors"
            >
              <ExternalLink className="size-2.5" />
            </a>
          )}
          {/* Result value input */}
          <div className="ml-auto flex items-center gap-1 shrink-0 w-[120px]">
            {editing ? (
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-full text-[11px] bg-transparent border-b border-orange-300 outline-none px-0.5 py-0.5 text-stone-800"
                placeholder="결과값..."
              />
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className={cn(
                  'w-full text-left text-[11px] px-0.5 py-0.5 truncate rounded hover:bg-orange-50 transition-colors cursor-text min-h-[16px]',
                  stepCheck?.result_value ? 'text-stone-700' : 'text-stone-300'
                )}
              >
                {stepCheck?.result_value || '값 입력'}
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// Fragment helper for grouping without extra DOM nodes
function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
