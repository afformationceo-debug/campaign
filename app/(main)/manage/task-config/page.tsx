'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Filter, ToggleLeft, Rows3, Bot } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useRealtimeTaskConfig } from '@/hooks/use-realtime-task-config';
import { useAuth } from '@/hooks/use-auth';
import { logActivity } from '@/lib/utils/log-activity';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  Campaign,
  Task,
  CampaignTaskConfig,
  TaskCategory,
  TaskFrequency,
} from '@/lib/types/database';

const FREQUENCY_LABEL: Record<TaskFrequency, string> = {
  daily: '일일',
  weekly: '주간',
  monthly: '월간',
  once: '1회',
  as_needed: '필요시',
};

/* ──────────────────────────────────────────────
 *  Target Count Input (debounced via onBlur)
 * ────────────────────────────────────────────── */
function TargetCountInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (val: number | null) => void;
}) {
  const [localValue, setLocalValue] = useState<string>(value != null ? String(value) : '');

  useEffect(() => {
    setLocalValue(value != null ? String(value) : '');
  }, [value]);

  return (
    <Input
      type="number"
      className="h-6 w-14 text-xs text-center"
      min={0}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        const num = localValue === '' ? null : parseInt(localValue, 10);
        const finalVal = num != null && Number.isNaN(num) ? null : num;
        if (finalVal !== value) {
          onChange(finalVal);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="목표"
    />
  );
}

/* ──────────────────────────────────────────────
 *  Campaign × Task Matrix (used for Tab 1 & 2)
 * ────────────────────────────────────────────── */
function TaskConfigMatrix({
  tasks: matrixTasks,
  campaigns,
  configMap,
  allTasks,
  onToggle,
  onBulkToggleRow,
  onBulkToggleColumn,
  onBulkToggleCategory,
  childTaskMap,
  targetCountMap,
  onUpdateTargetCount,
}: {
  tasks: Task[];
  campaigns: Campaign[];
  configMap: Map<string, boolean>;
  allTasks: Task[];
  onToggle: (campaignId: string, taskId: string, isApplicable: boolean) => void;
  onBulkToggleRow: (campaignId: string, tasks: Task[], enable: boolean) => void;
  onBulkToggleColumn: (taskId: string, campaigns: Campaign[], enable: boolean) => void;
  onBulkToggleCategory: (category: TaskCategory, tasks: Task[], campaigns: Campaign[], enable: boolean) => void;
  childTaskMap?: Map<string, Task[]>;
  targetCountMap?: Map<string, number | null>;
  onUpdateTargetCount?: (campaignId: string, taskId: string, targetCount: number | null) => void;
}) {
  const getIsApplicable = useCallback(
    (campaignId: string, taskId: string): boolean => {
      const key = `${campaignId}-${taskId}`;
      const configVal = configMap.get(key);
      if (configVal !== undefined) return configVal;
      const task = allTasks.find((t) => t.id === taskId);
      return task?.is_applicable_default ?? true;
    },
    [configMap, allTasks]
  );

  // Group tasks by category
  const tasksByCategory = useMemo(() => {
    const grouped: { category: TaskCategory; tasks: Task[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const catTasks = matrixTasks.filter((t) => t.category === cat);
      if (catTasks.length > 0) {
        grouped.push({ category: cat, tasks: catTasks });
      }
    }
    return grouped;
  }, [matrixTasks]);

  if (matrixTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-stone-400 gap-2">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-50">
          <Filter className="size-4 text-orange-400" />
        </div>
        <span>해당 유형의 업무가 아직 없어요.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Category bulk toggles */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-stone-400 mr-1">카테고리 일괄:</span>
        {tasksByCategory.map(({ category, tasks: catTasks }) => {
          return (
            <div key={category} className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="bg-orange-50 text-orange-600 hover:bg-orange-100 text-[10px]"
                    onClick={() => onBulkToggleCategory(category, catTasks, campaigns, true)}
                  >
                    {category}
                    <ToggleLeft className="h-3 w-3 ml-0.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{category} 전체 ON</TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>

      {/* Matrix table */}
      <div className="border border-stone-100 rounded-2xl overflow-auto max-h-[calc(100vh-340px)] shadow-sm">
        <table className="text-xs">
          <thead className="sticky top-0 z-20 bg-white">
            {/* Category header row */}
            <tr className="border-b border-stone-100">
              <th
                className="sticky left-0 z-30 bg-white border-r border-stone-100 p-1 min-w-[180px]"
                rowSpan={2}
              >
                <span className="text-stone-500 font-medium">캠페인</span>
              </th>
              {tasksByCategory.map(({ category, tasks: catTasks }) => {
                return (
                  <th
                    key={category}
                    colSpan={catTasks.length}
                    className="p-1 text-center border-r border-stone-100 border-b-0 font-medium bg-orange-50 text-orange-700"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {category}
                      <span className="text-[10px] opacity-60">({catTasks.length})</span>
                    </div>
                  </th>
                );
              })}
            </tr>
            {/* Task name header row */}
            <tr className="border-b border-stone-100">
              {tasksByCategory.map(({ tasks: catTasks }) =>
                catTasks.map((task, idx) => (
                  <th
                    key={task.id}
                    className={cn(
                      'p-1 border-r border-stone-100 min-w-[64px] max-w-[64px] bg-stone-50 align-bottom',
                      idx === catTasks.length - 1 && 'border-r-2'
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="text-center cursor-pointer text-[10px] leading-tight font-medium line-clamp-2 hover:text-primary transition-colors"
                          onClick={() => {
                            const allOn = campaigns.every(
                              (c) => getIsApplicable(c.id, task.id)
                            );
                            onBulkToggleColumn(task.id, campaigns, !allOn);
                          }}
                        >
                          {task.task_name}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px]">
                        <p className="font-medium text-xs">{task.task_name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {task.category} · {FREQUENCY_LABEL[task.frequency]}
                        </p>
                        {childTaskMap?.has(task.id) && (
                          <p className="text-[10px] text-muted-foreground">
                            하위업무: {childTaskMap.get(task.id)!.map(c => c.task_name).join(', ')}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">클릭하여 전체 토글</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign, rowIdx) => (
              <tr key={campaign.id} className={cn(
                'border-b border-stone-50 hover:bg-orange-50/30 transition-colors',
                rowIdx % 2 === 1 && 'bg-stone-50/30'
              )}>
                <td className={cn(
                  'sticky left-0 z-10 border-r border-stone-100 p-1 min-w-[180px] max-w-[180px]',
                  rowIdx % 2 === 1 ? 'bg-stone-50/30' : 'bg-white'
                )}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0 opacity-50 hover:opacity-100"
                          onClick={() => {
                            const allOn = matrixTasks.every(
                              (t) => getIsApplicable(campaign.id, t.id)
                            );
                            onBulkToggleRow(campaign.id, matrixTasks, !allOn);
                          }}
                        >
                          <Rows3 className="h-3 w-3" />
                        </Button>
                        <div className="truncate">
                          <span className="font-medium text-xs">
                            {campaign.campaign_name}
                          </span>
                          {campaign.target_country && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({campaign.target_country})
                            </span>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{campaign.campaign_name}</p>
                      <p className="text-[10px]">{campaign.client_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        행 토글 버튼으로 전체 ON/OFF
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </td>
                {tasksByCategory.map(({ tasks: catTasks }) =>
                  catTasks.map((task, idx) => {
                    const isApplicable = getIsApplicable(campaign.id, task.id);
                    const hasChildren = childTaskMap?.has(task.id);
                    return (
                      <td
                        key={task.id}
                        className={cn(
                          'p-0 text-center border-r border-stone-50',
                          idx === catTasks.length - 1 && 'border-r-2 border-r-stone-100',
                          isApplicable && 'bg-orange-50/20'
                        )}
                      >
                        <div className={cn(
                          'flex flex-col items-center justify-center',
                          hasChildren ? 'py-0.5 gap-0.5' : 'h-7'
                        )}>
                          <Switch
                            size="sm"
                            checked={isApplicable}
                            onCheckedChange={(checked) =>
                              onToggle(campaign.id, task.id, checked)
                            }
                          />
                          {hasChildren && targetCountMap && onUpdateTargetCount && (
                            <TargetCountInput
                              value={targetCountMap.get(`${campaign.id}-${task.id}`) ?? null}
                              onChange={(val) =>
                                onUpdateTargetCount(campaign.id, task.id, val)
                              }
                            />
                          )}
                        </div>
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
 *  Global Tasks List (Tab 3)
 * ────────────────────────────────────────────── */
function GlobalTasksList({
  tasks: globalTasks,
  onToggleDefault,
}: {
  tasks: Task[];
  onToggleDefault: (taskId: string, isApplicableDefault: boolean) => void;
}) {
  // Group by category
  const grouped = useMemo(() => {
    const result: { category: TaskCategory; tasks: Task[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const catTasks = globalTasks.filter((t) => t.category === cat);
      if (catTasks.length > 0) {
        result.push({ category: cat, tasks: catTasks });
      }
    }
    return result;
  }, [globalTasks]);

  if (globalTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-stone-400 gap-2">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-50">
          <Bot className="size-4 text-amber-400" />
        </div>
        <span>아직 전역 업무가 없어요.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-stone-400">
        전역 업무는 캠페인과 무관하게 적용돼요. 기본 적용 여부를 설정할 수 있어요.
      </p>

      {grouped.map(({ category, tasks: catTasks }) => {
        return (
          <div key={category} className="rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
            <div className="px-3 py-1.5 border-b border-stone-100 flex items-center gap-2 bg-stone-50/50">
              <span className="text-[11px] font-semibold text-foreground">
                {category}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
                {catTasks.length}
              </Badge>
            </div>

            <div className="divide-y">
              {catTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-orange-50/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">
                        {task.task_name}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                        {FREQUENCY_LABEL[task.frequency]}
                      </Badge>
                    </div>
                    {task.default_assignees && task.default_assignees.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        담당: {task.default_assignees.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {task.is_applicable_default ? '적용' : '미적용'}
                    </span>
                    <Switch
                      size="sm"
                      checked={task.is_applicable_default}
                      onCheckedChange={(checked) =>
                        onToggleDefault(task.id, checked)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────
 *  Main Page
 * ────────────────────────────────────────────── */
export default function TaskConfigPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();

  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useRealtimeTaskConfig();

  // ── Data Fetching ──
  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('campaign_name');
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('loop_order');
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: queryKeys.taskConfig.all,
    queryFn: () => fetchAll<CampaignTaskConfig>(supabase, 'campaign_task_config'),
  });

  // ── Mutations ──

  // Toggle single campaign_task_config cell
  const toggleMutation = useMutation({
    mutationFn: async ({
      campaignId,
      taskId,
      isApplicable,
    }: {
      campaignId: string;
      taskId: string;
      isApplicable: boolean;
    }) => {
      const { error } = await supabase
        .from('campaign_task_config')
        .upsert(
          {
            campaign_id: campaignId,
            task_id: taskId,
            is_applicable: isApplicable,
          },
          { onConflict: 'campaign_id,task_id' }
        );
      if (error) throw error;
      logActivity({
        userId: profile?.id,
        actionType: 'upsert',
        targetTable: 'campaign_task_config',
        newValue: { campaign_id: campaignId, task_id: taskId, is_applicable: isApplicable },
      });
    },
    onMutate: async ({ campaignId, taskId, isApplicable }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.taskConfig.all });
      const previous = queryClient.getQueryData<CampaignTaskConfig[]>(
        queryKeys.taskConfig.all
      );
      queryClient.setQueryData(
        queryKeys.taskConfig.all,
        (old: CampaignTaskConfig[] | undefined) => {
          const list = old || [];
          const idx = list.findIndex(
            (c) => c.campaign_id === campaignId && c.task_id === taskId
          );
          if (idx >= 0) {
            const updated = [...list];
            updated[idx] = { ...updated[idx], is_applicable: isApplicable };
            return updated;
          }
          return [
            ...list,
            {
              id: `temp-${campaignId}-${taskId}`,
              campaign_id: campaignId,
              task_id: taskId,
              is_applicable: isApplicable,
              override_assignee: null,
              note: null,
              target_count: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } satisfies CampaignTaskConfig,
          ];
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.taskConfig.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskConfig.all });
    },
  });

  // Toggle global task is_applicable_default
  const updateTaskDefaultMutation = useMutation({
    mutationFn: async ({
      taskId,
      isApplicableDefault,
    }: {
      taskId: string;
      isApplicableDefault: boolean;
    }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ is_applicable_default: isApplicableDefault })
        .eq('id', taskId);
      if (error) throw error;
      logActivity({
        userId: profile?.id,
        actionType: 'update',
        targetTable: 'tasks',
        targetId: taskId,
        newValue: { is_applicable_default: isApplicableDefault },
      });
    },
    onMutate: async ({ taskId, isApplicableDefault }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks.all);
      queryClient.setQueryData(
        queryKeys.tasks.all,
        (old: Task[] | undefined) =>
          (old || []).map((t) =>
            t.id === taskId ? { ...t, is_applicable_default: isApplicableDefault } : t
          )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tasks.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });

  // Update target_count for a campaign-task config row
  const updateTargetCountMutation = useMutation({
    mutationFn: async ({
      campaignId,
      taskId,
      targetCount,
    }: {
      campaignId: string;
      taskId: string;
      targetCount: number | null;
    }) => {
      const { error } = await supabase
        .from('campaign_task_config')
        .upsert(
          {
            campaign_id: campaignId,
            task_id: taskId,
            is_applicable: configMap.get(`${campaignId}-${taskId}`) ?? true,
            target_count: targetCount,
          },
          { onConflict: 'campaign_id,task_id' }
        );
      if (error) throw error;
      logActivity({
        userId: profile?.id,
        actionType: 'upsert',
        targetTable: 'campaign_task_config',
        newValue: { campaign_id: campaignId, task_id: taskId, target_count: targetCount },
      });
    },
    onMutate: async ({ campaignId, taskId, targetCount }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.taskConfig.all });
      const previous = queryClient.getQueryData<CampaignTaskConfig[]>(
        queryKeys.taskConfig.all
      );
      queryClient.setQueryData(
        queryKeys.taskConfig.all,
        (old: CampaignTaskConfig[] | undefined) => {
          const list = old || [];
          const idx = list.findIndex(
            (c) => c.campaign_id === campaignId && c.task_id === taskId
          );
          if (idx >= 0) {
            const updated = [...list];
            updated[idx] = { ...updated[idx], target_count: targetCount };
            return updated;
          }
          return [
            ...list,
            {
              id: `temp-${campaignId}-${taskId}`,
              campaign_id: campaignId,
              task_id: taskId,
              is_applicable: true,
              override_assignee: null,
              note: null,
              target_count: targetCount,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } satisfies CampaignTaskConfig,
          ];
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.taskConfig.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskConfig.all });
    },
  });

  // ── Derived Data ──

  // Config lookup map
  const configMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const config of configs) {
      map.set(`${config.campaign_id}-${config.task_id}`, config.is_applicable);
    }
    return map;
  }, [configs]);

  // Split tasks into 3 groups (exclude sub-tasks from matrix columns)
  const { dailyWeeklyTasks, periodicTasks, globalTasks } = useMemo(() => {
    const dw = tasks.filter(
      (t) => !t.parent_task_id && t.scope !== 'global' && (t.frequency === 'daily' || t.frequency === 'weekly')
    );
    const p = tasks.filter(
      (t) => !t.parent_task_id && t.scope !== 'global' && t.frequency !== 'daily' && t.frequency !== 'weekly'
    );
    const g = tasks.filter((t) => t.scope === 'global');
    return { dailyWeeklyTasks: dw, periodicTasks: p, globalTasks: g };
  }, [tasks]);

  // Map parent_task_id → child tasks (sorted by sub_order)
  const childTaskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_task_id) {
        const children = map.get(t.parent_task_id) || [];
        children.push(t);
        map.set(t.parent_task_id, children);
      }
    }
    // Sort children by sub_order
    for (const [, children] of map) {
      children.sort((a, b) => a.sub_order - b.sub_order);
    }
    return map;
  }, [tasks]);

  // target_count lookup: campaignId-taskId → target_count
  const targetCountMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const config of configs) {
      map.set(`${config.campaign_id}-${config.task_id}`, config.target_count);
    }
    return map;
  }, [configs]);

  // Unique countries
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const c of campaigns) {
      if (c.target_country) set.add(c.target_country);
    }
    return Array.from(set).sort();
  }, [campaigns]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (countryFilter !== 'all') {
      result = result.filter((c) => c.target_country === countryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.campaign_name.toLowerCase().includes(q) ||
          c.client_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [campaigns, countryFilter, searchQuery]);

  // ── Handlers ──

  const handleToggle = useCallback(
    (campaignId: string, taskId: string, isApplicable: boolean) => {
      toggleMutation.mutate({ campaignId, taskId, isApplicable });
    },
    [toggleMutation]
  );

  const handleBulkToggleRow = useCallback(
    (campaignId: string, rowTasks: Task[], enable: boolean) => {
      for (const task of rowTasks) {
        toggleMutation.mutate({ campaignId, taskId: task.id, isApplicable: enable });
      }
    },
    [toggleMutation]
  );

  const handleBulkToggleColumn = useCallback(
    (taskId: string, colCampaigns: Campaign[], enable: boolean) => {
      for (const campaign of colCampaigns) {
        toggleMutation.mutate({ campaignId: campaign.id, taskId, isApplicable: enable });
      }
    },
    [toggleMutation]
  );

  const handleBulkToggleCategory = useCallback(
    (category: TaskCategory, catTasks: Task[], catCampaigns: Campaign[], enable: boolean) => {
      for (const campaign of catCampaigns) {
        for (const task of catTasks) {
          toggleMutation.mutate({ campaignId: campaign.id, taskId: task.id, isApplicable: enable });
        }
      }
    },
    [toggleMutation]
  );

  const handleUpdateTargetCount = useCallback(
    (campaignId: string, taskId: string, targetCount: number | null) => {
      updateTargetCountMutation.mutate({ campaignId, taskId, targetCount });
    },
    [updateTargetCountMutation]
  );

  const handleToggleGlobalDefault = useCallback(
    (taskId: string, isApplicableDefault: boolean) => {
      updateTaskDefaultMutation.mutate({ taskId, isApplicableDefault });
    },
    [updateTaskDefaultMutation]
  );

  // ── Auth guard ──

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto">
            <ToggleLeft className="size-5 text-orange-400" />
          </div>
          <p className="text-stone-500">관리자 권한이 필요해요.</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {/* Page Header */}
        <motion.div variants={fadeUpItem} className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-50">
            <ToggleLeft className="size-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">업무 적용, 캠페인별로 설정해줄게.</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              어떤 캠페인에 어떤 업무를 적용할지 세밀하게 조정해 보세요.
            </p>
          </div>
        </motion.div>

        {/* AI Agent Guide Banner */}
        <motion.div variants={fadeUpItem}>
          <div className="relative rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3.5 overflow-hidden">
            <div className="flex gap-3 items-start relative">
              <div className="relative shrink-0 mt-0.5">
                <div className="size-9 rounded-full bg-orange-500 flex items-center justify-center ring-2 ring-white">
                  <Bot className="size-4 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-amber-400 border-2 border-white" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold text-stone-800">어포메이션 본질 AI Agent</p>
                  <span className="text-[9px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">적용설정 가이드</span>
                </div>
                <div className="text-[11px] text-stone-500 leading-[1.7] space-y-1">
                  <p>안녕하세요! Task 적용설정 페이지에 오신 걸 환영해요.</p>
                  <div className="bg-white/70 rounded-xl px-3 py-2 space-y-0.5 border border-orange-100">
                    <p>행위 관리에서 등록한 업무가 <strong className="text-stone-700">어느 캠페인에 적용될지</strong>를 이 페이지에서 ON/OFF 해요.</p>
                    <p><strong className="text-stone-700">토글을 켜면</strong> 해당 캠페인의 일일 체크리스트에 업무가 나타나고, <strong className="text-stone-700">끄면</strong> 숨겨져요.</p>
                  </div>
                  <p className="text-[10px] text-stone-400">새 캠페인 추가 시 필요한 업무를 여기서 활성화하는 걸 잊지 마세요!</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters (only for campaign-scope tabs) */}
        <motion.div variants={fadeUpItem} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-stone-400" />
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue placeholder="국가 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 국가</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="캠페인 검색..."
            className="max-w-[200px] h-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Badge variant="secondary" className="text-xs ml-auto">
            {filteredCampaigns.length}개 캠페인
          </Badge>
        </motion.div>

        {/* Tabs */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-3 text-stone-400">
              <div className="size-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
              <span className="text-sm">데이터를 불러오는 중이에요...</span>
            </div>
          </div>
        ) : (
          <motion.div variants={fadeUpItem}>
            <Tabs defaultValue="daily-weekly">
              <TabsList className="bg-stone-100/60 p-1 rounded-full">
                <TabsTrigger value="daily-weekly" className="text-xs gap-1.5 rounded-full data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=inactive]:text-stone-500">
                  일일/주간 업무
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
                    {dailyWeeklyTasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="periodic" className="text-xs gap-1.5 rounded-full data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=inactive]:text-stone-500">
                  월간/주기별 업무
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
                    {periodicTasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="global" className="text-xs gap-1.5 rounded-full data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=inactive]:text-stone-500">
                  전역 업무
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
                    {globalTasks.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="daily-weekly">
                <TaskConfigMatrix
                  tasks={dailyWeeklyTasks}
                  campaigns={filteredCampaigns}
                  configMap={configMap}
                  allTasks={tasks}
                  onToggle={handleToggle}
                  onBulkToggleRow={handleBulkToggleRow}
                  onBulkToggleColumn={handleBulkToggleColumn}
                  onBulkToggleCategory={handleBulkToggleCategory}
                />
              </TabsContent>

              <TabsContent value="periodic">
                <TaskConfigMatrix
                  tasks={periodicTasks}
                  campaigns={filteredCampaigns}
                  configMap={configMap}
                  allTasks={tasks}
                  onToggle={handleToggle}
                  onBulkToggleRow={handleBulkToggleRow}
                  onBulkToggleColumn={handleBulkToggleColumn}
                  onBulkToggleCategory={handleBulkToggleCategory}
                  childTaskMap={childTaskMap}
                  targetCountMap={targetCountMap}
                  onUpdateTargetCount={handleUpdateTargetCount}
                />
              </TabsContent>

              <TabsContent value="global">
                <GlobalTasksList
                  tasks={globalTasks}
                  onToggleDefault={handleToggleGlobalDefault}
                />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
