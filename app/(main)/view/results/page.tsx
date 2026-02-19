'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { FileText, CalendarDays, ClipboardList, FolderOpen, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { CATEGORY_COLORS } from '@/lib/utils/category-colors';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  Task,
  Campaign,
  DailyCheck,
  User,
  TaskCategory,
  Project,
  ProjectTask,
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

/* ── Project result row ──────────────────── */
interface ProjectResultRow {
  id: string;
  projectName: string;
  taskTitle: string;
  assignee: string;
  state: string;
  resultValue: string;
  dueDate: string | null;
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

/* ── Project Result Table ─────────────── */
function ProjectResultTable({ rows }: { rows: ProjectResultRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <FolderOpen className="size-7 opacity-30" />
        <span className="text-sm">결과값이 입력된 프로젝트 업무가 없습니다.</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[20%]">프로젝트</th>
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[20%]">하위업무</th>
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[8%]">담당자</th>
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[8%]">상태</th>
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground w-[10%]">마감일</th>
            <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">결과값</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isUrl = /^https?:\/\//.test(row.resultValue);
            const stateColor =
              row.state === '완료' ? 'text-emerald-600' :
              row.state === '진행중' ? 'text-blue-600' : 'text-gray-500';
            return (
              <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors h-8">
                <td className="px-3 py-0.5 text-[12px] font-medium truncate">{row.projectName}</td>
                <td className="px-3 py-0.5 text-[11px] truncate">{row.taskTitle}</td>
                <td className="px-3 py-0.5 text-[11px] text-muted-foreground truncate">{row.assignee}</td>
                <td className="px-3 py-0.5">
                  <span className={cn('text-[11px] font-medium', stateColor)}>{row.state}</span>
                </td>
                <td className="px-3 py-0.5 text-[11px] text-muted-foreground">{row.dueDate || '-'}</td>
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
  const [activeTab, setActiveTab] = useState('global');

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

  // Projects & project tasks with result_value
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: projectTasks = [], isLoading: projectTasksLoading } = useQuery({
    queryKey: ['projectTasks', 'withResults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .not('result_value', 'is', null)
        .order('sort_order');
      if (error) throw error;
      return data as ProjectTask[];
    },
  });

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

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
      assignee: task?.default_assignees?.join(', ') ?? '-',
      campaignName: c.campaign_id ? (campaignMap.get(c.campaign_id) ?? null) : null,
      resultValue: c.result_value!,
    };
  };

  // ── Global tab: all results for date (daily/weekly, no campaign split) ──
  const globalRows = useMemo(() => {
    return dailyChecks
      .filter((c) => c.result_value && !c.campaign_id && !periodicTaskIds.has(c.task_id))
      .map(toRow)
      .sort((a, b) => a.loopOrder - b.loopOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyChecks, periodicTaskIds, taskMap, campaignMap]);

  // ── Campaign tab: daily results grouped by campaign ──
  const campaignRows = useMemo(() => {
    return dailyChecks
      .filter((c) => c.result_value && c.campaign_id && !periodicTaskIds.has(c.task_id))
      .map(toRow)
      .sort((a, b) => {
        const campCmp = (a.campaignName ?? '').localeCompare(b.campaignName ?? '', 'ko');
        if (campCmp !== 0) return campCmp;
        return a.loopOrder - b.loopOrder;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyChecks, periodicTaskIds, taskMap, campaignMap]);

  // ── Monthly tab: periodic results ──
  const monthlyRows = useMemo(() => {
    return periodicChecks
      .filter((c) => c.result_value && periodicTaskIds.has(c.task_id))
      .map(toRow)
      .sort((a, b) => a.loopOrder - b.loopOrder || a.date.localeCompare(b.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodicChecks, periodicTaskIds, taskMap, campaignMap]);

  // ── Project tab: project task results ──
  const projectResultRows = useMemo((): ProjectResultRow[] => {
    return projectTasks.map((pt) => {
      const project = projectMap.get(pt.project_id);
      return {
        id: pt.id,
        projectName: project?.project_name ?? '-',
        taskTitle: pt.title,
        assignee: pt.assignee_id ? (userMap.get(pt.assignee_id) ?? '-') : (project?.assignee_id ? (userMap.get(project.assignee_id) ?? '-') : '-'),
        state: pt.state,
        resultValue: pt.result_value!,
        dueDate: pt.due_date,
      };
    });
  }, [projectTasks, projectMap, userMap]);

  const isLoading = dailyLoading || periodicLoading || projectTasksLoading;

  const tabCounts = {
    global: globalRows.length,
    campaign: campaignRows.length,
    monthly: monthlyRows.length,
    project: projectResultRows.length,
  };

  const totalResults = tabCounts.global + tabCounts.campaign + tabCounts.monthly + tabCounts.project;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={fadeUpItem}>
        <h1 className="text-xl font-bold tracking-tight">결과값 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          업무별, 프로젝트별 결과값을 한눈에 확인할 수 있습니다.
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
      ) : (
        <motion.div variants={fadeUpItem}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="global" className="text-xs gap-1.5">
                <ClipboardList className="size-3.5" />
                전역
                {tabCounts.global > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{tabCounts.global}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="campaign" className="text-xs gap-1.5">
                <CalendarDays className="size-3.5" />
                캠페인별
                {tabCounts.campaign > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{tabCounts.campaign}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs gap-1.5">
                <CalendarDays className="size-3.5" />
                월간
                {tabCounts.monthly > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{tabCounts.monthly}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="project" className="text-xs gap-1.5">
                <FolderOpen className="size-3.5" />
                프로젝트
                {tabCounts.project > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{tabCounts.project}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Global Tab */}
            <TabsContent value="global">
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="px-3 py-1.5 border-b bg-blue-50 dark:bg-blue-950/20 flex items-center gap-2">
                  <ClipboardList className="size-3.5 text-blue-500" />
                  <h3 className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                    전역 일일/주간 결과값
                  </h3>
                  <span className="text-[10px] text-blue-500/70">{date}</span>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                    {globalRows.length}건
                  </Badge>
                </div>
                <ResultTable rows={globalRows} showCampaign={false} />
              </div>
            </TabsContent>

            {/* Campaign Tab */}
            <TabsContent value="campaign">
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="px-3 py-1.5 border-b bg-violet-50 dark:bg-violet-950/20 flex items-center gap-2">
                  <CalendarDays className="size-3.5 text-violet-500" />
                  <h3 className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                    캠페인별 일일 결과값
                  </h3>
                  <span className="text-[10px] text-violet-500/70">{date}</span>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                    {campaignRows.length}건
                  </Badge>
                </div>
                <ResultTable rows={campaignRows} showCampaign={true} />
              </div>
            </TabsContent>

            {/* Monthly Tab */}
            <TabsContent value="monthly">
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
                    {monthlyRows.length}건
                  </Badge>
                </div>
                <ResultTable rows={monthlyRows} showCampaign={true} />
              </div>
            </TabsContent>

            {/* Project Tab */}
            <TabsContent value="project">
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="px-3 py-1.5 border-b bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-2">
                  <FolderOpen className="size-3.5 text-emerald-500" />
                  <h3 className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    프로젝트 업무 결과값
                  </h3>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                    {projectResultRows.length}건
                  </Badge>
                </div>
                <ProjectResultTable rows={projectResultRows} />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </motion.div>
  );
}
