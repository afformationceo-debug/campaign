'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { FileText, CalendarDays, ClipboardList, FolderOpen, Search, X, Calendar, User as UserIcon, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { CATEGORY_COLORS } from '@/lib/utils/category-colors';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  User,
  TaskCategory,
  Project,
  ProjectTask,
} from '@/lib/types/database';

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

/* ── Highlight matching text ─────────────── */
function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800/50 rounded-sm px-0.5">{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
}

/* ── Result Value Cell (shared) ──────────── */
function ResultValueCell({ value, search }: { value: string; search: string }) {
  const isUrl = /^https?:\/\//.test(value);
  const isStatus = value.startsWith('(') && value.endsWith(')');

  if (isStatus) {
    return <span className="text-muted-foreground/50 italic text-[9px]">{value}</span>;
  }

  const content = (
    <span className={cn(
      'truncate block text-[10px]',
      isUrl && 'text-blue-600'
    )}>
      <HighlightText text={value} search={search} />
    </span>
  );

  // Short values don't need a tooltip
  if (value.length <= 40 && !value.includes('\n')) {
    if (isUrl) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="truncate block text-[10px] text-blue-600 hover:text-blue-800 hover:underline">
          <HighlightText text={value} search={search} />
        </a>
      );
    }
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {isUrl ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="truncate block text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
            <HighlightText text={value} search={search} />
          </a>
        ) : (
          <span className="truncate block text-[10px] cursor-default">
            <HighlightText text={value} search={search} />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-[400px] whitespace-pre-wrap break-words text-xs p-3">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Assignee Group Header ─────────────── */
function AssigneeGroupHeader({ name, count, color }: { name: string; count: number; color: string }) {
  return (
    <tr>
      <td colSpan={10} className={cn('px-2 py-0.5 border-b', color)}>
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center">
            <UserIcon className="size-2 text-current opacity-70" />
          </div>
          <span className="text-[10px] font-semibold">{name}</span>
          <span className="text-[9px] opacity-50">{count}건</span>
        </div>
      </td>
    </tr>
  );
}

/* ── Group rows by assignee ──────────────── */
function groupByAssignee<T extends { assignee: string }>(rows: T[]): { assignee: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    if (!map.has(r.assignee)) map.set(r.assignee, []);
    map.get(r.assignee)!.push(r);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([assignee, rows]) => ({ assignee, rows }));
}

/* ── Result Table (compact + grouped) ─── */
function ResultTable({
  rows,
  showCampaign,
  search,
  groupColor,
}: {
  rows: ResultRow[];
  showCampaign: boolean;
  search: string;
  groupColor: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1">
        <FileText className="size-5 opacity-30" />
        <span className="text-[11px]">{search ? '검색 결과가 없습니다.' : '결과값이 없습니다.'}</span>
      </div>
    );
  }

  const groups = groupByAssignee(rows);

  return (
    <TooltipProvider>
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground" style={{ width: '72px' }}>날짜</th>
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground" style={{ width: showCampaign ? '18%' : '22%' }}>업무</th>
            {showCampaign && (
              <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground" style={{ width: '13%' }}>캠페인</th>
            )}
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">결과값</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupFragment key={group.assignee}>
              <AssigneeGroupHeader name={group.assignee} count={group.rows.length} color={groupColor} />
              {group.rows.map((row) => {
                const catColor = CATEGORY_COLORS[row.taskCategory as TaskCategory];
                return (
                  <tr key={row.id} className="border-b border-border/20 hover:bg-muted/15 transition-colors h-6">
                    <td className="px-2 py-0 text-[9px] text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className="px-2 py-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[10px] font-medium truncate">
                          <HighlightText text={row.taskName} search={search} />
                        </span>
                        {catColor && (
                          <Badge variant="outline" className={cn('text-[7px] px-0.5 py-0 shrink-0 leading-tight', catColor.text, catColor.bg)}>
                            {row.taskCategory}
                          </Badge>
                        )}
                      </div>
                    </td>
                    {showCampaign && (
                      <td className="px-2 py-0 text-[9px] text-muted-foreground truncate">
                        <HighlightText text={row.campaignName || '-'} search={search} />
                      </td>
                    )}
                    <td className="px-2 py-0">
                      <ResultValueCell value={row.resultValue} search={search} />
                    </td>
                  </tr>
                );
              })}
            </GroupFragment>
          ))}
        </tbody>
      </table>
    </div>
    </TooltipProvider>
  );
}

/* ── Project Result Table (compact + grouped) ── */
function ProjectResultTable({ rows, search, groupColor }: { rows: ProjectResultRow[]; search: string; groupColor: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1">
        <FolderOpen className="size-5 opacity-30" />
        <span className="text-[11px]">{search ? '검색 결과가 없습니다.' : '결과값이 없습니다.'}</span>
      </div>
    );
  }

  const groups = groupByAssignee(rows);

  return (
    <TooltipProvider>
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground" style={{ width: '17%' }}>프로젝트</th>
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground" style={{ width: '15%' }}>하위업무</th>
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground" style={{ width: '50px' }}>상태</th>
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground" style={{ width: '72px' }}>마감일</th>
            <th className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">결과값</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupFragment key={group.assignee}>
              <AssigneeGroupHeader name={group.assignee} count={group.rows.length} color={groupColor} />
              {group.rows.map((row) => {
                const stateColor =
                  row.state === '완료' ? 'text-emerald-600' :
                  row.state === '진행중' ? 'text-blue-600' : 'text-gray-400';
                return (
                  <tr key={row.id} className="border-b border-border/20 hover:bg-muted/15 transition-colors h-6">
                    <td className="px-2 py-0 text-[10px] font-medium truncate">
                      <HighlightText text={row.projectName} search={search} />
                    </td>
                    <td className="px-2 py-0 text-[9px] truncate">
                      <HighlightText text={row.taskTitle} search={search} />
                    </td>
                    <td className="px-2 py-0">
                      <span className={cn('text-[9px] font-medium', stateColor)}>{row.state}</span>
                    </td>
                    <td className="px-2 py-0 text-[9px] text-muted-foreground">{row.dueDate || '-'}</td>
                    <td className="px-2 py-0">
                      <ResultValueCell value={row.resultValue} search={search} />
                    </td>
                  </tr>
                );
              })}
            </GroupFragment>
          ))}
        </tbody>
      </table>
    </div>
    </TooltipProvider>
  );
}

/* ── Main Page ────────────────────────── */
export default function ResultsViewPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allPeriod, setAllPeriod] = useState(false);


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

  // Daily/weekly results: include checks with result_value OR status='완료'
  const { data: dailyChecks = [], isLoading: dailyLoading } = useQuery({
    queryKey: allPeriod
      ? queryKeys.checks.allResults(selectedUserId ?? undefined)
      : selectedUserId
        ? queryKeys.checks.resultsByDateAndUser(date, selectedUserId)
        : queryKeys.checks.resultsByDate(date),
    queryFn: async () => {
      let query = supabase
        .from('daily_checks')
        .select('*')
        .or('result_value.not.is.null,status.eq.완료');
      if (!allPeriod) {
        query = query.eq('check_date', date);
      }
      if (selectedUserId) {
        query = query.eq('assigned_user_id', selectedUserId);
      }
      query = query.order('check_date', { ascending: false }).limit(500);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
  });

  // Periodic results: include checks with result_value OR status='완료'
  const { data: periodicChecks = [], isLoading: periodicLoading } = useQuery({
    queryKey: allPeriod
      ? queryKeys.checks.allPeriodicResults(selectedUserId ?? undefined)
      : selectedUserId
        ? queryKeys.checks.periodicResultsByMonthAndUser(date, selectedUserId)
        : queryKeys.checks.periodicResultsByMonth(date),
    queryFn: async () => {
      let query = supabase
        .from('daily_checks')
        .select('*')
        .or('result_value.not.is.null,status.eq.완료');
      if (!allPeriod) {
        query = query.eq('check_date', date);
      }
      if (selectedUserId) {
        query = query.eq('assigned_user_id', selectedUserId);
      }
      query = query.order('check_date', { ascending: false }).limit(500);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
  });

  // Projects & project tasks
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
        .or('result_value.not.is.null,state.eq.완료')
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

  // Resolve selected user's name for client-side filtering
  const selectedUserName = selectedUserId ? userMap.get(selectedUserId) ?? null : null;

  // Helper: convert check to ResultRow
  const toRow = (c: DailyCheck): ResultRow => {
    const task = taskMap.get(c.task_id);
    const actualAssignee = c.assigned_user_id ? userMap.get(c.assigned_user_id) : null;
    return {
      id: c.id,
      date: c.check_date,
      taskName: task?.task_name ?? c.task_id,
      taskCategory: task?.category ?? '',
      frequency: task?.frequency ?? '',
      loopOrder: task?.loop_order ?? 999,
      assignee: actualAssignee ?? '-',
      campaignName: c.campaign_id ? (campaignMap.get(c.campaign_id) ?? null) : null,
      resultValue: c.result_value || `(${c.status})`,
    };
  };

  // Search filter function
  const matchesSearch = (row: ResultRow): boolean => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      row.taskName.toLowerCase().includes(q) ||
      row.resultValue.toLowerCase().includes(q) ||
      row.assignee.toLowerCase().includes(q) ||
      (row.campaignName?.toLowerCase().includes(q) ?? false)
    );
  };

  const matchesProjectSearch = (row: ProjectResultRow): boolean => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      row.projectName.toLowerCase().includes(q) ||
      row.taskTitle.toLowerCase().includes(q) ||
      row.resultValue.toLowerCase().includes(q) ||
      row.assignee.toLowerCase().includes(q)
    );
  };

  // ── Filtered rows ──
  const globalRows = useMemo(() => {
    return dailyChecks
      .filter((c) => (c.result_value || c.status === '완료') && !c.campaign_id && !periodicTaskIds.has(c.task_id))
      .map(toRow)
      .filter(matchesSearch)
      .sort((a, b) => a.assignee.localeCompare(b.assignee, 'ko') || (allPeriod ? b.date.localeCompare(a.date) || a.loopOrder - b.loopOrder : a.loopOrder - b.loopOrder));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyChecks, periodicTaskIds, taskMap, campaignMap, userMap, searchQuery, allPeriod]);

  const campaignRows = useMemo(() => {
    return dailyChecks
      .filter((c) => (c.result_value || c.status === '완료') && c.campaign_id && !periodicTaskIds.has(c.task_id))
      .map(toRow)
      .filter(matchesSearch)
      .sort((a, b) => {
        const assigneeCmp = a.assignee.localeCompare(b.assignee, 'ko');
        if (assigneeCmp !== 0) return assigneeCmp;
        if (allPeriod) {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
        }
        const campCmp = (a.campaignName ?? '').localeCompare(b.campaignName ?? '', 'ko');
        if (campCmp !== 0) return campCmp;
        return a.loopOrder - b.loopOrder;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyChecks, periodicTaskIds, taskMap, campaignMap, userMap, searchQuery, allPeriod]);

  const monthlyRows = useMemo(() => {
    return periodicChecks
      .filter((c) => (c.result_value || c.status === '완료') && periodicTaskIds.has(c.task_id))
      .map(toRow)
      .filter(matchesSearch)
      .sort((a, b) => a.assignee.localeCompare(b.assignee, 'ko') || (allPeriod ? b.date.localeCompare(a.date) || a.loopOrder - b.loopOrder : a.loopOrder - b.loopOrder || a.date.localeCompare(b.date)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodicChecks, periodicTaskIds, taskMap, campaignMap, userMap, searchQuery, allPeriod]);

  const projectResultRows = useMemo((): ProjectResultRow[] => {
    const projectRows: ProjectResultRow[] = projects
      .filter((p) => p.result_value || p.state === '완료')
      .filter((p) => {
        // Filter by selected user
        if (!selectedUserId) return true;
        return p.assignee_id === selectedUserId;
      })
      .map((p) => ({
        id: `project-${p.id}`,
        projectName: p.project_name,
        taskTitle: '(프로젝트 결과)',
        assignee: p.assignee_id ? (userMap.get(p.assignee_id) ?? '-') : '-',
        state: p.state,
        resultValue: p.result_value || `(${p.state})`,
        dueDate: p.due_date,
      }));

    const taskRows: ProjectResultRow[] = projectTasks
      .filter((pt) => {
        // Filter by selected user
        if (!selectedUserId) return true;
        const project = projectMap.get(pt.project_id);
        const taskAssignee = pt.assignee_id ?? project?.assignee_id ?? null;
        return taskAssignee === selectedUserId;
      })
      .map((pt) => {
        const project = projectMap.get(pt.project_id);
        return {
          id: pt.id,
          projectName: project?.project_name ?? '-',
          taskTitle: pt.title,
          assignee: pt.assignee_id ? (userMap.get(pt.assignee_id) ?? '-') : (project?.assignee_id ? (userMap.get(project.assignee_id) ?? '-') : '-'),
          state: pt.state,
          resultValue: pt.result_value || `(${pt.state})`,
          dueDate: pt.due_date,
        };
      });

    return [...projectRows, ...taskRows]
      .filter(matchesProjectSearch)
      .sort((a, b) => a.assignee.localeCompare(b.assignee, 'ko'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, projectTasks, projectMap, userMap, searchQuery, selectedUserId]);

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
      className="space-y-3"
    >
      {/* Header */}
      <motion.div variants={fadeUpItem}>
        <h1 className="text-xl font-bold tracking-tight">결과값 관리</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          업무별, 프로젝트별 결과값을 담당자별로 그룹화하여 확인합니다.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUpItem}>
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {!allPeriod && (
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[150px] h-7 text-xs"
              />
            )}
            <select
              value={selectedUserId ?? ''}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="h-7 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">전체 담당자</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAllPeriod(!allPeriod)}
              className={cn(
                'h-7 px-2.5 rounded-md text-[10px] font-medium transition-all flex items-center gap-1 border',
                allPeriod
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-background text-muted-foreground hover:bg-muted border-border'
              )}
            >
              <Calendar className="size-3" />
              전체기간
            </button>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {searchQuery ? `검색 ${totalResults}건` : `총 ${totalResults}건`}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="업무명, 캠페인명, 담당자, 결과값 검색..."
              className="h-7 pl-8 pr-7 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="size-4 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-xs">불러오는 중...</span>
          </div>
        </div>
      ) : (
        <motion.div variants={fadeUpItem}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-2">
              <TabsTrigger value="all" className="text-[10px] gap-1 px-2 py-1">
                전체
                {totalResults > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0">{totalResults}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="global" className="text-[10px] gap-1 px-2 py-1">
                <ClipboardList className="size-3" />
                전역
                {tabCounts.global > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0">{tabCounts.global}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="campaign" className="text-[10px] gap-1 px-2 py-1">
                <CalendarDays className="size-3" />
                캠페인
                {tabCounts.campaign > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0">{tabCounts.campaign}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-[10px] gap-1 px-2 py-1">
                <CalendarDays className="size-3" />
                월간
                {tabCounts.monthly > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0">{tabCounts.monthly}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="project" className="text-[10px] gap-1 px-2 py-1">
                <FolderOpen className="size-3" />
                프로젝트
                {tabCounts.project > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0">{tabCounts.project}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* All Tab */}
            <TabsContent value="all" className="space-y-3">
              {globalRows.length > 0 && (
                <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                  <div className="px-2.5 py-1 border-b bg-blue-50 dark:bg-blue-950/20 flex items-center gap-1.5">
                    <ClipboardList className="size-3 text-blue-500" />
                    <h3 className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">전역 일일/주간</h3>
                    <span className="text-[9px] text-blue-500/60">{allPeriod ? '전체기간' : date}</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{globalRows.length}</Badge>
                  </div>
                  <ResultTable rows={globalRows} showCampaign={false} search={searchQuery} groupColor="bg-blue-50/70 dark:bg-blue-950/15 text-blue-700 dark:text-blue-300" />
                </div>
              )}
              {campaignRows.length > 0 && (
                <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                  <div className="px-2.5 py-1 border-b bg-violet-50 dark:bg-violet-950/20 flex items-center gap-1.5">
                    <CalendarDays className="size-3 text-violet-500" />
                    <h3 className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">캠페인별 일일</h3>
                    <span className="text-[9px] text-violet-500/60">{allPeriod ? '전체기간' : date}</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{campaignRows.length}</Badge>
                  </div>
                  <ResultTable rows={campaignRows} showCampaign={true} search={searchQuery} groupColor="bg-violet-50/70 dark:bg-violet-950/15 text-violet-700 dark:text-violet-300" />
                </div>
              )}
              {monthlyRows.length > 0 && (
                <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                  <div className="px-2.5 py-1 border-b bg-indigo-50 dark:bg-indigo-950/20 flex items-center gap-1.5">
                    <CalendarDays className="size-3 text-indigo-500" />
                    <h3 className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">월간/주기별</h3>
                    <span className="text-[9px] text-indigo-500/60">{allPeriod ? '전체기간' : date}</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{monthlyRows.length}</Badge>
                  </div>
                  <ResultTable rows={monthlyRows} showCampaign={true} search={searchQuery} groupColor="bg-indigo-50/70 dark:bg-indigo-950/15 text-indigo-700 dark:text-indigo-300" />
                </div>
              )}
              {projectResultRows.length > 0 && (
                <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                  <div className="px-2.5 py-1 border-b bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-1.5">
                    <FolderOpen className="size-3 text-emerald-500" />
                    <h3 className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">프로젝트</h3>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{projectResultRows.length}</Badge>
                  </div>
                  <ProjectResultTable rows={projectResultRows} search={searchQuery} groupColor="bg-emerald-50/70 dark:bg-emerald-950/15 text-emerald-700 dark:text-emerald-300" />
                </div>
              )}
              {totalResults === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-1">
                  <FileText className="size-6 opacity-30" />
                  <span className="text-xs">
                    {searchQuery ? `"${searchQuery}" 검색 결과 없음` : '결과값이 없습니다.'}
                  </span>
                </div>
              )}
            </TabsContent>

            {/* Global Tab */}
            <TabsContent value="global">
              <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="px-2.5 py-1 border-b bg-blue-50 dark:bg-blue-950/20 flex items-center gap-1.5">
                  <ClipboardList className="size-3 text-blue-500" />
                  <h3 className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">전역 일일/주간</h3>
                  <span className="text-[9px] text-blue-500/60">{allPeriod ? '전체기간' : date}</span>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{globalRows.length}</Badge>
                </div>
                <ResultTable rows={globalRows} showCampaign={false} search={searchQuery} groupColor="bg-blue-50/70 dark:bg-blue-950/15 text-blue-700 dark:text-blue-300" />
              </div>
            </TabsContent>

            {/* Campaign Tab */}
            <TabsContent value="campaign">
              <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="px-2.5 py-1 border-b bg-violet-50 dark:bg-violet-950/20 flex items-center gap-1.5">
                  <CalendarDays className="size-3 text-violet-500" />
                  <h3 className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">캠페인별 일일</h3>
                  <span className="text-[9px] text-violet-500/60">{allPeriod ? '전체기간' : date}</span>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{campaignRows.length}</Badge>
                </div>
                <ResultTable rows={campaignRows} showCampaign={true} search={searchQuery} groupColor="bg-violet-50/70 dark:bg-violet-950/15 text-violet-700 dark:text-violet-300" />
              </div>
            </TabsContent>

            {/* Monthly Tab */}
            <TabsContent value="monthly">
              <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="px-2.5 py-1 border-b bg-indigo-50 dark:bg-indigo-950/20 flex items-center gap-1.5">
                  <CalendarDays className="size-3 text-indigo-500" />
                  <h3 className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">월간/주기별</h3>
                  <span className="text-[9px] text-indigo-500/60">{allPeriod ? '전체기간' : date}</span>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{monthlyRows.length}</Badge>
                </div>
                <ResultTable rows={monthlyRows} showCampaign={true} search={searchQuery} groupColor="bg-indigo-50/70 dark:bg-indigo-950/15 text-indigo-700 dark:text-indigo-300" />
              </div>
            </TabsContent>

            {/* Project Tab */}
            <TabsContent value="project">
              <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="px-2.5 py-1 border-b bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-1.5">
                  <FolderOpen className="size-3 text-emerald-500" />
                  <h3 className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">프로젝트</h3>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">{projectResultRows.length}</Badge>
                </div>
                <ProjectResultTable rows={projectResultRows} search={searchQuery} groupColor="bg-emerald-50/70 dark:bg-emerald-950/15 text-emerald-700 dark:text-emerald-300" />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </motion.div>
  );
}

// Fragment helper
function GroupFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
