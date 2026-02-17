'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Filter, ToggleLeft, Columns3, Rows3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useRealtimeTaskConfig } from '@/hooks/use-realtime-task-config';
import { useAuth } from '@/hooks/use-auth';
import { logActivity } from '@/lib/utils/log-activity';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Campaign,
  Task,
  CampaignTaskConfig,
  TaskCategory,
} from '@/lib/types/database';

export default function TaskConfigPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();

  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useRealtimeTaskConfig();

  // Fetch campaigns
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

  // Fetch tasks
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

  // Fetch all task configs (paginated to bypass PostgREST 1000 row limit)
  const { data: configs = [], isLoading } = useQuery({
    queryKey: queryKeys.taskConfig.all,
    queryFn: () => fetchAll<CampaignTaskConfig>(supabase, 'campaign_task_config'),
  });

  // Toggle single cell mutation (upsert to avoid stale closure / unique constraint issues)
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

  // Bulk toggle: entire row (campaign)
  const bulkToggleRow = useCallback(
    (campaignId: string, enable: boolean) => {
      for (const task of tasks) {
        toggleMutation.mutate({
          campaignId,
          taskId: task.id,
          isApplicable: enable,
        });
      }
    },
    [tasks, toggleMutation]
  );

  // Bulk toggle: entire column (task)
  const bulkToggleColumn = useCallback(
    (taskId: string, enable: boolean) => {
      const filtered = filteredCampaigns;
      for (const campaign of filtered) {
        toggleMutation.mutate({
          campaignId: campaign.id,
          taskId,
          isApplicable: enable,
        });
      }
    },
    [toggleMutation]
  );

  // Bulk toggle: entire category
  const bulkToggleCategory = useCallback(
    (category: TaskCategory, enable: boolean) => {
      const catTasks = tasks.filter((t) => t.category === category);
      const filtered = filteredCampaigns;
      for (const campaign of filtered) {
        for (const task of catTasks) {
          toggleMutation.mutate({
            campaignId: campaign.id,
            taskId: task.id,
            isApplicable: enable,
          });
        }
      }
    },
    [tasks, toggleMutation]
  );

  // Build config lookup map (key -> is_applicable)
  const configMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const config of configs) {
      map.set(`${config.campaign_id}-${config.task_id}`, config.is_applicable);
    }
    return map;
  }, [configs]);

  // Helper: get effective is_applicable (respects task default when no config exists)
  const getIsApplicable = useCallback(
    (campaignId: string, taskId: string): boolean => {
      const key = `${campaignId}-${taskId}`;
      const configVal = configMap.get(key);
      if (configVal !== undefined) return configVal;
      const task = tasks.find((t) => t.id === taskId);
      return task?.is_applicable_default ?? true;
    },
    [configMap, tasks]
  );

  // Group tasks by category
  const tasksByCategory = useMemo(() => {
    const grouped: { category: TaskCategory; tasks: Task[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const catTasks = tasks.filter((t) => t.category === cat);
      if (catTasks.length > 0) {
        grouped.push({ category: cat, tasks: catTasks });
      }
    }
    return grouped;
  }, [tasks]);

  // Get unique countries
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const c of campaigns) {
      if (c.target_country) set.add(c.target_country);
    }
    return Array.from(set).sort();
  }, [campaigns]);

  // Filter campaigns
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

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Task 적용설정</h1>
        <p className="text-muted-foreground text-sm">
          캠페인별 업무 적용 여부를 설정합니다. ({filteredCampaigns.length}개 캠페인 x {tasks.length}개 업무)
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
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

        {/* Bulk category toggles */}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {CATEGORY_ORDER.map((cat) => {
            const color = CATEGORY_COLORS[cat];
            return (
              <div key={cat} className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      className={`${color.bg} ${color.text} ${color.darkBg}`}
                      onClick={() => bulkToggleCategory(cat, true)}
                    >
                      {cat}
                      <ToggleLeft className="h-3 w-3 ml-0.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{cat} 전체 ON</TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>

      {/* Matrix */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          로딩 중...
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[calc(100vh-280px)]">
          <table className="text-xs">
            <thead className="sticky top-0 z-20 bg-background">
              {/* Category header row */}
              <tr className="border-b">
                <th
                  className="sticky left-0 z-30 bg-background border-r p-1 min-w-[180px]"
                  rowSpan={2}
                >
                  <span className="text-muted-foreground font-medium">캠페인</span>
                </th>
                {tasksByCategory.map(({ category, tasks: catTasks }) => {
                  const color = CATEGORY_COLORS[category];
                  return (
                    <th
                      key={category}
                      colSpan={catTasks.length}
                      className={cn(
                        'p-1 text-center border-r border-b-0 font-medium',
                        color.bg,
                        color.text,
                        color.darkBg
                      )}
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
              <tr className="border-b">
                {tasksByCategory.map(({ tasks: catTasks, category }) =>
                  catTasks.map((task, idx) => (
                    <th
                      key={task.id}
                      className={cn(
                        'p-0.5 border-r min-w-[36px] max-w-[36px] bg-muted/30',
                        idx === catTasks.length - 1 && 'border-r-2'
                      )}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="writing-mode-vertical h-[80px] flex items-end justify-center cursor-pointer text-[10px] leading-tight overflow-hidden px-0.5"
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                            onClick={() => {
                              const allOn = filteredCampaigns.every(
                                (c) => getIsApplicable(c.id, task.id)
                              );
                              bulkToggleColumn(task.id, !allOn);
                            }}
                          >
                            {task.task_name}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="font-medium">{task.task_name}</p>
                          <p className="text-[10px] text-muted-foreground">클릭하여 전체 토글</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-background border-r p-1.5 min-w-[180px] max-w-[180px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="shrink-0 opacity-50 hover:opacity-100"
                            onClick={() => {
                              const allOn = tasks.every(
                                (t) => getIsApplicable(campaign.id, t.id)
                              );
                              bulkToggleRow(campaign.id, !allOn);
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
                        <p className="text-[10px] text-muted-foreground">행 토글 버튼으로 전체 ON/OFF</p>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  {tasksByCategory.map(({ tasks: catTasks, category }) =>
                    catTasks.map((task, idx) => {
                      const isApplicable = getIsApplicable(campaign.id, task.id);
                      return (
                        <td
                          key={task.id}
                          className={cn(
                            'p-0 text-center border-r',
                            idx === catTasks.length - 1 && 'border-r-2',
                            isApplicable && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          )}
                        >
                          <div className="flex items-center justify-center h-8">
                            <Switch
                              size="sm"
                              checked={isApplicable}
                              onCheckedChange={(checked) => {
                                toggleMutation.mutate({
                                  campaignId: campaign.id,
                                  taskId: task.id,
                                  isApplicable: checked,
                                });
                              }}
                            />
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
      )}
    </div>
  );
}
