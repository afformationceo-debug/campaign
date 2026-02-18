'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type {
  Task,
  DailyCheck,
  User,
} from '@/lib/types/database';

export default function ResultsViewPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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

  // User map for resolving names
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

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

  // Task map for resolving names
  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Fetch checks with result_value for the date (+ optional user filter)
  const { data: checks = [], isLoading } = useQuery({
    queryKey: selectedUserId
      ? queryKeys.checks.resultsByDateAndUser(date, selectedUserId)
      : queryKeys.checks.resultsByDate(date),
    queryFn: async () => {
      let query = supabase
        .from('daily_checks')
        .select('*')
        .eq('check_date', date)
        .not('result_value', 'is', null);
      if (selectedUserId) {
        query = query.eq('assigned_user_id', selectedUserId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
  });

  // Flat list: sorted by task loop_order
  const resultRows = useMemo(() => {
    return checks
      .filter((c) => c.result_value)
      .map((c) => ({
        id: c.id,
        date: c.check_date,
        taskName: taskMap.get(c.task_id)?.task_name ?? c.task_id,
        loopOrder: taskMap.get(c.task_id)?.loop_order ?? 999,
        assignee: (c.assigned_user_id ? userMap.get(c.assigned_user_id) : null) ?? c.assigned_user_id ?? '-',
        resultValue: c.result_value!,
      }))
      .sort((a, b) => a.loopOrder - b.loopOrder);
  }, [checks, taskMap, userMap]);

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
            결과 {resultRows.length}건
          </Badge>
        </div>
      </motion.div>

      {/* Results Table */}
      <motion.div variants={fadeUpItem}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
              <span className="text-sm">데이터를 불러오는 중...</span>
            </div>
          </div>
        ) : resultRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <FileText className="size-8 opacity-30" />
            <span className="text-sm">입력된 결과값이 없습니다.</span>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[12%]">날짜</th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[28%]">업무</th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[12%]">담당자</th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">결과값</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors h-8">
                    <td className="px-3 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className="px-3 py-0.5 text-[12px] font-medium truncate">{row.taskName}</td>
                    <td className="px-3 py-0.5 text-[11px] text-muted-foreground truncate">{row.assignee}</td>
                    <td className="px-3 py-0.5 text-[12px] text-foreground truncate">{row.resultValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
