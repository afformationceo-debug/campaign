'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { FileText, CalendarDays, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { CATEGORY_COLORS } from '@/lib/utils/category-colors';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type {
  Task,
  Campaign,
  DailyCheck,
  User,
  TaskCategory,
} from '@/lib/types/database';

const FREQUENCY_LABEL: Record<string, string> = {
  daily: '일일',
  weekly: '주간',
  monthly: '월간',
  once: '1회',
  as_needed: '수시',
};

/* ── Result row for rendering ──────────── */
interface ResultRow {
  id: string;
  date: string;
  taskName: string;
  taskCategory: TaskCategory | string;
  frequency: string;
  loopOrder: number;
  assignee: string;
  campaignName: string | null;
  resultValue: string;
}

/* ── Result Table ─────────────────────── */
function ResultTable({
  rows,
  showCampaign,
}: {
  rows: ResultRow[];
  showCampaign: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <FileText className="size-7 opacity-30" />
        <span className="text-sm">입력된 결과값이 없습니다.</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[10%]">날짜</th>
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[20%]">업무</th>
            {showCampaign && (
              <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[16%]">캠페인</th>
            )}
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[10%]">담당자</th>
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">결과값</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isUrl = /^https?:\/\//.test(row.resultValue);
            const catColor = CATEGORY_COLORS[row.taskCategory as TaskCategory];
            return (
              <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors h-8">
                <td className="px-3 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
                  {row.date}
                </td>
                <td className="px-3 py-0.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[12px] font-medium truncate">{row.taskName}</span>
                    {catColor && (
                      <Badge variant="outline" className={cn('text-[8px] px-1 py-0 shrink-0', catColor.text, catColor.bg)}>
                        {row.taskCategory}
                      </Badge>
                    )}
                  </div>
                </td>
                {showCampaign && (
                  <td className="px-3 py-0.5 text-[11px] text-muted-foreground truncate">
                    {row.campaignName || '-'}
                  </td>
                )}
                <td className="px-3 py-0.5 text-[11px] text-muted-foreground truncate">
                  {row.assignee}
                </td>
                <td className="px-3 py-0.5 text-[12px] text-foreground">
                  {isUrl ? (
                    <a
                      href={row.resultValue}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                    >
                      {row.resultValue}
                    </a>
                  ) : (
                    <span className="truncate block">{row.resultValue}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Page ────────────────────────── */
export default function ResultsViewPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const currentDate = parseISO(date);
  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');
  const yearMonth = format(currentDate, 'yyyy-MM');

  // ── Data Fetching ──

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

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

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

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Campaigns (for periodic task results that reference campaign_id)
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

  const campaignMap = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach((c) => map.set(c.id, `${c.client_name} - ${c.campaign_name}`));
    return map;
  }, [campaigns]);

  // Daily/weekly results: exact date match
  const { data: dailyChecks = [], isLoading: dailyLoading } = useQuery({
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

  // Periodic results: entire month range
  const { data: periodicChecks = [], isLoading: periodicLoading } = useQuery({
    queryKey: selectedUserId
      ? queryKeys.checks.periodicResultsByMonthAndUser(yearMonth, selectedUserId)
      : queryKeys.checks.periodicResultsByMonth(yearMonth),
    queryFn: async () => {
      let query = supabase
        .from('daily_checks')
        .select('*')
        .gte('check_date', monthStart)
        .lte('check_date', monthEnd)
        .not('result_value', 'is', null);
      if (selectedUserId) {
        query = query.eq('assigned_user_id', selectedUserId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
  });

  // Set of periodic task IDs
  const periodicTaskIds = useMemo(() => {
    return new Set(
      tasks
        .filter((t) => t.frequency === 'monthly' || t.frequency === 'once' || t.frequency === 'as_needed')
        .map((t) => t.id)
    );
  }, [tasks]);

  // Helper: convert check to ResultRow
  const toRow = (c: DailyCheck): ResultRow => {
    const task = taskMap.get(c.task_id);
    return {
      id: c.id,
      date: c.check_date,
      taskName: task?.task_name ?? c.task_id,
      taskCategory: task?.category ?? '',
      frequency: task?.frequency ?? '',
      loopOrder: task?.loop_order ?? 999,
      assignee: (c.assigned_user_id ? userMap.get(c.assigned_user_id) : null) ?? c.assigned_user_id ?? '-',
      campaignName: c.campaign_id ? (campaignMap.get(c.campaign_id) ?? null) : null,
      resultValue: c.result_value!,
    };
  };

  // Split daily checks into daily/weekly vs periodic
  const dailyWeeklyRows = useMemo(() => {
    return dailyChecks
      .filter((c) => c.result_value && !periodicTaskIds.has(c.task_id))
      .map(toRow)
      .sort((a, b) => a.loopOrder - b.loopOrder);
  }, [dailyChecks, periodicTaskIds, taskMap, userMap, campaignMap]);

  // Periodic rows from monthly range query (exclude daily/weekly tasks)
  const periodicRows = useMemo(() => {
    return periodicChecks
      .filter((c) => c.result_value && periodicTaskIds.has(c.task_id))
      .map(toRow)
      .sort((a, b) => a.loopOrder - b.loopOrder || a.date.localeCompare(b.date));
  }, [periodicChecks, periodicTaskIds, taskMap, userMap, campaignMap]);

  const isLoading = dailyLoading || periodicLoading;
  const totalResults = dailyWeeklyRows.length + periodicRows.length;

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
            총 {totalResults}건
          </Badge>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>
        </div>
      ) : totalResults === 0 ? (
        <motion.div variants={fadeUpItem}>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <FileText className="size-8 opacity-30" />
            <span className="text-sm">입력된 결과값이 없습니다.</span>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Section 1: Daily/Weekly Results */}
          <motion.div variants={fadeUpItem}>
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="px-3 py-1.5 border-b bg-blue-50 dark:bg-blue-950/20 flex items-center gap-2">
                <ClipboardList className="size-3.5 text-blue-500" />
                <h3 className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  일일/주간 결과값
                </h3>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                  {dailyWeeklyRows.length}건
                </Badge>
              </div>
              <ResultTable rows={dailyWeeklyRows} showCampaign={false} />
            </div>
          </motion.div>

          {/* Section 2: Periodic Results */}
          <motion.div variants={fadeUpItem}>
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="px-3 py-1.5 border-b bg-indigo-50 dark:bg-indigo-950/20 flex items-center gap-2">
                <CalendarDays className="size-3.5 text-indigo-500" />
                <h3 className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  월간/주기별 결과값
                </h3>
                <span className="text-[10px] text-indigo-500/70">
                  {format(currentDate, 'yyyy년 MM월')} 기준
                </span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                  {periodicRows.length}건
                </Badge>
              </div>
              <ResultTable rows={periodicRows} showCampaign={true} />
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
