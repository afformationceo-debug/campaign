'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { Bot, ChevronDown, ChevronUp, CheckCircle2, Clock, Circle, AlertCircle, ListChecks } from 'lucide-react';
import { FilterBar } from '@/components/views/filter-bar';
import { AssigneeGrid } from '@/components/views/assignee-grid';
import { PeriodicTasksSection } from '@/components/views/periodic-tasks-section';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fetchAll } from '@/lib/supabase/fetch-all';
import type { User, TaskCategory, Task, Campaign, DailyCheck, CampaignTaskConfig } from '@/lib/types/database';

const BANNER_STORAGE_KEY = 'assignee-banner-collapsed';

export default function AssigneeViewPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<TaskCategory[]>(
    () => [...CATEGORY_ORDER]
  );
  const [bannerCollapsed, setBannerCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(BANNER_STORAGE_KEY) === 'true';
  });

  // Persist banner state
  useEffect(() => {
    localStorage.setItem(BANNER_STORAGE_KEY, String(bannerCollapsed));
  }, [bannerCollapsed]);

  // Fetch active users
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as User[];
    },
  });

  // ─── KPI Data (shared cache with AssigneeGrid) ───
  const { data: checks = [] } = useQuery({
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

  const { data: tasks = [] } = useQuery({
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

  const { data: campaigns = [] } = useQuery({
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

  const { data: taskConfigs = [] } = useQuery({
    queryKey: queryKeys.taskConfig.all,
    queryFn: () => fetchAll<CampaignTaskConfig>(supabase, 'campaign_task_config'),
  });

  // ─── KPI Computation (전역 + 캠페인별 업무 모두 포함) ───
  const kpiStats = useMemo(() => {
    const dailyTasks = tasks.filter(
      (t) => !t.parent_task_id && (t.frequency === 'daily' || t.frequency === 'weekly')
    );

    const configMap = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((c) => configMap.set(`${c.campaign_id}:${c.task_id}`, c));

    const checkMap = new Map<string, DailyCheck>();
    checks.forEach((c) => {
      if (c.campaign_id) {
        checkMap.set(`${c.campaign_id}:${c.task_id}`, c);
      } else {
        // Global-scope: keyed by task_id + assigned_user_id
        checkMap.set(`null:${c.task_id}:${c.assigned_user_id}`, c);
      }
    });

    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let incomplete = 0;

    // 1) Campaign-scope tasks
    const campaignTasks = dailyTasks.filter((t) => t.scope !== 'global');
    for (const campaign of campaigns) {
      for (const task of campaignTasks) {
        const config = configMap.get(`${campaign.id}:${task.id}`);
        const applicable = config ? config.is_applicable : task.is_applicable_default;
        if (!applicable) continue;

        total++;
        const check = checkMap.get(`${campaign.id}:${task.id}`);
        if (check?.status === '완료' || check?.status === '해당없음') {
          completed++;
        } else if (check?.status === '진행중') {
          inProgress++;
        } else {
          incomplete++;
        }
      }
    }

    // 2) Global-scope tasks (per-assignee)
    const globalTasks = dailyTasks.filter((t) => t.scope === 'global');
    for (const task of globalTasks) {
      const assigneeNames = task.default_assignees?.length ? task.default_assignees : [];
      if (assigneeNames.length === 0) continue; // skip unassigned global tasks

      for (const name of assigneeNames) {
        const userId = users.find((u) => u.name === name.trim())?.id;
        if (!userId) continue;

        total++;
        const check = checkMap.get(`null:${task.id}:${userId}`);
        if (check?.status === '완료' || check?.status === '해당없음') {
          completed++;
        } else if (check?.status === '진행중') {
          inProgress++;
        } else {
          incomplete++;
        }
      }
    }

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, incomplete, pct };
  }, [tasks, campaigns, checks, taskConfigs, users]);

  // Memoize categories for FilterBar
  const allCategories = useMemo(() => [...CATEGORY_ORDER], []);

  // Resolve selected user's name for task filtering
  const assigneeName = useMemo(() => {
    if (!assigneeId) return null;
    return users.find((u) => u.id === assigneeId)?.name ?? null;
  }, [assigneeId, users]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      {/* Page Header */}
      <motion.div variants={fadeUpItem}>
        <h1 className="text-xl font-bold tracking-tight">
          담당자별 일일 체크
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          담당자가 맡은 캠페인의 업무 진행 상황을 한눈에 확인하고 체크할 수 있습니다.
        </p>
      </motion.div>

      {/* AI Agent Guide Banner - Collapsible */}
      <motion.div variants={fadeUpItem}>
        <AnimatePresence mode="wait">
          {bannerCollapsed ? (
            <motion.button
              key="collapsed"
              type="button"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setBannerCollapsed(false)}
              className="w-full flex items-center gap-2 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
            >
              <div className="size-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="size-2.5 text-white" />
              </div>
              <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">업무 유형 가이드 보기</span>
              <ChevronDown className="size-3 text-blue-500/60 ml-auto" />
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="relative rounded-xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-r from-blue-50/80 via-sky-50/50 to-transparent dark:from-blue-950/30 dark:via-sky-950/20 dark:to-transparent px-4 py-3.5 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/30 to-transparent dark:from-blue-900/15 rounded-bl-full" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-sky-100/20 to-transparent dark:from-sky-900/10 rounded-tr-full" />
                <button
                  type="button"
                  onClick={() => setBannerCollapsed(true)}
                  className="absolute top-2 right-2 z-10 p-1 rounded-md hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors"
                  aria-label="접기"
                >
                  <ChevronUp className="size-4 text-blue-500/60" />
                </button>
                <div className="flex gap-3 items-start relative">
                  <div className="relative shrink-0 mt-0.5">
                    <div className="size-9 rounded-full bg-gradient-to-br from-blue-500 via-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200/50 dark:shadow-blue-900/30 ring-2 ring-white/80 dark:ring-white/10">
                      <Bot className="size-4 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-bold text-blue-900 dark:text-blue-200">
                        어포메이션 본질 AI Agent
                      </p>
                      <span className="text-[9px] font-medium text-blue-500/60 dark:text-blue-400/50 bg-blue-100/60 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">업무 가이드</span>
                    </div>
                    <div className="text-[11px] text-blue-800/80 dark:text-blue-300/70 leading-[1.7] space-y-1">
                      <p>안녕하세요, 어포메이션 임직원 여러분! 업무 유형별 안내를 드립니다. 잘 숙지해 주세요!</p>
                      <div className="bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2 space-y-0.5 border border-blue-100/50 dark:border-blue-800/20">
                        <p><strong className="text-violet-700 dark:text-violet-300">전역 업무</strong> — 캠페인과 관계없이, 발생할 때마다 처리하는 업무입니다. (담당자별로 배정됩니다)</p>
                        <p><strong className="text-blue-700 dark:text-blue-300">일일 캠페인별 업무</strong> — 매일 각 캠페인마다 반드시 체크해야 하는 업무입니다.</p>
                        <p><strong className="text-amber-700 dark:text-amber-300">월간/주기별 업무</strong> — 매월 한 번씩 생성되며, 해당 월 내에 완료하면 됩니다.</p>
                        <p><strong className="text-rose-700 dark:text-rose-300">1회성 업무</strong> — 딱 한 번만 수행하면 완료되는 업무입니다.</p>
                      </div>
                      <p className="text-[10px] text-blue-600/60 dark:text-blue-400/40">각 업무 유형을 잘 이해하시고, 빠짐없이 체크해 주세요!</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={fadeUpItem}>
        <FilterBar
          date={date}
          onDateChange={setDate}
          users={users}
          selectedUserId={assigneeId}
          onUserChange={setAssigneeId}
          categories={allCategories}
          selectedCategories={selectedCategories}
          onCategoryChange={setSelectedCategories}
        />
      </motion.div>

      {/* KPI Summary Cards */}
      {kpiStats.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid grid-cols-4 gap-2">
            <Card className="px-3 py-2 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/20 border-slate-200/60 dark:border-slate-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="size-3.5 text-slate-500" />
                  <span className="text-[10px] font-medium text-muted-foreground">전체 업무</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold tabular-nums">{kpiStats.total}</span>
                  <span className="text-[10px] text-muted-foreground">건</span>
                </div>
              </div>
              <Progress value={kpiStats.pct} className="h-1 mt-1.5" />
              <p className="text-[10px] font-semibold text-right mt-0.5 tabular-nums text-slate-600 dark:text-slate-400">완료율 {kpiStats.pct}%</p>
            </Card>
            <Card className="px-3 py-2 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-emerald-950/10 border-emerald-200/60 dark:border-emerald-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">완료</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{kpiStats.completed}</span>
                  <span className="text-[10px] text-emerald-600/60">건</span>
                </div>
              </div>
              <p className="text-[10px] text-right mt-1 tabular-nums text-emerald-600/80 dark:text-emerald-400/80">{kpiStats.total > 0 ? Math.round((kpiStats.completed / kpiStats.total) * 100) : 0}%</p>
            </Card>
            <Card className="px-3 py-2 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-blue-950/10 border-blue-200/60 dark:border-blue-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-blue-500" />
                  <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400">진행중</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-blue-700 dark:text-blue-300 tabular-nums">{kpiStats.inProgress}</span>
                  <span className="text-[10px] text-blue-600/60">건</span>
                </div>
              </div>
              <p className="text-[10px] text-right mt-1 tabular-nums text-blue-600/80 dark:text-blue-400/80">{kpiStats.total > 0 ? Math.round((kpiStats.inProgress / kpiStats.total) * 100) : 0}%</p>
            </Card>
            <Card className="px-3 py-2 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/30 dark:to-gray-900/10 border-gray-200/60 dark:border-gray-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Circle className="size-3.5 text-gray-400" />
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">미완료</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-gray-700 dark:text-gray-300 tabular-nums">{kpiStats.incomplete}</span>
                  <span className="text-[10px] text-gray-500/60">건</span>
                </div>
              </div>
              <p className="text-[10px] text-right mt-1 tabular-nums text-gray-500/80 dark:text-gray-400/80">{kpiStats.total > 0 ? Math.round((kpiStats.incomplete / kpiStats.total) * 100) : 0}%</p>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Grid */}
      <motion.div variants={fadeUpItem}>
        <AssigneeGrid
          date={date}
          assigneeId={assigneeId}
          assigneeName={assigneeName}
          categories={selectedCategories}
          users={users}
        />
      </motion.div>

      {/* Periodic Tasks (monthly/once/as_needed) */}
      <motion.div variants={fadeUpItem}>
        <PeriodicTasksSection date={date} userId={assigneeId ?? undefined} />
      </motion.div>
    </motion.div>
  );
}
