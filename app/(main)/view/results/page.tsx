'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type {
  Task,
  DailyCheck,
  User,
  TaskCategory,
} from '@/lib/types/database';

export default function ResultsViewPage() {
  const { profile, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Set default to current user
  const [defaultSet, setDefaultSet] = useState(false);
  if (!defaultSet && profile && !authLoading) {
    setSelectedUserId(profile.id);
    setDefaultSet(true);
  }

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as User[];
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

  const effectiveUserId = selectedUserId ?? profile?.id ?? '';

  // Fetch checks with result_value for the date + user
  const { data: checks = [], isLoading } = useQuery({
    queryKey: selectedUserId
      ? queryKeys.checks.resultsByDateAndUser(date, effectiveUserId)
      : queryKeys.checks.resultsByDate(date),
    queryFn: async () => {
      let query = supabase
        .from('daily_checks')
        .select('*')
        .eq('check_date', date)
        .not('result_value', 'is', null);
      if (selectedUserId) {
        query = query.eq('assigned_user_id', effectiveUserId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
    enabled: !!effectiveUserId || !selectedUserId,
  });

  // Group results by task category -> task
  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const groupedResults = useMemo(() => {
    const groups: { category: TaskCategory; items: { task: Task; checks: DailyCheck[] }[] }[] = [];

    for (const category of CATEGORY_ORDER) {
      const catItems: { task: Task; checks: DailyCheck[] }[] = [];

      // Find all tasks in this category that have result values
      const catTaskIds = new Set(
        tasks.filter((t) => t.category === category).map((t) => t.id)
      );

      const catChecks = checks.filter((c) => catTaskIds.has(c.task_id) && c.result_value);

      // Group by task
      const byTask = new Map<string, DailyCheck[]>();
      catChecks.forEach((c) => {
        const arr = byTask.get(c.task_id) || [];
        arr.push(c);
        byTask.set(c.task_id, arr);
      });

      byTask.forEach((taskChecks, taskId) => {
        const task = taskMap.get(taskId);
        if (task) catItems.push({ task, checks: taskChecks });
      });

      // Sort by loop_order
      catItems.sort((a, b) => a.task.loop_order - b.task.loop_order);

      if (catItems.length > 0) {
        groups.push({ category, items: catItems });
      }
    }

    // Also handle global tasks (scope = 'global')
    const globalChecks = checks.filter((c) => {
      const task = taskMap.get(c.task_id);
      return task?.scope === 'global' && c.result_value;
    });

    if (globalChecks.length > 0) {
      const byTask = new Map<string, DailyCheck[]>();
      globalChecks.forEach((c) => {
        const arr = byTask.get(c.task_id) || [];
        arr.push(c);
        byTask.set(c.task_id, arr);
      });

      const globalItems: { task: Task; checks: DailyCheck[] }[] = [];
      byTask.forEach((taskChecks, taskId) => {
        const task = taskMap.get(taskId);
        if (task) globalItems.push({ task, checks: taskChecks });
      });

      if (globalItems.length > 0) {
        // Prepend global as a pseudo-category entry
        groups.unshift({
          category: '전역' as TaskCategory,
          items: globalItems,
        });
      }
    }

    return groups;
  }, [checks, tasks, taskMap]);

  const totalResults = checks.filter((c) => c.result_value).length;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={fadeUpItem}>
        <h1 className="text-xl font-bold tracking-tight">일일 결과값</h1>
        <p className="text-sm text-muted-foreground mt-1">
          담당자가 입력한 업무별 결과값을 한눈에 확인할 수 있습니다.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUpItem}>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[160px] h-8 text-sm"
          />
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="h-8 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">전체 담당자</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <Badge variant="secondary" className="text-xs">
            결과 {totalResults}건
          </Badge>
        </div>
      </motion.div>

      {/* Results */}
      <motion.div variants={fadeUpItem}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
              <span className="text-sm">데이터를 불러오는 중...</span>
            </div>
          </div>
        ) : groupedResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <FileText className="size-8 opacity-30" />
            <span className="text-sm">입력된 결과값이 없습니다.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedResults.map((group) => {
              const catColor = CATEGORY_COLORS[group.category as TaskCategory];
              return (
                <div key={group.category} className="rounded-lg border bg-card overflow-hidden">
                  <div className={cn(
                    'px-3 py-1.5 border-b text-xs font-semibold',
                    catColor?.bg ?? 'bg-muted/50',
                    catColor?.text ?? 'text-foreground',
                  )}>
                    {group.category}
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[200px]">업무</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground">결과값</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(({ task, checks: taskChecks }) => (
                        <tr key={task.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5 align-top">
                            <span className="text-[12px] font-medium">{task.task_name}</span>
                            {task.default_assignees && task.default_assignees.length > 0 && (
                              <span className="text-[9px] text-muted-foreground/70 ml-1.5">
                                {task.default_assignees.join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {taskChecks.length === 1 ? (
                              <span className="text-[12px] text-foreground">{taskChecks[0].result_value}</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {taskChecks.map((c) => (
                                  <li key={c.id} className="text-[12px] text-foreground">
                                    {c.result_value}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
