'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { CheckCircle2, Clock, Circle, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
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
} from '@/lib/types/database';

interface PeriodicTasksSectionProps {
  date: string;
  userId?: string;
  /** If provided, only show tasks for this specific campaign */
  campaignId?: string;
}

const FREQ_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  monthly: { label: '월간', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  once: { label: '1회성', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  as_needed: { label: '수시', color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-950/30' },
};

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
      // Create new check as '완료' (user is marking it done)
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '완료',
      });
      return;
    }
    // Toggle: 완료 → 미완료 → 진행중 → 완료
    const cycle: CheckStatus[] = ['완료', '미완료', '진행중'];
    const currentIdx = cycle.indexOf(check.status);
    const nextStatus = cycle[(currentIdx + 1) % cycle.length];
    updateStatus({ id: check.id, status: nextStatus });
  };

  if (!check) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-dashed border-muted-foreground/20 text-muted-foreground/30 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer hover:scale-110"
          >
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
        <button
          type="button"
          onClick={handleClick}
          className={cn('flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer hover:scale-110', cfg.bg, cfg.color)}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top"><p className="text-xs">{cfg.label} (클릭하여 변경)</p></TooltipContent>
    </Tooltip>
  );
}

export function PeriodicTasksSection({ date, userId, campaignId }: PeriodicTasksSectionProps) {
  const supabase = createClient();
  const { profile } = useAuth();
  const effectiveUserId = userId ?? profile?.id ?? '';
  const [expanded, setExpanded] = useState(true);

  // Current month range
  const currentDate = parseISO(date);
  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');
  const yearMonth = format(currentDate, 'yyyy-MM');

  // Fetch all tasks
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('loop_order');
      if (error) throw error;
      return data as Task[];
    },
  });

  // Fetch active campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.active,
    queryFn: async () => {
      const { data, error } = await supabase.from('campaigns').select('*').eq('status', 'active').order('campaign_name');
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // Fetch task configs
  const { data: taskConfigs = [] } = useQuery({
    queryKey: queryKeys.taskConfig.all,
    queryFn: () => fetchAll<CampaignTaskConfig>(supabase, 'campaign_task_config'),
  });

  // Fetch checks for this month (for periodic tasks only)
  const { data: monthlyChecks = [] } = useQuery({
    queryKey: effectiveUserId
      ? queryKeys.checks.byMonthAndUser(yearMonth, effectiveUserId)
      : queryKeys.checks.byMonth(yearMonth),
    queryFn: async () => {
      let query = supabase
        .from('daily_checks')
        .select('*')
        .gte('check_date', monthStart)
        .lte('check_date', monthEnd);
      if (effectiveUserId) {
        query = query.eq('assigned_user_id', effectiveUserId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
    enabled: !!effectiveUserId,
  });

  // Filter to only periodic tasks (monthly, once, as_needed)
  const periodicTasks = useMemo(() => {
    return tasks.filter((t) => t.frequency === 'monthly' || t.frequency === 'once' || t.frequency === 'as_needed');
  }, [tasks]);

  // Config map
  const configMap = useMemo(() => {
    const map = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((c) => map.set(`${c.campaign_id}:${c.task_id}`, c));
    return map;
  }, [taskConfigs]);

  // Check map: campaign_id:task_id -> latest check this month
  const checkMap = useMemo(() => {
    const map = new Map<string, DailyCheck>();
    // Filter to only periodic task checks
    const periodicTaskIds = new Set(periodicTasks.map((t) => t.id));
    monthlyChecks
      .filter((c) => periodicTaskIds.has(c.task_id))
      .sort((a, b) => a.check_date.localeCompare(b.check_date))
      .forEach((check) => {
        // Keep the latest check for each campaign:task combo
        map.set(`${check.campaign_id}:${check.task_id}`, check);
      });
    return map;
  }, [monthlyChecks, periodicTasks]);

  // Build display data: task × campaign combinations
  const displayData = useMemo(() => {
    const rows: {
      task: Task;
      campaign: Campaign;
      check: DailyCheck | null;
      isApplicable: boolean;
    }[] = [];

    const targetCampaigns = campaignId
      ? campaigns.filter((c) => c.id === campaignId)
      : campaigns;

    for (const task of periodicTasks) {
      // Campaign-scope tasks
      if (task.scope !== 'global') {
        for (const campaign of targetCampaigns) {
          const config = configMap.get(`${campaign.id}:${task.id}`);
          const applicable = config ? config.is_applicable : task.is_applicable_default;
          if (!applicable) continue;

          const check = checkMap.get(`${campaign.id}:${task.id}`) ?? null;
          rows.push({ task, campaign, check, isApplicable: true });
        }
      }
    }

    return rows;
  }, [periodicTasks, campaigns, campaignId, configMap, checkMap]);

  // Count stats
  const totalItems = displayData.length;
  const completedItems = displayData.filter((r) => r.check?.status === '완료').length;

  if (periodicTasks.length === 0 || totalItems === 0) return null;

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
            {completedItems}/{totalItems} 완료
          </Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(currentDate, 'yyyy년 MM월')} 기준
          </span>
        </button>

        {/* Body */}
        {expanded && (
          <div className="border-t">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2 text-[11px] font-semibold text-muted-foreground w-[100px]">빈도</th>
                    <th className="px-4 py-2 text-[11px] font-semibold text-muted-foreground">업무</th>
                    <th className="px-4 py-2 text-[11px] font-semibold text-muted-foreground">카테고리</th>
                    <th className="px-4 py-2 text-[11px] font-semibold text-muted-foreground">캠페인</th>
                    <th className="px-4 py-2 text-[11px] font-semibold text-muted-foreground text-center w-[60px]">상태</th>
                    <th className="px-4 py-2 text-[11px] font-semibold text-muted-foreground w-[90px]">완료일</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((row) => {
                    const freqCfg = FREQ_LABELS[row.task.frequency] ?? FREQ_LABELS.monthly;
                    const catColor = CATEGORY_COLORS[row.task.category as TaskCategory];
                    return (
                      <tr
                        key={`${row.campaign.id}:${row.task.id}`}
                        className={cn(
                          'border-b border-border/40 hover:bg-accent/20 transition-colors',
                          row.check?.status === '완료' && 'bg-emerald-50/30 dark:bg-emerald-950/10'
                        )}
                      >
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', freqCfg.color, freqCfg.bg)}>
                            {freqCfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-[12px] font-medium">{row.task.task_name}</span>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', catColor?.text ?? '', catColor?.bg ?? '')}>
                            {row.task.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-[11px] text-muted-foreground">{row.campaign.campaign_name}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center">
                            <PeriodicStatusButton
                              check={row.check}
                              campaignId={row.campaign.id}
                              taskId={row.task.id}
                              date={date}
                              assigneeId={effectiveUserId}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {row.check?.status === '완료' ? (
                            <span className="text-[10px] text-emerald-600 font-medium tabular-nums">
                              {row.check.check_date}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">-</span>
                          )}
                        </td>
                      </tr>
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
