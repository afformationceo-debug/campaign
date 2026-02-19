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

      {/* AI Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-r from-blue-50/80 via-sky-50/50 to-transparent dark:from-blue-950/30 dark:via-sky-950/20 dark:to-transparent px-4 py-3 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-100/40 to-transparent dark:from-blue-900/20 rounded-bl-full" />
          <div className="flex gap-3 items-start relative">
            <div className="size-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <Bot className="size-3.5 text-white" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-[12px] font-semibold text-blue-900 dark:text-blue-200">
                업무 유형 안내
              </p>
              <div className="text-[11px] text-blue-800/70 dark:text-blue-300/70 leading-[1.6] space-y-0.5">
                <p><strong className="text-violet-700 dark:text-violet-300">전역 업무</strong> — 캠페인 관계없이 발생할 때마다 처리하는 업무입니다. (담당자별로 배정됩니다)</p>
                <p><strong className="text-blue-700 dark:text-blue-300">일일 캠페인별 업무</strong> — 매일 각 캠페인마다 체크해야 하는 업무입니다.</p>
                <p><strong className="text-amber-700 dark:text-amber-300">월간/주기별 업무</strong> — 월마다 한 번씩 생성되는 업무이며, 해당 월에 완료하면 됩니다.</p>
                <p><strong className="text-rose-700 dark:text-rose-300">1회성 업무</strong> — 한 번만 수행하면 완료되는 업무입니다.</p>
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
        />
      </motion.div>

      {/* Periodic Tasks (monthly/once/as_needed) */}
      <motion.div variants={fadeUpItem}>
        <PeriodicTasksSection date={date} userId={assigneeId ?? undefined} />
      </motion.div>
    </motion.div>
  );
}
