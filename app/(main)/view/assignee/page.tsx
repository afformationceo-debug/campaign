'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { FilterBar } from '@/components/views/filter-bar';
import { AssigneeGrid } from '@/components/views/assignee-grid';
import { PeriodicTasksSection } from '@/components/views/periodic-tasks-section';
import { fetchAll } from '@/lib/supabase/fetch-all';
import type { User, TaskCategory, Task, Campaign, DailyCheck, CampaignTaskConfig } from '@/lib/types/database';

export default function AssigneeViewPage() {
  const supabase = createClient();

  const [date, setDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  // Initialize date on client only to avoid SSR/CSR hydration mismatch
  useEffect(() => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);
  const [selectedCategories, setSelectedCategories] = useState<TaskCategory[]>(
    () => [...CATEGORY_ORDER]
  );

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
    enabled: !!date,
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
    // Campaign-scope: daily/weekly only
    const campaignDailyTasks = tasks.filter(
      (t) => !t.parent_task_id && t.scope !== 'global' && (t.frequency === 'daily' || t.frequency === 'weekly')
    );
    // Global-scope: ALL frequencies (same as assignee grid)
    const globalAllTasks = tasks.filter(
      (t) => !t.parent_task_id && t.scope === 'global'
    );

    const configMap = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((c) => configMap.set(`${c.campaign_id}:${c.task_id}`, c));

    const checkMap = new Map<string, DailyCheck>();
    checks.forEach((c) => {
      if (c.campaign_id) {
        checkMap.set(`${c.campaign_id}:${c.task_id}`, c);
      } else {
        checkMap.set(`null:${c.task_id}:${c.assigned_user_id}`, c);
      }
    });

    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let incomplete = 0;

    // 1) Campaign-scope tasks
    for (const campaign of campaigns) {
      for (const task of campaignDailyTasks) {
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

    // 2) Global-scope tasks (per-assignee, all frequencies)
    const globalTasks = globalAllTasks;
    for (const task of globalTasks) {
      const assigneeNames = task.default_assignees?.length ? task.default_assignees : [];
      if (assigneeNames.length === 0) continue;

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

  if (!date) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
          <span className="text-sm">로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-2"
    >
      {/* Compact Header + KPI Inline */}
      <motion.div variants={fadeUpItem}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tight">담당자별 업무</h1>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60 border border-border rounded px-1.5 py-0.5 font-medium">전역</span>
              <span className="text-[10px] text-muted-foreground/60 border border-border rounded px-1.5 py-0.5 font-medium">캠페인별</span>
              <span className="text-[10px] text-muted-foreground/60 border border-border rounded px-1.5 py-0.5 font-medium">월간/주기</span>
              <span className="text-[10px] text-muted-foreground/60 border border-border rounded px-1.5 py-0.5 font-medium">단계보기</span>
            </div>
          </div>
          {kpiStats.total > 0 && (
            <div className="flex items-center gap-3 text-[11px] tabular-nums">
              <span className="text-muted-foreground font-medium">
                전체 <span className="text-foreground font-black">{kpiStats.total}</span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="size-3 text-emerald-500" />
                <span className="font-bold text-foreground">{kpiStats.completed}</span>
                <span className="text-[10px]">({kpiStats.pct}%)</span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                <span className="font-bold text-foreground">{kpiStats.inProgress}</span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Circle className="size-3" />
                <span className="font-bold text-foreground">{kpiStats.incomplete}</span>
              </span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-1">
          담당자별 일일 업무 현황을 확인합니다. 전역 업무, 캠페인별 업무, 월간/주기별 업무를 날짜 기준으로 조회하고, 각 행위의 단계(Step)를 확인할 수 있습니다.
        </p>
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
