'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format, subDays, isAfter, isBefore, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  Target,
  CheckCircle2,
  Clock,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  Settings2,
  Filter,
  CalendarDays,
  CircleDashed,
  AlertCircle,
  Layers,
  ChevronRight,
  DollarSign,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { useAuth } from '@/hooks/use-auth';
import { usePresence } from '@/hooks/use-presence';
import { useRealtimeChecks } from '@/hooks/use-realtime-checks';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type {
  Campaign,
  Task,
  DailyCheck,
  User,
  TaskCategory,
  ActivityLog,
  Project,
  ProjectTask,
  CampaignConfig,
  ProjectState,
} from '@/lib/types/database';

const today = format(new Date(), 'yyyy-MM-dd');

type ViewTab = 'overview' | 'assignee' | 'campaign' | 'project';

const TAB_CONFIG: { key: ViewTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: '전체 현황', icon: Layers },
  { key: 'assignee', label: '담당자별', icon: Users },
  { key: 'campaign', label: '캠페인별', icon: Target },
  { key: 'project', label: '프로젝트별', icon: FolderKanban },
];

const PIE_COLORS = [
  'oklch(0.55 0.22 265)', 'oklch(0.65 0.18 165)', 'oklch(0.55 0.16 145)',
  'oklch(0.75 0.15 85)', 'oklch(0.6 0.2 25)', 'oklch(0.6 0.2 330)',
  'oklch(0.5 0.2 280)', 'oklch(0.7 0.14 200)', 'oklch(0.65 0.15 60)',
];

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; bar: string }> = {
  onboarding: { label: '온보딩', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50/80 dark:bg-blue-950/30', border: 'border-blue-200/60 dark:border-blue-800/40', bar: 'bg-blue-500' },
  running: { label: '운영중', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50/80 dark:bg-emerald-950/30', border: 'border-emerald-200/60 dark:border-emerald-800/40', bar: 'bg-emerald-500' },
  scaling: { label: '스케일링', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50/80 dark:bg-purple-950/30', border: 'border-purple-200/60 dark:border-purple-800/40', bar: 'bg-purple-500' },
};

const PROJECT_STATE_CONFIG: Record<ProjectState, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  '진행전': { label: '진행전', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', icon: CircleDashed },
  '진행중': { label: '진행중', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', icon: Clock },
  '완료': { label: '완료', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40', icon: CheckCircle2 },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  'insert': '생성', 'update': '수정', 'delete': '삭제',
  'check.update': '체크 수정', 'check.create': '체크 생성',
  'campaign.create': '캠페인 생성', 'campaign.update': '캠페인 수정',
  'task.create': '업무 생성', 'task.update': '업무 수정', 'config.update': '설정 변경',
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile } = useAuth();
  const { onlineUsers } = usePresence(
    'global',
    profile ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url ?? undefined } : undefined
  );
  useRealtimeChecks(today);

  // ─── View & Filter State ─────────────────────────────
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');

  // ─── Data Queries ────────────────────────────────────
  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('campaigns').select('*').order('campaign_name');
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('loop_order');
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: checks = [] } = useQuery({
    queryKey: queryKeys.checks.byDate(today),
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_checks').select('*').eq('check_date', today);
      if (error) throw error;
      return data as DailyCheck[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').eq('is_active', true);
      if (error) throw error;
      return data as User[];
    },
  });

  const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const { data: weeklyChecks = [] } = useQuery({
    queryKey: ['checks', 'weekly', sevenDaysAgo, today],
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_checks').select('*').gte('check_date', sevenDaysAgo).lte('check_date', today);
      if (error) throw error;
      return data as DailyCheck[];
    },
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ['activity-logs', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(15);
      if (error) throw error;
      return data as ActivityLog[];
    },
  });

  // NEW: Projects
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('sort_order');
      if (error) throw error;
      return data as Project[];
    },
  });

  // NEW: Project Tasks
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['projectTasks', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_tasks').select('*').order('sort_order');
      if (error) throw error;
      return data as ProjectTask[];
    },
  });

  // NEW: Campaign Configs
  const { data: campaignConfigs = [] } = useQuery({
    queryKey: queryKeys.configs.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('campaign_configs').select('*');
      if (error) throw error;
      return data as CampaignConfig[];
    },
  });

  // NEW: Monthly checks for periodic tasks overview
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const yearMonth = format(new Date(), 'yyyy-MM');

  const { data: monthlyChecks = [] } = useQuery({
    queryKey: queryKeys.checks.byMonth(yearMonth),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .gte('check_date', monthStart)
        .lte('check_date', monthEnd);
      if (error) throw error;
      return data as DailyCheck[];
    },
  });

  // ─── Core KPI Metrics ───────────────────────────────
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const applicableChecks = checks.filter((c) => c.status !== '해당없음');
  const completedChecks = applicableChecks.filter((c) => c.status === '완료');
  const pendingChecks = applicableChecks.filter((c) => c.status === '미완료');
  const completionRate = applicableChecks.length > 0 ? Math.round((completedChecks.length / applicableChecks.length) * 100) : 0;

  // ─── Monthly Fixed Cost ───────────────────────────────
  const totalMonthlyFixedCost = useMemo(() => {
    return activeCampaigns.reduce((sum, c) => sum + (c.monthly_fixed_cost ?? 0), 0);
  }, [activeCampaigns]);

  // ─── Global Tasks Stats ───────────────────────────────
  const globalTaskStats = useMemo(() => {
    const globalTasks = tasks.filter((t) => t.scope === 'global');
    const globalTaskIds = new Set(globalTasks.map((t) => t.id));
    const globalChecks = checks.filter((c) => globalTaskIds.has(c.task_id) && c.status !== '해당없음');
    const completed = globalChecks.filter((c) => c.status === '완료').length;
    const total = globalChecks.length;
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0, taskCount: globalTasks.length };
  }, [tasks, checks]);

  // ─── Periodic Tasks Stats ─────────────────────────────
  const periodicTaskStats = useMemo(() => {
    const periodicTasks = tasks.filter((t) => t.scope !== 'global' && (t.frequency === 'monthly' || t.frequency === 'once' || t.frequency === 'as_needed'));
    const periodicTaskIds = new Set(periodicTasks.map((t) => t.id));
    const periodicMonthlyChecks = monthlyChecks.filter((c) => periodicTaskIds.has(c.task_id) && c.status !== '해당없음');
    const completed = periodicMonthlyChecks.filter((c) => c.status === '완료').length;
    const total = periodicMonthlyChecks.length;
    const withResultValue = periodicMonthlyChecks.filter((c) => c.result_value).length;
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0, taskCount: periodicTasks.length, withResultValue };
  }, [tasks, monthlyChecks]);

  const yesterdayRate = useMemo(() => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const yChecks = weeklyChecks.filter((c) => c.check_date === yesterday && c.status !== '해당없음');
    const yCompleted = yChecks.filter((c) => c.status === '완료');
    return yChecks.length > 0 ? Math.round((yCompleted.length / yChecks.length) * 100) : null;
  }, [weeklyChecks]);
  const rateDiff = yesterdayRate !== null ? completionRate - yesterdayRate : null;

  // ─── Project Metrics ────────────────────────────────
  const projectStats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.state === '진행중').length;
    const completed = projects.filter((p) => p.state === '완료').length;
    const notStarted = projects.filter((p) => p.state === '진행전').length;
    const overdue = projects.filter((p) => p.due_date && p.state !== '완료' && isBefore(parseISO(p.due_date), new Date())).length;
    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter((t) => t.state === '완료').length;
    const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { total, inProgress, completed, notStarted, overdue, totalTasks, completedTasks, taskRate };
  }, [projects, projectTasks]);

  // ─── Campaign Config Setup Status ────────────────────
  const configSetupData = useMemo(() => {
    const configMap = new Map<string, { total: number; done: number }>();
    for (const cfg of campaignConfigs) {
      const existing = configMap.get(cfg.campaign_id) || { total: 0, done: 0 };
      existing.total += 1;
      if (cfg.status !== '미완료') existing.done += 1;
      configMap.set(cfg.campaign_id, existing);
    }
    return activeCampaigns.map((c) => {
      const stats = configMap.get(c.id) || { total: 0, done: 0 };
      return {
        id: c.id,
        name: c.campaign_name,
        phase: c.phase,
        total: stats.total,
        done: stats.done,
        rate: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      };
    }).sort((a, b) => a.rate - b.rate);
  }, [campaignConfigs, activeCampaigns]);

  const avgConfigRate = configSetupData.length > 0 ? Math.round(configSetupData.reduce((s, c) => s + c.rate, 0) / configSetupData.length) : 0;
  const configIncomplete = configSetupData.filter((c) => c.rate < 100).length;

  // ─── Weekly Trend ────────────────────────────────────
  const weeklyTrendData = useMemo(() => {
    const dateMap = new Map<string, { total: number; completed: number }>();
    for (let i = 6; i >= 0; i--) {
      const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dateMap.set(dateStr, { total: 0, completed: 0 });
    }
    for (const check of weeklyChecks) {
      if (check.status === '해당없음') continue;
      const existing = dateMap.get(check.check_date);
      if (existing) {
        existing.total += 1;
        if (check.status === '완료') existing.completed += 1;
      }
    }
    return Array.from(dateMap.entries()).map(([date, stats]) => ({
      date, label: format(new Date(date + 'T00:00:00'), 'MM/dd'),
      rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      completed: stats.completed, total: stats.total,
    }));
  }, [weeklyChecks]);

  // ─── Campaign Phase Distribution ─────────────────────
  const phaseDistribution = useMemo(() => {
    const counts: Record<string, number> = { onboarding: 0, running: 0, scaling: 0 };
    for (const c of activeCampaigns) { if (counts[c.phase] !== undefined) counts[c.phase] += 1; }
    return counts;
  }, [activeCampaigns]);
  const totalPhase = phaseDistribution.onboarding + phaseDistribution.running + phaseDistribution.scaling;

  // ─── Campaign Completion ─────────────────────────────
  const campaignChartData = useMemo(() => {
    const cMap = new Map<string, { total: number; completed: number }>();
    for (const check of checks) {
      if (check.status === '해당없음' || !check.campaign_id) continue;
      const existing = cMap.get(check.campaign_id) || { total: 0, completed: 0 };
      existing.total += 1;
      if (check.status === '완료') existing.completed += 1;
      cMap.set(check.campaign_id, existing);
    }
    return Array.from(cMap.entries()).map(([cid, stats]) => {
      const campaign = campaigns.find((c) => c.id === cid);
      const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      return { id: cid, name: campaign?.campaign_name ?? '알 수 없음', rate, completed: stats.completed, total: stats.total, phase: campaign?.phase ?? '' };
    }).sort((a, b) => a.rate - b.rate);
  }, [checks, campaigns]);

  const { topCampaigns, bottomCampaigns } = useMemo(() => {
    const sorted = [...campaignChartData].sort((a, b) => b.rate - a.rate);
    return {
      topCampaigns: sorted.slice(0, 5),
      bottomCampaigns: sorted.length > 5 ? sorted.slice(-5).reverse() : sorted.slice(Math.max(0, sorted.length - 5)).reverse(),
    };
  }, [campaignChartData]);

  // ─── Assignee Combined Metrics (checks + projects) ──
  const assigneeCombined = useMemo(() => {
    const userMap = new Map<string, {
      checkCompleted: number; checkInProgress: number; checkPending: number;
      projAssigned: number; projCompleted: number; taskAssigned: number; taskCompleted: number;
    }>();

    // Daily checks
    for (const check of checks) {
      if (check.status === '해당없음' || !check.assigned_user_id) continue;
      const e = userMap.get(check.assigned_user_id) || { checkCompleted: 0, checkInProgress: 0, checkPending: 0, projAssigned: 0, projCompleted: 0, taskAssigned: 0, taskCompleted: 0 };
      if (check.status === '완료') e.checkCompleted += 1;
      else if (check.status === '진행중') e.checkInProgress += 1;
      else if (check.status === '미완료') e.checkPending += 1;
      userMap.set(check.assigned_user_id, e);
    }

    // Projects
    for (const p of projects) {
      if (!p.assignee_id) continue;
      const e = userMap.get(p.assignee_id) || { checkCompleted: 0, checkInProgress: 0, checkPending: 0, projAssigned: 0, projCompleted: 0, taskAssigned: 0, taskCompleted: 0 };
      e.projAssigned += 1;
      if (p.state === '완료') e.projCompleted += 1;
      userMap.set(p.assignee_id, e);
    }

    // Project tasks
    for (const t of projectTasks) {
      if (!t.assignee_id) continue;
      const e = userMap.get(t.assignee_id) || { checkCompleted: 0, checkInProgress: 0, checkPending: 0, projAssigned: 0, projCompleted: 0, taskAssigned: 0, taskCompleted: 0 };
      e.taskAssigned += 1;
      if (t.state === '완료') e.taskCompleted += 1;
      userMap.set(t.assignee_id, e);
    }

    return Array.from(userMap.entries()).map(([userId, stats]) => {
      const user = users.find((u) => u.id === userId);
      const checkTotal = stats.checkCompleted + stats.checkInProgress + stats.checkPending;
      const checkRate = checkTotal > 0 ? Math.round((stats.checkCompleted / checkTotal) * 100) : 0;
      return { userId, name: user?.name ?? '알 수 없음', avatar: user?.avatar_url, ...stats, checkTotal, checkRate };
    }).sort((a, b) => b.checkRate - a.checkRate);
  }, [checks, projects, projectTasks, users]);

  // ─── Category Donut ──────────────────────────────────
  const categoryData = useMemo(() => {
    const taskCatMap = new Map<string, TaskCategory>();
    for (const t of tasks) taskCatMap.set(t.id, t.category);
    const catCounts = new Map<TaskCategory, number>();
    for (const check of checks) {
      if (check.status === '해당없음') continue;
      const cat = taskCatMap.get(check.task_id);
      if (cat) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    return CATEGORY_ORDER.filter((cat) => (catCounts.get(cat) || 0) > 0).map((cat) => ({ name: cat, value: catCounts.get(cat) || 0 }));
  }, [checks, tasks]);

  // ─── Pending Alerts ──────────────────────────────────
  const pendingAlerts = useMemo(() => {
    return checks.filter((c) => c.status === '미완료').map((check) => {
      const campaign = campaigns.find((c) => c.id === check.campaign_id);
      const task = tasks.find((t) => t.id === check.task_id);
      const user = check.assigned_user_id ? users.find((u) => u.id === check.assigned_user_id) : null;
      return { id: check.id, campaignName: campaign?.campaign_name ?? '-', taskName: task?.task_name ?? '-', assignee: user?.name ?? '미배정', category: task?.category ?? '보고' as TaskCategory };
    }).slice(0, 20);
  }, [checks, campaigns, tasks, users]);

  // ─── Overdue Projects/Tasks ──────────────────────────
  const overdueItems = useMemo(() => {
    const items: { type: string; name: string; assignee: string; dueDate: string; parentName?: string }[] = [];
    const todayDate = new Date();
    for (const p of projects) {
      if (p.due_date && p.state !== '완료' && isBefore(parseISO(p.due_date), todayDate)) {
        const user = p.assignee_id ? users.find((u) => u.id === p.assignee_id) : null;
        items.push({ type: '프로젝트', name: p.project_name, assignee: user?.name ?? '미배정', dueDate: p.due_date });
      }
    }
    for (const t of projectTasks) {
      if (t.due_date && t.state !== '완료' && isBefore(parseISO(t.due_date), todayDate)) {
        const user = t.assignee_id ? users.find((u) => u.id === t.assignee_id) : null;
        const proj = projects.find((p) => p.id === t.project_id);
        items.push({ type: '하위업무', name: t.title, assignee: user?.name ?? '미배정', dueDate: t.due_date, parentName: proj?.project_name });
      }
    }
    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [projects, projectTasks, users]);

  // ─── Per-project progress (for project tab) ──────────
  const projectProgress = useMemo(() => {
    const taskMap = new Map<string, ProjectTask[]>();
    for (const t of projectTasks) {
      const arr = taskMap.get(t.project_id) || [];
      arr.push(t);
      taskMap.set(t.project_id, arr);
    }
    return projects.map((p) => {
      const pts = taskMap.get(p.id) || [];
      const total = pts.length;
      const done = pts.filter((t) => t.state === '완료').length;
      const inProg = pts.filter((t) => t.state === '진행중').length;
      const user = p.assignee_id ? users.find((u) => u.id === p.assignee_id) : null;
      const isOverdue = p.due_date && p.state !== '완료' && isBefore(parseISO(p.due_date), new Date());
      return { ...p, tasks: pts, taskTotal: total, taskDone: done, taskInProg: inProg, taskRate: total > 0 ? Math.round((done / total) * 100) : (p.state === '완료' ? 100 : 0), assigneeName: user?.name ?? '미배정', isOverdue };
    });
  }, [projects, projectTasks, users]);

  // ─── Helpers ──────────────────────────────────────────
  const getBarColor = (rate: number) => {
    if (rate >= 80) return 'oklch(0.6 0.18 155)';
    if (rate >= 50) return 'oklch(0.7 0.15 85)';
    return 'oklch(0.6 0.2 25)';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후에요';
    return '좋은 저녁이에요';
  };

  const userNameForLog = (userId: string | null) => {
    if (!userId) return '시스템';
    return users.find((u) => u.id === userId)?.name ?? '알 수 없음';
  };

  const formatLogTime = (createdAt: string) => {
    try { return format(new Date(createdAt), 'MM/dd HH:mm'); } catch { return '-'; }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-5">
      {/* ─── Header ─── */}
      <motion.div variants={fadeUpItem} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">{profile?.name ?? '사용자'}</span>님
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{format(new Date(), 'yyyy년 MM월 dd일')} 기준 실시간 현황</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{onlineUsers.length}명 접속 중</span>
          </div>
        </div>
      </motion.div>

      {/* ─── Tab Navigation ─── */}
      <motion.div variants={fadeUpItem}>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border w-fit">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeTab === key
                  ? 'bg-background shadow-sm text-foreground border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ═══ OVERVIEW TAB ═══ */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
            {/* KPI Cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
              {/* Active campaigns */}
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/20 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">활성 캠페인</span>
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{activeCampaigns.length}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">전체 {campaigns.length}개</p>
                </CardContent>
              </Card>

              {/* Completion rate */}
              <Card className={cn('relative overflow-hidden border-0 shadow-sm',
                completionRate >= 80 ? 'bg-gradient-to-br from-emerald-50 to-green-50/50 dark:from-emerald-950/40 dark:to-green-950/20'
                : completionRate >= 50 ? 'bg-gradient-to-br from-amber-50 to-yellow-50/50 dark:from-amber-950/40 dark:to-yellow-950/20'
                : 'bg-gradient-to-br from-red-50 to-orange-50/50 dark:from-red-950/40 dark:to-orange-950/20'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center',
                      completionRate >= 80 ? 'bg-emerald-500/15' : completionRate >= 50 ? 'bg-amber-500/15' : 'bg-red-500/15'
                    )}>
                      <CheckCircle2 className={cn('h-3.5 w-3.5',
                        completionRate >= 80 ? 'text-emerald-600' : completionRate >= 50 ? 'text-amber-600' : 'text-red-600'
                      )} />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">오늘 완료율</span>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span className={cn('text-2xl font-bold tracking-tight',
                      completionRate >= 80 ? 'text-emerald-600' : completionRate >= 50 ? 'text-amber-600' : 'text-red-600'
                    )}>{completionRate}%</span>
                    {rateDiff !== null && rateDiff !== 0 && (
                      <span className={cn('text-[10px] font-medium flex items-center mb-1', rateDiff > 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {rateDiff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(rateDiff)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{completedChecks.length}/{applicableChecks.length} 완료</p>
                </CardContent>
              </Card>

              {/* Projects in progress */}
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-violet-50/50 dark:from-purple-950/40 dark:to-violet-950/20 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                      <FolderKanban className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">진행중 프로젝트</span>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-purple-700 dark:text-purple-300">{projectStats.inProgress}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">전체 {projectStats.total}개 · 완료 {projectStats.completed}개</p>
                </CardContent>
              </Card>

              {/* Pending */}
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/20 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">미완료 항목</span>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{pendingChecks.length}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">오늘 남은 업무</p>
                </CardContent>
              </Card>

              {/* Config setup */}
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-cyan-50 to-teal-50/50 dark:from-cyan-950/40 dark:to-teal-950/20 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                      <Settings2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">캠페인 세팅률</span>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-cyan-700 dark:text-cyan-300">{avgConfigRate}%</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{configIncomplete}개 미완료</p>
                </CardContent>
              </Card>

              {/* Monthly Fixed Cost */}
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">월 고정비용</span>
                  </div>
                  <div className="text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                    {totalMonthlyFixedCost > 0 ? `${(totalMonthlyFixedCost / 10000).toFixed(0)}만` : '-'}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">활성 {activeCampaigns.length}개 캠페인 합산</p>
                </CardContent>
              </Card>
            </div>

            {/* Global + Periodic Tasks Overview */}
            <div className="grid gap-3 lg:grid-cols-2">
              {/* Global Tasks */}
              <Card className="shadow-sm border-0 bg-gradient-to-r from-background to-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center">
                      <Globe className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <span className="text-sm font-semibold">전역 업무</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                      {globalTaskStats.taskCount}개 업무
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">오늘 완료율</span>
                        <span className={cn('text-sm font-bold',
                          globalTaskStats.rate >= 80 ? 'text-emerald-600' : globalTaskStats.rate >= 50 ? 'text-amber-600' : 'text-red-500'
                        )}>{globalTaskStats.rate}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all',
                            globalTaskStats.rate >= 80 ? 'bg-emerald-500' : globalTaskStats.rate >= 50 ? 'bg-amber-400' : 'bg-red-400'
                          )}
                          style={{ width: `${globalTaskStats.rate}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{globalTaskStats.completed}/{globalTaskStats.total} 완료</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Periodic Tasks */}
              <Card className="shadow-sm border-0 bg-gradient-to-r from-background to-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                      <CalendarDays className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                    <span className="text-sm font-semibold">월간/주기별 업무</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                      {periodicTaskStats.taskCount}개 업무
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">{format(new Date(), 'MM월')} 완료율</span>
                        <span className={cn('text-sm font-bold',
                          periodicTaskStats.rate >= 80 ? 'text-emerald-600' : periodicTaskStats.rate >= 50 ? 'text-amber-600' : 'text-red-500'
                        )}>{periodicTaskStats.rate}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all',
                            periodicTaskStats.rate >= 80 ? 'bg-emerald-500' : periodicTaskStats.rate >= 50 ? 'bg-amber-400' : 'bg-red-400'
                          )}
                          style={{ width: `${periodicTaskStats.rate}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] text-muted-foreground">{periodicTaskStats.completed}/{periodicTaskStats.total} 완료</p>
                        {periodicTaskStats.withResultValue > 0 && (
                          <p className="text-[10px] text-indigo-600">결과값 {periodicTaskStats.withResultValue}건</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Phase Distribution */}
            <Card className="shadow-sm border-0 bg-gradient-to-r from-background to-muted/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center"><Zap className="h-3.5 w-3.5 text-purple-500" /></div>
                  캠페인 단계별 분포
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-3">
                  {(['onboarding', 'running', 'scaling'] as const).map((phase) => {
                    const config = PHASE_CONFIG[phase];
                    const count = phaseDistribution[phase];
                    const pct = totalPhase > 0 ? Math.round((count / totalPhase) * 100) : 0;
                    return (
                      <div key={phase} className={cn('rounded-xl border p-4 transition-all hover:scale-[1.02]', config.bg, config.border)}>
                        <p className={cn('text-[11px] font-semibold uppercase tracking-wider', config.color)}>{config.label}</p>
                        <p className={cn('text-2xl font-bold mt-1', config.color)}>{count}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-700', config.bar)} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Charts Row: Weekly Trend + Category Donut */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center"><TrendingUp className="h-3.5 w-3.5 text-blue-500" /></div>
                    주간 완료율 추이
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {weeklyTrendData.every((d) => d.total === 0) ? (
                    <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">데이터가 없습니다</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0 0 / 40%)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                        <RechartsTooltip
                          formatter={(value, _name, props) => {
                            const payload = props?.payload as { completed?: number; total?: number } | undefined;
                            return [`${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`, '완료율'];
                          }}
                          contentStyle={{ borderRadius: '10px', border: '1px solid oklch(0.9 0 0)', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="rate" stroke="oklch(0.55 0.22 265)" strokeWidth={2.5} fill="url(#colorRate)"
                          dot={{ fill: 'oklch(0.55 0.22 265)', r: 4, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, fill: 'oklch(0.45 0.2 265)' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">카테고리별 업무</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">데이터가 없습니다</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name"
                          label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {categoryData.map((entry, idx) => (
                            <Cell key={entry.name} fill={PIE_COLORS[CATEGORY_ORDER.indexOf(entry.name as TaskCategory) % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [`${value}건`, '업무 수']} contentStyle={{ borderRadius: '10px', border: '1px solid oklch(0.9 0 0)', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Project Progress + Config Setup */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Project Progress */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center"><FolderKanban className="h-3.5 w-3.5 text-purple-500" /></div>
                      프로젝트 진행 현황
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={() => setActiveTab('project')}>
                      자세히 <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {(['진행전', '진행중', '완료'] as ProjectState[]).map((state) => {
                      const cfg = PROJECT_STATE_CONFIG[state];
                      const Icon = cfg.icon;
                      const count = state === '진행전' ? projectStats.notStarted : state === '진행중' ? projectStats.inProgress : projectStats.completed;
                      return (
                        <div key={state} className={cn('rounded-lg p-3 text-center', cfg.bg)}>
                          <Icon className={cn('size-4 mx-auto mb-1', cfg.color)} />
                          <p className={cn('text-lg font-bold', cfg.color)}>{count}</p>
                          <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                        </div>
                      );
                    })}
                  </div>
                  {projectStats.overdue > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 mb-3">
                      <AlertCircle className="size-3.5 text-red-500 shrink-0" />
                      <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">마감 초과 프로젝트 {projectStats.overdue}개</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {projectProgress.filter((p) => p.state === '진행중').slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-[11px] font-medium truncate flex-1 min-w-0">{p.project_name}</span>
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                          <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${p.taskRate}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-purple-600 tabular-nums w-8 text-right">{p.taskRate}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Config Setup Status */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-cyan-500/10 flex items-center justify-center"><Settings2 className="h-3.5 w-3.5 text-cyan-500" /></div>
                    캠페인 세팅 현황
                    {configIncomplete > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{configIncomplete}개 미완료</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px]">
                    {configSetupData.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">세팅 데이터가 없습니다</div>
                    ) : (
                      <div className="space-y-2.5">
                        {configSetupData.map((c) => (
                          <div key={c.id} className="flex items-center gap-3 group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium truncate">{c.name}</span>
                                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                  <Badge variant="outline" className={cn('text-[9px] px-1 py-0', PHASE_CONFIG[c.phase]?.color ?? '')}>{PHASE_CONFIG[c.phase]?.label ?? c.phase}</Badge>
                                  <span className={cn('text-[10px] font-bold tabular-nums', c.rate >= 100 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600')}>{c.rate}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all duration-500', c.rate >= 100 ? 'bg-emerald-500' : c.rate >= 50 ? 'bg-amber-500' : 'bg-red-400')} style={{ width: `${c.rate}%` }} />
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-0.5">{c.done}/{c.total} 항목 완료</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Campaign Bar Chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center"><BarChart3 className="h-3.5 w-3.5 text-indigo-500" /></div>
                  캠페인별 완료율
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaignChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">데이터가 없습니다</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(250, campaignChartData.length * 30)}>
                    <BarChart data={campaignChartData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.85 0 0 / 40%)" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        formatter={(value, _name, props) => {
                          const payload = props?.payload as { completed?: number; total?: number } | undefined;
                          return [`${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`, '완료율'];
                        }}
                        contentStyle={{ borderRadius: '10px', border: '1px solid oklch(0.9 0 0)', fontSize: '12px' }}
                      />
                      <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={20}>
                        {campaignChartData.map((entry, idx) => (<Cell key={idx} fill={getBarColor(entry.rate)} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Rankings + Activity + Overdue */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Rankings */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /></div>
                    캠페인 순위
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {campaignChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">데이터 없음</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-600 mb-2 flex items-center gap-1 uppercase tracking-wider"><TrendingUp className="h-3 w-3" />상위 5</p>
                        <div className="space-y-2">
                          {topCampaigns.map((c, i) => (
                            <div key={`t-${i}`} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground/50 w-3 text-right tabular-nums">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-medium truncate">{c.name}</span>
                                  <span className={cn('text-[10px] font-bold ml-1 tabular-nums', c.rate >= 80 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600')}>{c.rate}%</span>
                                </div>
                                <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${c.rate}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border-t pt-3">
                        <p className="text-[10px] font-semibold text-red-600 mb-2 flex items-center gap-1 uppercase tracking-wider"><TrendingDown className="h-3 w-3" />하위 5</p>
                        <div className="space-y-2">
                          {bottomCampaigns.map((c, i) => (
                            <div key={`b-${i}`} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground/50 w-3 text-right tabular-nums">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-medium truncate">{c.name}</span>
                                  <span className={cn('text-[10px] font-bold ml-1 tabular-nums', c.rate >= 80 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600')}>{c.rate}%</span>
                                </div>
                                <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                                  <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${c.rate}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center"><Activity className="h-3.5 w-3.5 text-indigo-500" /></div>
                    최근 활동
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[360px]">
                    {activityLogs.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">활동 없음</div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[6px] top-2 bottom-2 w-px bg-border" />
                        <div className="space-y-3">
                          {activityLogs.map((log) => (
                            <div key={log.id} className="flex gap-2.5 relative group">
                              <div className="relative z-10 mt-1.5">
                                <div className="h-3 w-3 rounded-full border-2 border-primary/40 bg-background group-hover:border-primary transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0 pb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-medium">{userNameForLog(log.user_id)}</span>
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal">{ACTION_TYPE_LABELS[log.action_type] ?? log.action_type}</Badge>
                                </div>
                                {log.target_table && <p className="text-[10px] text-muted-foreground truncate">{log.target_table}{log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}</p>}
                                <p className="text-[9px] text-muted-foreground/60 tabular-nums">{formatLogTime(log.created_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Overdue + Pending Alerts */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-red-500/10 flex items-center justify-center"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /></div>
                    긴급 알림
                    {(overdueItems.length + pendingAlerts.length) > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{overdueItems.length + pendingAlerts.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[360px]">
                    {overdueItems.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-red-600 mb-1.5 uppercase tracking-wider">마감 초과</p>
                        <div className="space-y-1">
                          {overdueItems.slice(0, 8).map((item, i) => (
                            <div key={`od-${i}`} className="p-2 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-200/30 dark:border-red-800/20">
                              <p className="text-[11px] font-medium truncate">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-600 border-red-200">{item.type}</Badge>
                                <span className="text-[9px] text-muted-foreground">{item.assignee}</span>
                                <span className="text-[9px] text-red-500 ml-auto tabular-nums">{item.dueDate}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {pendingAlerts.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-600 mb-1.5 uppercase tracking-wider">미완료 업무</p>
                        <div className="space-y-1">
                          {pendingAlerts.slice(0, 10).map((alert) => (
                            <div key={alert.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/30 cursor-pointer transition-all" onClick={() => router.push('/view/campaign')}>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium truncate">{alert.taskName}</p>
                                <p className="text-[9px] text-muted-foreground truncate">{alert.campaignName}</p>
                              </div>
                              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                <Badge variant="outline" className={cn('text-[9px] px-1 py-0', CATEGORY_COLORS[alert.category]?.text ?? '', CATEGORY_COLORS[alert.category]?.bg ?? '')}>{alert.category}</Badge>
                                <span className="text-[9px] text-muted-foreground">{alert.assignee}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {overdueItems.length === 0 && pendingAlerts.length === 0 && (
                      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">긴급 항목 없음</div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Assignee Summary */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center"><Users className="h-3.5 w-3.5 text-indigo-500" /></div>
                    담당자별 현황 (일일 체크 + 프로젝트)
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={() => setActiveTab('assignee')}>
                    자세히 <ChevronRight className="size-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">이름</TableHead>
                      <TableHead className="text-center text-[11px]">체크 완료</TableHead>
                      <TableHead className="text-center text-[11px]">체크 진행</TableHead>
                      <TableHead className="text-center text-[11px]">체크 미완</TableHead>
                      <TableHead className="text-center text-[11px]">프로젝트</TableHead>
                      <TableHead className="text-center text-[11px]">하위업무</TableHead>
                      <TableHead className="text-center text-[11px]">완료율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assigneeCombined.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground text-sm">데이터가 없습니다</TableCell></TableRow>
                    ) : (
                      assigneeCombined.map((row) => (
                        <TableRow key={row.userId}>
                          <TableCell className="font-medium text-[12px]">{row.name}</TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">{row.checkCompleted}</Badge></TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">{row.checkInProgress}</Badge></TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px]">{row.checkPending}</Badge></TableCell>
                          <TableCell className="text-center"><span className="text-[11px] text-muted-foreground">{row.projCompleted}/{row.projAssigned}</span></TableCell>
                          <TableCell className="text-center"><span className="text-[11px] text-muted-foreground">{row.taskCompleted}/{row.taskAssigned}</span></TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all', row.checkRate >= 80 ? 'bg-emerald-500' : row.checkRate >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${row.checkRate}%` }} />
                              </div>
                              <span className={cn('text-[10px] font-semibold tabular-nums', row.checkRate >= 80 ? 'text-emerald-600' : row.checkRate >= 50 ? 'text-amber-600' : 'text-red-600')}>{row.checkRate}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ ASSIGNEE TAB ═══ */}
        {activeTab === 'assignee' && (
          <motion.div key="assignee" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground" />
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="담당자 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 담당자</SelectItem>
                  {users.filter((u) => u.is_active).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assigneeCombined.filter((a) => assigneeFilter === 'all' || a.userId === assigneeFilter).map((a) => (
                <Card key={a.userId} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        {a.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">체크 완료율 {a.checkRate}%</p>
                      </div>
                      <div className={cn('ml-auto h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border-2',
                        a.checkRate >= 80 ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                        : a.checkRate >= 50 ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                        : 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20'
                      )}>
                        {a.checkRate}%
                      </div>
                    </div>

                    {/* Daily checks */}
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">일일 체크</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/20">
                          <p className="text-lg font-bold text-emerald-600">{a.checkCompleted}</p>
                          <p className="text-[9px] text-muted-foreground">완료</p>
                        </div>
                        <div className="text-center p-1.5 rounded bg-amber-50 dark:bg-amber-950/20">
                          <p className="text-lg font-bold text-amber-600">{a.checkInProgress}</p>
                          <p className="text-[9px] text-muted-foreground">진행중</p>
                        </div>
                        <div className="text-center p-1.5 rounded bg-red-50 dark:bg-red-950/20">
                          <p className="text-lg font-bold text-red-600">{a.checkPending}</p>
                          <p className="text-[9px] text-muted-foreground">미완료</p>
                        </div>
                      </div>
                    </div>

                    {/* Projects & Tasks */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">프로젝트 & 업무</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-1.5 rounded bg-purple-50 dark:bg-purple-950/20">
                          <FolderKanban className="size-3.5 text-purple-500" />
                          <div>
                            <p className="text-xs font-semibold text-purple-600">{a.projCompleted}/{a.projAssigned}</p>
                            <p className="text-[9px] text-muted-foreground">프로젝트</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 rounded bg-blue-50 dark:bg-blue-950/20">
                          <CheckCircle2 className="size-3.5 text-blue-500" />
                          <div>
                            <p className="text-xs font-semibold text-blue-600">{a.taskCompleted}/{a.taskAssigned}</p>
                            <p className="text-[9px] text-muted-foreground">하위업무</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ CAMPAIGN TAB ═══ */}
        {activeTab === 'campaign' && (
          <motion.div key="campaign" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground" />
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="캠페인 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 캠페인</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campaign Cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaignChartData
                .filter((c) => campaignFilter === 'all' || c.id === campaignFilter)
                .sort((a, b) => b.rate - a.rate)
                .map((c) => {
                  const campaign = campaigns.find((cm) => cm.id === c.id);
                  const cfgData = configSetupData.find((cfg) => cfg.id === c.id);
                  return (
                    <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{c.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {campaign?.phase && <Badge variant="outline" className={cn('text-[9px] px-1 py-0', PHASE_CONFIG[campaign.phase]?.color ?? '')}>{PHASE_CONFIG[campaign.phase]?.label ?? campaign.phase}</Badge>}
                              <Badge variant={campaign?.status === 'active' ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                                {campaign?.status === 'active' ? '활성' : campaign?.status === 'paused' ? '일시중지' : '완료'}
                              </Badge>
                            </div>
                          </div>
                          <div className={cn('h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold border-[3px]',
                            c.rate >= 80 ? 'border-emerald-500 text-emerald-600' : c.rate >= 50 ? 'border-amber-500 text-amber-600' : 'border-red-500 text-red-600'
                          )}>
                            {c.rate}%
                          </div>
                        </div>

                        {/* Today's check progress */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">오늘 업무 완료</span>
                            <span className="text-[10px] font-medium">{c.completed}/{c.total}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', c.rate >= 80 ? 'bg-emerald-500' : c.rate >= 50 ? 'bg-amber-500' : 'bg-red-400')} style={{ width: `${c.rate}%` }} />
                          </div>
                        </div>

                        {/* Config setup */}
                        {cfgData && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Settings2 className="size-3" />세팅 완료</span>
                              <span className={cn('text-[10px] font-medium', cfgData.rate >= 100 ? 'text-emerald-600' : 'text-amber-600')}>{cfgData.done}/{cfgData.total}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', cfgData.rate >= 100 ? 'bg-cyan-500' : cfgData.rate >= 50 ? 'bg-cyan-400' : 'bg-cyan-300')} style={{ width: `${cfgData.rate}%` }} />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* ═══ PROJECT TAB ═══ */}
        {activeTab === 'project' && (
          <motion.div key="project" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="border-0 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/40 dark:to-gray-800/20 shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold">{projectStats.total}</p>
                  <p className="text-[10px] text-muted-foreground">전체</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/40 dark:to-gray-800/20 shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-gray-500">{projectStats.notStarted}</p>
                  <p className="text-[10px] text-muted-foreground">진행전</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{projectStats.inProgress}</p>
                  <p className="text-[10px] text-muted-foreground">진행중</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{projectStats.completed}</p>
                  <p className="text-[10px] text-muted-foreground">완료</p>
                </CardContent>
              </Card>
              <Card className={cn('border-0 shadow-sm', projectStats.overdue > 0
                ? 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20'
                : 'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/40 dark:to-gray-800/20'
              )}>
                <CardContent className="p-3 text-center">
                  <p className={cn('text-2xl font-bold', projectStats.overdue > 0 ? 'text-red-600' : 'text-gray-400')}>{projectStats.overdue}</p>
                  <p className="text-[10px] text-muted-foreground">마감 초과</p>
                </CardContent>
              </Card>
            </div>

            {/* Project List */}
            <div className="space-y-3">
              {projectProgress.map((p) => (
                <Card key={p.id} className={cn('shadow-sm hover:shadow-md transition-shadow cursor-pointer', p.isOverdue && 'border-red-200 dark:border-red-800/40')}
                  onClick={() => router.push(`/roadmap/${p.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* State icon */}
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', PROJECT_STATE_CONFIG[p.state].bg)}>
                        {(() => { const Icon = PROJECT_STATE_CONFIG[p.state].icon; return <Icon className={cn('size-4', PROJECT_STATE_CONFIG[p.state].color)} />; })()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold truncate">{p.project_name}</h3>
                          {p.isOverdue && <Badge variant="destructive" className="text-[9px] px-1 py-0">마감초과</Badge>}
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                          <span className="flex items-center gap-1"><Users className="size-3" />{p.assigneeName}</span>
                          {p.start_date && <span className="flex items-center gap-1"><CalendarDays className="size-3" />{p.start_date}</span>}
                          {p.due_date && <span className={cn('flex items-center gap-1', p.isOverdue ? 'text-red-500 font-medium' : '')}><CalendarDays className="size-3" />~{p.due_date}</span>}
                        </div>

                        {/* Task progress */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all',
                              p.taskRate >= 80 ? 'bg-emerald-500' : p.taskRate >= 50 ? 'bg-blue-500' : 'bg-gray-400'
                            )} style={{ width: `${p.taskRate}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{p.taskDone}/{p.taskTotal} 완료</span>
                          <span className={cn('text-[10px] font-bold tabular-nums',
                            p.taskRate >= 80 ? 'text-emerald-600' : p.taskRate >= 50 ? 'text-blue-600' : 'text-gray-500'
                          )}>{p.taskRate}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {projectProgress.length === 0 && (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">프로젝트가 없습니다</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
