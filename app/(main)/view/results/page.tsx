'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  addDays,
  subDays,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  FileText,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { CATEGORY_COLORS } from '@/lib/utils/category-colors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
import type {
  Task,
  Campaign,
  DailyCheck,
  User,
  TaskCategory,
  Project,
  ProjectTask,
  CheckStatus,
} from '@/lib/types/database';

/* ── Types ──────────────────────────────── */

type RangeMode = 'day' | 'week' | 'month';

interface ResultRow {
  id: string;
  checkId: string | null;
  date: string;
  taskId: string;
  taskName: string;
  taskCategory: TaskCategory | string;
  frequency: string;
  loopOrder: number;
  assignee: string;
  assigneeId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  resultValue: string | null;
  status: CheckStatus;
  scope: 'global' | 'campaign';
}

interface ProjectResultRow {
  id: string;
  projectName: string;
  taskTitle: string;
  assignee: string;
  state: string;
  resultValue: string | null;
  dueDate: string | null;
}

/* ── Helpers ────────────────────────────── */

function lastDayOfMonth(dateStr: string): string {
  const d = parseISO(dateStr);
  return format(endOfMonth(d), 'yyyy-MM-dd');
}

function getDateRange(date: string, mode: RangeMode): { start: string; end: string } {
  const d = parseISO(date);
  switch (mode) {
    case 'week':
      return {
        start: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'month':
      return {
        start: format(startOfMonth(d), 'yyyy-MM-dd'),
        end: format(endOfMonth(d), 'yyyy-MM-dd'),
      };
    case 'day':
    default:
      return { start: date, end: date };
  }
}

function formatDateLabel(date: string, mode: RangeMode): string {
  const d = parseISO(date);
  switch (mode) {
    case 'week': {
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const we = endOfWeek(d, { weekStartsOn: 1 });
      return `${format(ws, 'M/d')} ~ ${format(we, 'M/d')}`;
    }
    case 'month':
      return format(d, 'yyyy년 M월');
    case 'day':
    default:
      return format(d, 'yyyy-MM-dd (EEE)', { locale: ko });
  }
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

/* ── Inline Result Value Input ─────────────── */
function InlineResultInput({
  check,
  resultValue,
  taskId,
  date,
  assigneeId,
  campaignId,
}: {
  check: { id: string; status: CheckStatus } | null;
  resultValue: string | null;
  taskId: string;
  date: string;
  assigneeId: string | null;
  campaignId: string | null;
}) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    setValue(resultValue ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (!check) {
      if (!trimmed || !assigneeId) return;
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '완료',
        result_value: trimmed,
      });
    } else {
      if (trimmed === (resultValue ?? '')) return;
      updateStatus({ id: check.id, status: check.status, assigned_user_id: assigneeId ?? undefined, result_value: trimmed });
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-full text-[10px] bg-transparent border-b border-foreground/30 outline-none px-0.5 py-0"
        placeholder="결과값 입력..."
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className={cn(
        'w-full text-left text-[10px] px-0.5 py-0 truncate rounded hover:bg-secondary/50 transition-colors cursor-text min-h-[16px]',
        resultValue ? 'text-foreground' : 'text-muted-foreground/30'
      )}
    >
      {resultValue || '-'}
    </button>
  );
}

/* ── Result Value Cell (with popover + inline edit) ──────────── */
function ResultValueCell({
  row,
  search,
}: {
  row: ResultRow;
  search: string;
}) {
  const [copied, setCopied] = useState(false);
  const value = row.resultValue;

  if (!value) {
    return (
      <InlineResultInput
        check={row.checkId ? { id: row.checkId, status: row.status } : null}
        resultValue={null}
        taskId={row.taskId}
        date={row.date}
        assigneeId={row.assigneeId}
        campaignId={row.campaignId}
      />
    );
  }

  const isUrl = /^https?:\/\//.test(value);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'truncate block text-[10px] text-left w-full rounded px-0.5 -mx-0.5',
            'hover:bg-secondary/60 transition-colors cursor-pointer',
            isUrl ? 'text-foreground underline' : 'text-foreground'
          )}
        >
          <span className="flex items-center gap-0.5">
            <HighlightText text={value} search={search} />
            {isUrl && <ExternalLink className="size-2.5 shrink-0 opacity-50" />}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[420px] p-0 rounded-xl shadow-xl border border-border"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 py-2 border-b border-stone-100 bg-stone-50 flex items-center justify-between rounded-t-xl">
          <span className="text-[10px] font-semibold text-muted-foreground">결과값 상세</span>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md transition-all',
              copied
                ? 'bg-secondary text-foreground'
                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
            )}
          >
            {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
        <div className="px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
          {isUrl ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline break-all">
              {value}
            </a>
          ) : (
            value
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Assignee Group Header (with input rate) ─────────────── */
function AssigneeGroupHeader({
  name,
  resultCount,
  totalCount,
  color,
}: {
  name: string;
  resultCount: number;
  totalCount: number;
  color: string;
}) {
  return (
    <tr>
      <td colSpan={10} className={cn('px-2 py-0.5 border-b', color)}>
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-full bg-orange-100 flex items-center justify-center">
            <UserIcon className="size-2 text-orange-600" />
          </div>
          <span className="text-[10px] font-semibold">{name}</span>
          <span className="text-[9px] text-muted-foreground">
            결과 {resultCount}건 / 전체 {totalCount}건
          </span>
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
  showDate,
  search,
  groupColor,
}: {
  rows: ResultRow[];
  showCampaign: boolean;
  showDate: boolean;
  search: string;
  groupColor: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-stone-400 gap-1">
        <FileText className="size-5 opacity-30" />
        <span className="text-[11px]">{search ? '검색 결과가 없습니다.' : '아직 결과값이 없어요. 업무를 완료하면 여기에 표시됩니다.'}</span>
      </div>
    );
  }

  const groups = groupByAssignee(rows);

  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="border-b bg-stone-50 dark:bg-stone-900/30">
            {showDate && (
              <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500" style={{ width: '72px' }}>날짜</th>
            )}
            <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500" style={{ width: showCampaign ? '18%' : '22%' }}>업무</th>
            {showCampaign && (
              <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500" style={{ width: '13%' }}>캠페인</th>
            )}
            <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500">결과값</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const withResult = group.rows.filter((r) => r.resultValue !== null).length;
            return (
              <GroupFragment key={group.assignee}>
                <AssigneeGroupHeader
                  name={group.assignee}
                  resultCount={withResult}
                  totalCount={group.rows.length}
                  color={groupColor}
                />
                {group.rows.map((row) => {
                  return (
                    <tr key={row.id} className="border-b border-stone-100 hover:bg-orange-50/50 transition-colors h-6">
                      {showDate && (
                        <td className="px-2 py-0 text-[9px] text-muted-foreground whitespace-nowrap">
                          {format(parseISO(row.date), 'M/d')}
                        </td>
                      )}
                      <td className="px-2 py-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[10px] font-medium truncate">
                            <HighlightText text={row.taskName} search={search} />
                          </span>
                          {row.taskCategory && (
                            <Badge variant="secondary" className="text-[7px] px-1 py-0 shrink-0 leading-tight rounded-full">
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
                        <ResultValueCell row={row} search={search} />
                      </td>
                    </tr>
                  );
                })}
              </GroupFragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Project Result Table ── */
function ProjectResultTable({ rows, search, groupColor }: { rows: ProjectResultRow[]; search: string; groupColor: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-stone-400 gap-1">
        <FolderOpen className="size-5 opacity-30" />
        <span className="text-[11px]">{search ? '검색 결과가 없습니다.' : '아직 프로젝트 결과값이 없어요.'}</span>
      </div>
    );
  }

  const groups = groupByAssignee(rows);

  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="border-b bg-stone-50 dark:bg-stone-900/30">
            <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500" style={{ width: '17%' }}>프로젝트</th>
            <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500" style={{ width: '15%' }}>하위업무</th>
            <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500" style={{ width: '50px' }}>상태</th>
            <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500" style={{ width: '72px' }}>마감일</th>
            <th className="px-2 py-1.5 text-[9px] font-semibold text-stone-500">결과값</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const withResult = group.rows.filter((r) => r.resultValue !== null).length;
            return (
              <GroupFragment key={group.assignee}>
                <AssigneeGroupHeader
                  name={group.assignee}
                  resultCount={withResult}
                  totalCount={group.rows.length}
                  color={groupColor}
                />
                {group.rows.map((row) => {
                  const stateColor =
                    row.state === '완료' ? 'text-foreground font-semibold' :
                    row.state === '진행중' ? 'text-muted-foreground' : 'text-muted-foreground/50';
                  return (
                    <tr key={row.id} className="border-b border-stone-100 hover:bg-orange-50/50 transition-colors h-6">
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
                        {row.resultValue ? (
                          <span className="text-[10px] truncate block">
                            <HighlightText text={row.resultValue} search={search} />
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </GroupFragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Missing Results Section (collapsible) ─── */
function MissingResultsSection({
  rows,
  search,
}: {
  rows: ResultRow[];
  search: string;
}) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-orange-50/50 transition-colors"
      >
        <AlertTriangle className="size-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold text-foreground">
          결과 미입력
        </span>
        <Badge variant="secondary" className="text-[8px] px-1 py-0 rounded-full">
          {rows.length}건
        </Badge>
        <span className="text-[9px] text-muted-foreground ml-auto mr-1">
          완료했지만 결과값이 비어있습니다
        </span>
        <ChevronDown className={cn('size-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border">
          <table className="w-full table-fixed text-left">
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-orange-50/50 transition-colors h-6">
                  <td className="px-3 py-0 text-[10px] text-muted-foreground" style={{ width: '80px' }}>
                    {row.assignee}
                  </td>
                  <td className="px-2 py-0">
                    <span className="text-[10px] font-medium text-foreground truncate block">
                      <HighlightText text={row.taskName} search={search} />
                    </span>
                  </td>
                  <td className="px-2 py-0 text-[9px] text-muted-foreground truncate" style={{ width: '100px' }}>
                    {row.campaignName || '전역'}
                  </td>
                  <td className="px-2 py-0" style={{ width: '140px' }}>
                    <InlineResultInput
                      check={row.checkId ? { id: row.checkId, status: row.status } : null}
                      resultValue={null}
                      taskId={row.taskId}
                      date={row.date}
                      assigneeId={row.assigneeId}
                      campaignId={row.campaignId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────── */
export default function ResultsViewPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [rangeMode, setRangeMode] = useState<RangeMode>('day');

  const handleDateNav = useCallback((dir: -1 | 1) => {
    setDate((prev) => {
      const d = parseISO(prev);
      switch (rangeMode) {
        case 'week':
          return format(addDays(d, dir * 7), 'yyyy-MM-dd');
        case 'month':
          return format(dir === 1 ? addDays(endOfMonth(d), 1) : subDays(startOfMonth(d), 1), 'yyyy-MM-dd');
        default:
          return format(addDays(d, dir), 'yyyy-MM-dd');
      }
    });
  }, [rangeMode]);

  const handleToday = useCallback(() => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const handleCalendarSelect = useCallback((day: Date | undefined) => {
    if (day) setDate(format(day, 'yyyy-MM-dd'));
  }, []);

  // ── Computed date range ──
  const dateRange = useMemo(() => getDateRange(date, rangeMode), [date, rangeMode]);
  const monthRange = useMemo(() => {
    const d = parseISO(date);
    return {
      start: format(startOfMonth(d), 'yyyy-MM-dd'),
      end: format(endOfMonth(d), 'yyyy-MM-dd'),
    };
  }, [date]);
  const yearMonth = date.substring(0, 7);
  const isRangeMode = rangeMode !== 'day';

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

  // Set of periodic task IDs (monthly, once, as_needed)
  const periodicTaskIds = useMemo(() => {
    return new Set(
      tasks
        .filter((t) => t.frequency === 'monthly' || t.frequency === 'once' || t.frequency === 'as_needed')
        .map((t) => t.id)
    );
  }, [tasks]);

  // ── UNIFIED QUERY: Fetch ALL checks for the month (fixes duplicate + date bug) ──
  const { data: allChecks = [], isLoading: checksLoading } = useQuery({
    queryKey: selectedUserId
      ? queryKeys.checks.periodicResultsByMonthAndUser(yearMonth, selectedUserId)
      : queryKeys.checks.periodicResultsByMonth(yearMonth),
    queryFn: async () => {
      let query = supabase
        .from('daily_checks')
        .select('*')
        .or('result_value.not.is.null,status.eq.완료')
        .gte('check_date', monthRange.start)
        .lte('check_date', monthRange.end);
      if (selectedUserId) {
        query = query.eq('assigned_user_id', selectedUserId);
      }
      query = query.order('check_date', { ascending: false }).limit(1000);
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

  // ── Convert check to ResultRow ──
  const toRow = useCallback(
    (c: DailyCheck): ResultRow => {
      const task = taskMap.get(c.task_id);
      const actualAssignee = c.assigned_user_id ? userMap.get(c.assigned_user_id) : null;
      return {
        id: c.id,
        checkId: c.id,
        date: c.check_date,
        taskId: c.task_id,
        taskName: task?.task_name ?? c.task_id,
        taskCategory: task?.category ?? '',
        frequency: task?.frequency ?? '',
        loopOrder: task?.loop_order ?? 999,
        assignee: actualAssignee ?? '-',
        assigneeId: c.assigned_user_id,
        campaignId: c.campaign_id,
        campaignName: c.campaign_id ? (campaignMap.get(c.campaign_id) ?? null) : null,
        resultValue: c.result_value,
        status: c.status,
        scope: c.campaign_id ? 'campaign' : 'global',
      };
    },
    [taskMap, userMap, campaignMap]
  );

  // ── Search filter ──
  const matchesSearch = useCallback(
    (row: ResultRow): boolean => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.taskName.toLowerCase().includes(q) ||
        (row.resultValue?.toLowerCase().includes(q) ?? false) ||
        row.assignee.toLowerCase().includes(q) ||
        (row.campaignName?.toLowerCase().includes(q) ?? false)
      );
    },
    [searchQuery]
  );

  const matchesProjectSearch = useCallback(
    (row: ProjectResultRow): boolean => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.projectName.toLowerCase().includes(q) ||
        row.taskTitle.toLowerCase().includes(q) ||
        (row.resultValue?.toLowerCase().includes(q) ?? false) ||
        row.assignee.toLowerCase().includes(q)
      );
    },
    [searchQuery]
  );

  // ── DAILY tab rows: daily/weekly tasks, filtered by selected date range ──
  const dailyRows = useMemo(() => {
    return allChecks
      .filter((c) => {
        if (periodicTaskIds.has(c.task_id)) return false;
        // For daily tasks: filter by selected date range
        return c.check_date >= dateRange.start && c.check_date <= dateRange.end;
      })
      .map(toRow)
      .filter(matchesSearch)
      .sort((a, b) => {
        const assigneeCmp = a.assignee.localeCompare(b.assignee, 'ko');
        if (assigneeCmp !== 0) return assigneeCmp;
        if (isRangeMode) {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
        }
        const campCmp = (a.campaignName ?? '').localeCompare(b.campaignName ?? '', 'ko');
        if (campCmp !== 0) return campCmp;
        return a.loopOrder - b.loopOrder;
      });
  }, [allChecks, periodicTaskIds, dateRange, toRow, matchesSearch, isRangeMode]);

  // Split daily rows into with-result and missing-result
  const dailyWithResult = useMemo(() => dailyRows.filter((r) => r.resultValue !== null), [dailyRows]);
  const dailyMissingResult = useMemo(() => dailyRows.filter((r) => r.resultValue === null), [dailyRows]);

  // ── PERIODIC tab rows: monthly/once/as_needed, entire month range ──
  const periodicRows = useMemo(() => {
    return allChecks
      .filter((c) => periodicTaskIds.has(c.task_id))
      .map(toRow)
      .filter(matchesSearch)
      .sort((a, b) => {
        const assigneeCmp = a.assignee.localeCompare(b.assignee, 'ko');
        if (assigneeCmp !== 0) return assigneeCmp;
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return a.loopOrder - b.loopOrder;
      });
  }, [allChecks, periodicTaskIds, toRow, matchesSearch]);

  const periodicWithResult = useMemo(() => periodicRows.filter((r) => r.resultValue !== null), [periodicRows]);
  const periodicMissingResult = useMemo(() => periodicRows.filter((r) => r.resultValue === null), [periodicRows]);

  // ── PROJECT tab rows ──
  const projectResultRows = useMemo((): ProjectResultRow[] => {
    const projectRows: ProjectResultRow[] = projects
      .filter((p) => p.result_value || p.state === '완료')
      .filter((p) => {
        if (!selectedUserId) return true;
        return p.assignee_id === selectedUserId;
      })
      .map((p) => ({
        id: `project-${p.id}`,
        projectName: p.project_name,
        taskTitle: '(프로젝트 결과)',
        assignee: p.assignee_id ? (userMap.get(p.assignee_id) ?? '-') : '-',
        state: p.state,
        resultValue: p.result_value,
        dueDate: p.due_date,
      }));

    const taskRows: ProjectResultRow[] = projectTasks
      .filter((pt) => {
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
          resultValue: pt.result_value,
          dueDate: pt.due_date,
        };
      });

    return [...projectRows, ...taskRows]
      .filter(matchesProjectSearch)
      .sort((a, b) => a.assignee.localeCompare(b.assignee, 'ko'));
  }, [projects, projectTasks, projectMap, userMap, matchesProjectSearch, selectedUserId]);

  const projectWithResult = useMemo(() => projectResultRows.filter((r) => r.resultValue !== null), [projectResultRows]);

  const isLoading = checksLoading || projectTasksLoading;

  // ── Summary stats ──
  const totalWithResult = dailyWithResult.length + periodicWithResult.length + projectWithResult.length;
  const totalAll = dailyRows.length + periodicRows.length + projectResultRows.length;
  const inputRate = totalAll > 0 ? Math.round((totalWithResult / totalAll) * 100) : 0;
  const totalMissing = dailyMissingResult.length + periodicMissingResult.length;

  const tabCounts = {
    daily: dailyRows.length,
    periodic: periodicRows.length,
    project: projectResultRows.length,
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-3"
    >
      {/* Header */}
      <motion.div variants={fadeUpItem}>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-50">
            <FileText className="size-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-stone-800">일일 결과값</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              날짜별, 주간별, 월간별로 결과를 확인하세요. 복사와 내보내기도 바로 가능해요.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Summary Stats Card */}
      <motion.div variants={fadeUpItem}>
        <div className="rounded-2xl border border-stone-100 bg-white shadow-sm p-3 space-y-2.5">
          {/* Date Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => handleDateNav(-1)}
                className="rounded-lg"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-[150px] justify-start text-left font-normal h-7 rounded-lg text-xs"
                  >
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    <span>{formatDateLabel(date, rangeMode)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(date)}
                    onSelect={handleCalendarSelect}
                    defaultMonth={parseISO(date)}
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => handleDateNav(1)}
                className="rounded-lg"
              >
                <ChevronRight className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleToday}
                className="text-[11px] text-muted-foreground hover:text-foreground rounded-lg"
              >
                오늘
              </Button>
            </div>

            <div className="hidden sm:block h-5 w-px bg-border" />

            {/* Range Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-secondary/30 p-0.5 gap-0.5">
              {([['day', '일간'], ['week', '이번 주'], ['month', '이번 달']] as [RangeMode, string][]).map(
                ([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRangeMode(mode)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-medium transition-all',
                      rangeMode === mode
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    )}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="hidden sm:block h-5 w-px bg-border" />

            {/* User filter */}
            <select
              value={selectedUserId ?? ''}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="h-7 rounded-md border border-border bg-secondary/50 px-2 text-xs"
            >
              <option value="">전체 담당자</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Stats */}
          {!isLoading && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">결과 입력</span>
                  <span className="text-[12px] font-bold">{totalWithResult}/{totalAll}건</span>
                  <span className="text-[10px] text-muted-foreground">({inputRate}%)</span>
                </div>
                <div className="hidden sm:block h-4 w-px bg-border" />
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>일일 <strong className="text-foreground">{tabCounts.daily}건</strong></span>
                  <span>월간/기타 <strong className="text-foreground">{tabCounts.periodic}건</strong></span>
                  <span>프로젝트 <strong className="text-foreground">{tabCounts.project}건</strong></span>
                </div>
                {totalMissing > 0 && (
                  <>
                    <div className="hidden sm:block h-4 w-px bg-border" />
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <AlertTriangle className="size-3" />
                      <span className="text-[10px] font-medium">결과 미입력 {totalMissing}건</span>
                    </div>
                  </>
                )}
              </div>
              <Progress value={inputRate} className="h-1.5" />
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="업무명, 캠페인명, 담당자, 결과값 검색..."
              className="h-7 pl-8 pr-7 text-xs bg-secondary/50 border-border"
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
            <div className="size-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            <span className="text-xs">불러오는 중...</span>
          </div>
        </div>
      ) : (
        <motion.div variants={fadeUpItem}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-2">
              <TabsTrigger value="daily" className="text-[10px] gap-1 px-2 py-1">
                <ClipboardList className="size-3" />
                일일 업무
                {tabCounts.daily > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0 rounded-full">{tabCounts.daily}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="periodic" className="text-[10px] gap-1 px-2 py-1">
                <CalendarDays className="size-3" />
                월간/기타
                {tabCounts.periodic > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0 rounded-full">{tabCounts.periodic}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="project" className="text-[10px] gap-1 px-2 py-1">
                <FolderOpen className="size-3" />
                프로젝트
                {tabCounts.project > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0 rounded-full">{tabCounts.project}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Daily Tab */}
            <TabsContent value="daily" className="space-y-3">
              {/* Global daily section */}
              {dailyWithResult.filter((r) => r.scope === 'global').length > 0 && (
                <div className="rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
                  <div className="px-2.5 py-1 border-b border-stone-100 bg-stone-50/80 flex items-center gap-1.5">
                    <ClipboardList className="size-3 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-foreground">전역</h3>
                    <span className="text-[9px] text-muted-foreground">{isRangeMode ? formatDateLabel(date, rangeMode) : date}</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto rounded-full">
                      {dailyWithResult.filter((r) => r.scope === 'global').length}
                    </Badge>
                  </div>
                  <ResultTable
                    rows={dailyWithResult.filter((r) => r.scope === 'global')}
                    showCampaign={false}
                    showDate={isRangeMode}
                    search={searchQuery}
                    groupColor="bg-orange-50/60 text-stone-800"
                  />
                </div>
              )}
              {/* Campaign daily section */}
              {dailyWithResult.filter((r) => r.scope === 'campaign').length > 0 && (
                <div className="rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
                  <div className="px-2.5 py-1 border-b border-stone-100 bg-stone-50/80 flex items-center gap-1.5">
                    <CalendarDays className="size-3 text-muted-foreground" />
                    <h3 className="text-[10px] font-semibold text-foreground">캠페인</h3>
                    <span className="text-[9px] text-muted-foreground">{isRangeMode ? formatDateLabel(date, rangeMode) : date}</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto rounded-full">
                      {dailyWithResult.filter((r) => r.scope === 'campaign').length}
                    </Badge>
                  </div>
                  <ResultTable
                    rows={dailyWithResult.filter((r) => r.scope === 'campaign')}
                    showCampaign={true}
                    showDate={isRangeMode}
                    search={searchQuery}
                    groupColor="bg-orange-50/60 text-stone-800"
                  />
                </div>
              )}
              {/* Missing results */}
              <MissingResultsSection rows={dailyMissingResult} search={searchQuery} />
              {/* Empty state */}
              {dailyRows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-1">
                  <FileText className="size-6 opacity-30" />
                  <span className="text-xs">
                    {searchQuery ? `"${searchQuery}" 검색 결과가 없어요.` : '해당 기간에 결과값이 없어요. 업무를 완료하면 여기에 표시됩니다.'}
                  </span>
                </div>
              )}
            </TabsContent>

            {/* Periodic Tab */}
            <TabsContent value="periodic" className="space-y-3">
              <div className="rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
                <div className="px-2.5 py-1 border-b border-stone-100 bg-stone-50/80 flex items-center gap-1.5">
                  <CalendarDays className="size-3 text-muted-foreground" />
                  <h3 className="text-[10px] font-semibold text-foreground">월간/기타</h3>
                  <span className="text-[9px] text-muted-foreground">{format(parseISO(date), 'yyyy년 M월')}</span>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto rounded-full">
                    {periodicWithResult.length}
                  </Badge>
                </div>
                {periodicWithResult.length > 0 ? (
                  <ResultTable
                    rows={periodicWithResult}
                    showCampaign={true}
                    showDate={true}
                    search={searchQuery}
                    groupColor="bg-orange-50/60 text-stone-800"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-stone-400 gap-1">
                    <FileText className="size-5 opacity-30" />
                    <span className="text-[11px]">{searchQuery ? '검색 결과가 없어요.' : '이번 달 월간/기타 결과값이 아직 없어요.'}</span>
                  </div>
                )}
              </div>
              <MissingResultsSection rows={periodicMissingResult} search={searchQuery} />
            </TabsContent>

            {/* Project Tab */}
            <TabsContent value="project">
              <div className="rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
                <div className="px-2.5 py-1 border-b border-stone-100 bg-stone-50/80 flex items-center gap-1.5">
                  <FolderOpen className="size-3 text-muted-foreground" />
                  <h3 className="text-[10px] font-semibold text-foreground">프로젝트</h3>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto rounded-full">{projectResultRows.length}</Badge>
                </div>
                <ProjectResultTable rows={projectResultRows} search={searchQuery} groupColor="bg-orange-50/60 text-stone-800" />
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
