'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { Bot } from 'lucide-react';
import { FilterBar } from '@/components/views/filter-bar';
import { AssigneeGrid } from '@/components/views/assignee-grid';
import { PeriodicTasksSection } from '@/components/views/periodic-tasks-section';
import type { User, TaskCategory } from '@/lib/types/database';

export default function AssigneeViewPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
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

      {/* AI Agent Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-r from-blue-50/80 via-sky-50/50 to-transparent dark:from-blue-950/30 dark:via-sky-950/20 dark:to-transparent px-4 py-3.5 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/30 to-transparent dark:from-blue-900/15 rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-sky-100/20 to-transparent dark:from-sky-900/10 rounded-tr-full" />
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
