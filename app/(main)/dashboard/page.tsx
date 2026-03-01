'use client';

import { useState, useMemo, lazy, Suspense } from 'react';
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
  Bot,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiCommandCenter } from '@/components/ai/ai-command-center';
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
  CampaignPlatformWithRelations,
  BrandPhase,
} from '@/lib/types/database';

const today = format(new Date(), 'yyyy-MM-dd');

type ViewTab = 'overview' | 'assignee' | 'campaign' | 'project';

const TAB_CONFIG: { key: ViewTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: '전체 현황', icon: Layers },
  { key: 'assignee', label: '담당자별', icon: Users },
  { key: 'campaign', label: '캠페인별', icon: Target },
  { key: 'project', label: '프로젝트별', icon: FolderKanban },
];

const CHART_COLORS = ['#0a0a0a', '#404040', '#737373', '#a3a3a3', '#d4d4d4'];

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; bar: string }> = {
  onboarding: { label: '온보딩', color: 'text-neutral-700 dark:text-neutral-300', bg: 'bg-neutral-50 dark:bg-neutral-900/30', border: 'border-neutral-200 dark:border-neutral-800', bar: 'bg-neutral-500' },
  running: { label: '운영중', color: 'text-neutral-700 dark:text-neutral-300', bg: 'bg-neutral-100/80 dark:bg-neutral-800/30', border: 'border-neutral-300 dark:border-neutral-700', bar: 'bg-neutral-700' },
  scaling: { label: '스케일링', color: 'text-neutral-700 dark:text-neutral-300', bg: 'bg-neutral-50 dark:bg-neutral-900/30', border: 'border-neutral-200 dark:border-neutral-800', bar: 'bg-neutral-900 dark:bg-neutral-100' },
};

const PROJECT_STATE_CONFIG: Record<ProjectState, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  '진행전': { label: '진행전', color: 'text-neutral-500 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800', icon: CircleDashed },
  '진행중': { label: '진행중', color: 'text-neutral-700 dark:text-neutral-300', bg: 'bg-neutral-200/60 dark:bg-neutral-700/40', icon: Clock },
  '완료': { label: '완료', color: 'text-foreground', bg: 'bg-foreground/10', icon: CheckCircle2 },
};

const BRAND_PHASE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  '기획': { label: '기획', color: 'text-neutral-600', bg: 'bg-neutral-100 dark:bg-neutral-800' },
  '플랫폼세팅': { label: '플랫폼세팅', color: 'text-neutral-700', bg: 'bg-neutral-200/60 dark:bg-neutral-700/40' },
  '인플루언서기획': { label: '인플기획', color: 'text-neutral-700', bg: 'bg-neutral-200/60 dark:bg-neutral-700/40' },
  '운영': { label: '운영', color: 'text-foreground', bg: 'bg-foreground/10' },
  '스케일링': { label: '스케일링', color: 'text-foreground', bg: 'bg-foreground/10' },
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
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

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

  // NEW: Campaign Platforms (Brand)
  const { data: campaignPlatforms = [] } = useQuery({
    queryKey: queryKeys.campaignPlatforms.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_platforms')
        .select('*, ecommerce_platforms(*)')
        .order('created_at');
      if (error) throw error;
      return data as CampaignPlatformWithRelations[];
    },
    staleTime: 2 * 60 * 1000,
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
    // Exclude parent tasks that have sub-tasks (to avoid double-counting checks)
    const parentIdsWithChildren = new Set(periodicTasks.filter((t) => t.parent_task_id).map((t) => t.parent_task_id!));
    const countableTasks = periodicTasks.filter((t) => !parentIdsWithChildren.has(t.id));
    const periodicTaskIds = new Set(countableTasks.map((t) => t.id));
    const periodicMonthlyChecks = monthlyChecks.filter((c) => periodicTaskIds.has(c.task_id) && c.status !== '해당없음');
    const completed = periodicMonthlyChecks.filter((c) => c.status === '완료').length;
    const total = periodicMonthlyChecks.length;
    const withResultValue = periodicMonthlyChecks.filter((c) => c.result_value).length;
    // taskCount: show top-level tasks only (excluding sub-tasks for display)
    const topLevelCount = periodicTasks.filter((t) => !t.parent_task_id).length;
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0, taskCount: topLevelCount, withResultValue };
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

  // ─── Brand Campaign Stats ─────────────────────────
  const brandCampaignStats = useMemo(() => {
    const brandCampaigns = campaigns.filter((c) => c.campaign_type === '제품브랜드');
    const activeBrands = brandCampaigns.filter((c) => c.status === 'active');
    const brandIds = new Set(brandCampaigns.map((c) => c.id));
    const brandPlatforms = campaignPlatforms.filter((cp) => brandIds.has(cp.campaign_id));
    const completedPlatforms = brandPlatforms.filter((cp) => cp.setup_status === '완료').length;
    const totalPlatforms = brandPlatforms.length;
    const setupRate = totalPlatforms > 0 ? Math.round((completedPlatforms / totalPlatforms) * 100) : 0;

    // Country distribution
    const countryCounts = new Map<string, number>();
    for (const c of brandCampaigns) {
      for (const country of (c.target_countries ?? [])) {
        countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
      }
    }
    const countryDistribution = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // Phase distribution
    const phaseCounts = new Map<string, number>();
    for (const c of activeBrands) {
      const phase = c.brand_phase ?? '기획';
      phaseCounts.set(phase, (phaseCounts.get(phase) || 0) + 1);
    }

    // Platform distribution
    const platformCounts = new Map<string, number>();
    for (const cp of brandPlatforms) {
      const name = cp.ecommerce_platforms?.platform_name ?? '알 수 없음';
      platformCounts.set(name, (platformCounts.get(name) || 0) + 1);
    }
    const platformDistribution = Array.from(platformCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: brandCampaigns.length,
      active: activeBrands.length,
      totalPlatforms,
      completedPlatforms,
      setupRate,
      countryDistribution,
      phaseCounts,
      platformDistribution,
    };
  }, [campaigns, campaignPlatforms]);

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
  // Uses task.default_assignees (actual assignees) instead of check.assigned_user_id (login user)
  const assigneeCombined = useMemo(() => {
    // Build name→userId map for resolving task.default_assignees names to user IDs
    const nameToUserId = new Map<string, string>();
    for (const u of users) nameToUserId.set(u.name, u.id);

    // Build taskId→Task map
    const taskById = new Map<string, Task>();
    for (const t of tasks) taskById.set(t.id, t);

    const statsMap = new Map<string, {
      checkCompleted: number; checkInProgress: number; checkPending: number;
      projAssigned: number; projCompleted: number; taskAssigned: number; taskCompleted: number;
    }>();
    const emptyStats = () => ({ checkCompleted: 0, checkInProgress: 0, checkPending: 0, projAssigned: 0, projCompleted: 0, taskAssigned: 0, taskCompleted: 0 });

    // Daily checks → resolve via task.default_assignees
    for (const check of checks) {
      if (check.status === '해당없음') continue;
      const task = taskById.get(check.task_id);
      const assigneeNames = task?.default_assignees;
      if (!assigneeNames || assigneeNames.length === 0) continue;

      for (const name of assigneeNames) {
        const userId = nameToUserId.get(name);
        if (!userId) continue;
        const e = statsMap.get(userId) || emptyStats();
        if (check.status === '완료') e.checkCompleted += 1;
        else if (check.status === '진행중') e.checkInProgress += 1;
        else if (check.status === '미완료') e.checkPending += 1;
        statsMap.set(userId, e);
      }
    }

    // Projects
    for (const p of projects) {
      if (!p.assignee_id) continue;
      const e = statsMap.get(p.assignee_id) || emptyStats();
      e.projAssigned += 1;
      if (p.state === '완료') e.projCompleted += 1;
      statsMap.set(p.assignee_id, e);
    }

    // Project tasks
    for (const t of projectTasks) {
      if (!t.assignee_id) continue;
      const e = statsMap.get(t.assignee_id) || emptyStats();
      e.taskAssigned += 1;
      if (t.state === '완료') e.taskCompleted += 1;
      statsMap.set(t.assignee_id, e);
    }

    return Array.from(statsMap.entries()).map(([userId, stats]) => {
      const user = users.find((u) => u.id === userId);
      const checkTotal = stats.checkCompleted + stats.checkInProgress + stats.checkPending;
      const checkRate = checkTotal > 0 ? Math.round((stats.checkCompleted / checkTotal) * 100) : 0;
      return { userId, name: user?.name ?? '알 수 없음', avatar: user?.avatar_url, ...stats, checkTotal, checkRate };
    }).sort((a, b) => b.checkRate - a.checkRate);
  }, [checks, projects, projectTasks, users, tasks]);

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
      const assignee = task?.default_assignees?.join(', ') ?? '미배정';
      return { id: check.id, campaignName: campaign?.campaign_name ?? '-', taskName: task?.task_name ?? '-', assignee, category: task?.category ?? '보고' as TaskCategory };
    }).slice(0, 20);
  }, [checks, campaigns, tasks]);

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
    if (rate >= 80) return '#0a0a0a';
    if (rate >= 50) return '#737373';
    return '#d4d4d4';
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
    <>
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-5">
      {/* ─── Header ─── */}
      <motion.div variants={fadeUpItem} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">오늘의 업무 현황, 한눈에 보여줄게.</h1>
          <p className="text-sm text-muted-foreground mt-1">실시간 캠페인 진행률, 팀 현황, AI 인사이트까지. 필요한 건 다 여기 있어요.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 bg-secondary border-border hover:bg-secondary/80 transition-colors duration-150"
            onClick={() => setAiSheetOpen(true)}
          >
            <Bot className="size-4 text-foreground" />
            <span className="text-xs font-medium text-foreground">AI 현황 요약</span>
          </Button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/5 border border-border">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] font-medium text-muted-foreground">{onlineUsers.length}명 접속 중</span>
          </div>
        </div>
      </motion.div>

      {/* ─── Tab Navigation ─── */}
      <motion.div variants={fadeUpItem}>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border w-fit">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                activeTab === key
                  ? 'bg-foreground text-background shadow-sm'
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
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-5">
            {/* KPI Cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
              {/* Active campaigns */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">활성 캠페인</span>
                  </div>
                  <div className="text-2xl font-black tracking-tight text-foreground">{activeCampaigns.length}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">전체 {campaigns.length}개</p>
                </CardContent>
              </Card>

              {/* Completion rate */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">오늘 완료율</span>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-black tracking-tight text-foreground">{completionRate}%</span>
                    {rateDiff !== null && rateDiff !== 0 && (
                      <span className={cn('text-[10px] font-medium flex items-center mb-1', rateDiff > 0 ? 'text-green-600' : 'text-red-500')}>
                        {rateDiff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(rateDiff)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{completedChecks.length}/{applicableChecks.length} 완료</p>
                </CardContent>
              </Card>

              {/* Projects in progress */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">진행중 프로젝트</span>
                  </div>
                  <div className="text-2xl font-black tracking-tight text-foreground">{projectStats.inProgress}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">전체 {projectStats.total}개 · 완료 {projectStats.completed}개</p>
                </CardContent>
              </Card>

              {/* Pending */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">미완료 항목</span>
                  </div>
                  <div className="text-2xl font-black tracking-tight text-foreground">{pendingChecks.length}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">오늘 남은 업무</p>
                </CardContent>
              </Card>

              {/* Config setup */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">캠페인 세팅률</span>
                  </div>
                  <div className="text-2xl font-black tracking-tight text-foreground">{avgConfigRate}%</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{configIncomplete}개 미완료</p>
                </CardContent>
              </Card>

              {/* Monthly Fixed Cost */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">월 고정비용</span>
                  </div>
                  <div className="text-xl font-black tracking-tight text-foreground">
                    {totalMonthlyFixedCost > 0 ? `${(totalMonthlyFixedCost / 10000).toFixed(0)}만` : '-'}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">활성 {activeCampaigns.length}개 캠페인 합산</p>
                </CardContent>
              </Card>
            </div>

            {/* Global + Periodic Tasks Overview */}
            <div className="grid gap-3 lg:grid-cols-2">
              {/* Global Tasks */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[15px] font-bold">전역 업무</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto bg-secondary text-secondary-foreground">
                      {globalTaskStats.taskCount}개 업무
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">모든 캠페인에 공통으로 적용되는 업무예요.</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">오늘 완료율</span>
                        <span className="text-sm font-bold text-foreground">{globalTaskStats.rate}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground transition-all duration-150"
                          style={{ width: `${globalTaskStats.rate}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{globalTaskStats.completed}/{globalTaskStats.total} 완료</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Periodic Tasks */}
              <Card className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[15px] font-bold">월간/주기별 업무</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto bg-secondary text-secondary-foreground">
                      {periodicTaskStats.taskCount}개 업무
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">매월, 또는 주기적으로 반복되는 업무 현황이에요.</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">{format(new Date(), 'MM월')} 완료율</span>
                        <span className="text-sm font-bold text-foreground">{periodicTaskStats.rate}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground transition-all duration-150"
                          style={{ width: `${periodicTaskStats.rate}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] text-muted-foreground">{periodicTaskStats.completed}/{periodicTaskStats.total} 완료</p>
                        {periodicTaskStats.withResultValue > 0 && (
                          <p className="text-[10px] text-foreground font-medium">결과값 {periodicTaskStats.withResultValue}건</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Phase Distribution */}
            <Card className="bg-card border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  캠페인 단계별 분포
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">현재 활성 캠페인이 어떤 단계에 있는지 보여줘요.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-3">
                  {(['onboarding', 'running', 'scaling'] as const).map((phase) => {
                    const config = PHASE_CONFIG[phase];
                    const count = phaseDistribution[phase];
                    const pct = totalPhase > 0 ? Math.round((count / totalPhase) * 100) : 0;
                    return (
                      <div key={phase} className={cn('rounded-lg border p-4 transition-all duration-150 hover:scale-[1.02]', config.bg, config.border)}>
                        <p className={cn('text-[11px] font-semibold uppercase tracking-wider', config.color)}>{config.label}</p>
                        <p className={cn('text-2xl font-black mt-1', config.color)}>{count}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-700', config.bar)} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Brand Campaign Overview */}
            {brandCampaignStats.total > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Brand KPI + Platform Setup */}
                <Card className="bg-card border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                      제품 브랜드 캠페인
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto bg-secondary text-secondary-foreground">
                        {brandCampaignStats.active}/{brandCampaignStats.total} 활성
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">브랜드 캠페인 세팅 현황과 단계별 분포예요.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 rounded-lg bg-secondary">
                        <p className="text-lg font-bold text-foreground">{brandCampaignStats.total}</p>
                        <p className="text-[9px] text-muted-foreground">전체 브랜드</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-secondary">
                        <p className="text-lg font-bold text-foreground">{brandCampaignStats.totalPlatforms}</p>
                        <p className="text-[9px] text-muted-foreground">플랫폼 세팅</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-secondary">
                        <p className="text-lg font-bold text-foreground">{brandCampaignStats.setupRate}%</p>
                        <p className="text-[9px] text-muted-foreground">세팅 완료율</p>
                      </div>
                    </div>
                    {/* Phase Distribution */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">브랜드 단계별</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {(['기획', '플랫폼세팅', '인플루언서기획', '운영', '스케일링'] as const).map((phase) => {
                          const count = brandCampaignStats.phaseCounts.get(phase) ?? 0;
                          if (count === 0) return null;
                          const cfg = BRAND_PHASE_CONFIG[phase];
                          return (
                            <Badge key={phase} variant="secondary" className={cn('text-[9px] px-1.5 py-0.5 bg-secondary text-secondary-foreground')}>
                              {cfg?.label ?? phase} {count}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Country + Platform Distribution */}
                <Card className="bg-card border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      국가 & 플랫폼 분포
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">타겟 국가와 이커머스 플랫폼 현황이에요.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Country distribution */}
                    <div className="mb-4">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">타겟 국가</p>
                      <div className="flex flex-wrap gap-1.5">
                        {brandCampaignStats.countryDistribution.map(({ country, count }) => (
                          <Badge key={country} variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-border">
                            {country}
                            <span className="font-bold text-foreground">{count}</span>
                          </Badge>
                        ))}
                        {brandCampaignStats.countryDistribution.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">타겟 국가가 설정되지 않았습니다</span>
                        )}
                      </div>
                    </div>
                    {/* Platform distribution */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1"><Store className="size-3" />이커머스 플랫폼</p>
                      <div className="space-y-1.5">
                        {brandCampaignStats.platformDistribution.map(({ name, count }) => (
                          <div key={name} className="flex items-center gap-2">
                            <span className="text-[11px] font-medium flex-1 min-w-0 truncate">{name}</span>
                            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                              <div className="h-full rounded-full bg-foreground transition-all duration-150" style={{ width: `${(count / Math.max(brandCampaignStats.totalPlatforms, 1)) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-semibold text-foreground tabular-nums w-4 text-right">{count}</span>
                          </div>
                        ))}
                        {brandCampaignStats.platformDistribution.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">등록된 플랫폼이 없습니다</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Row: Weekly Trend + Category Donut */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 bg-card border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    주간 완료율 추이
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">최근 7일간 업무 완료율 변화를 보여줘요.</CardDescription>
                </CardHeader>
                <CardContent>
                  {weeklyTrendData.every((d) => d.total === 0) ? (
                    <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">데이터가 없습니다</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0a0a0a" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#0a0a0a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                        <RechartsTooltip
                          formatter={(value, _name, props) => {
                            const payload = props?.payload as { completed?: number; total?: number } | undefined;
                            return [`${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`, '완료율'];
                          }}
                          contentStyle={{ borderRadius: '10px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="rate" stroke="#0a0a0a" strokeWidth={2.5} fill="url(#colorRate)"
                          dot={{ fill: '#0a0a0a', r: 4, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, fill: '#404040' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold">카테고리별 업무</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">업무 유형별 비중을 확인해 보세요.</CardDescription>
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
                            <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [`${value}건`, '업무 수']} contentStyle={{ borderRadius: '10px', border: '1px solid #e5e5e5', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Project Progress + Config Setup */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Project Progress */}
              <Card className="bg-card border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                        <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                        프로젝트 진행 현황
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">진행중인 프로젝트의 완료율이에요.</CardDescription>
                    </div>
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
                          <div className="h-full rounded-full bg-foreground transition-all duration-150" style={{ width: `${p.taskRate}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-foreground tabular-nums w-8 text-right">{p.taskRate}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Config Setup Status */}
              <Card className="bg-card border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                    캠페인 세팅 현황
                    {configIncomplete > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-secondary text-secondary-foreground">{configIncomplete}개 미완료</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">각 캠페인의 초기 설정 완료 상태예요.</CardDescription>
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
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-border text-muted-foreground">{PHASE_CONFIG[c.phase]?.label ?? c.phase}</Badge>
                                  <span className={cn('text-[10px] font-bold tabular-nums text-foreground')}>{c.rate}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-foreground transition-all duration-500" style={{ width: `${c.rate}%` }} />
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
            <Card className="bg-card border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  캠페인별 완료율
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">오늘 기준 각 캠페인의 업무 완료율이에요.</CardDescription>
              </CardHeader>
              <CardContent>
                {campaignChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">데이터가 없습니다</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(250, campaignChartData.length * 30)}>
                    <BarChart data={campaignChartData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e5e5" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        formatter={(value, _name, props) => {
                          const payload = props?.payload as { completed?: number; total?: number } | undefined;
                          return [`${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`, '완료율'];
                        }}
                        contentStyle={{ borderRadius: '10px', border: '1px solid #e5e5e5', fontSize: '12px' }}
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
              <Card className="bg-card border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    캠페인 순위
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">상위/하위 캠페인을 한눈에 비교해 보세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  {campaignChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">데이터 없음</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-semibold text-green-600 mb-2 flex items-center gap-1 uppercase tracking-wider"><TrendingUp className="h-3 w-3" />상위 5</p>
                        <div className="space-y-2">
                          {topCampaigns.map((c, i) => (
                            <div key={`t-${i}`} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground/50 w-3 text-right tabular-nums">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-medium truncate">{c.name}</span>
                                  <span className="text-[10px] font-bold ml-1 tabular-nums text-foreground">{c.rate}%</span>
                                </div>
                                <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                                  <div className="h-full rounded-full bg-foreground transition-all duration-150" style={{ width: `${c.rate}%` }} />
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
                                  <span className="text-[10px] font-bold ml-1 tabular-nums text-foreground">{c.rate}%</span>
                                </div>
                                <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                                  <div className="h-full rounded-full bg-neutral-300 dark:bg-neutral-600 transition-all duration-150" style={{ width: `${c.rate}%` }} />
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
              <Card className="bg-card border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    최근 활동
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">팀원들의 최근 활동 내역이에요.</CardDescription>
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
                                <div className="h-3 w-3 rounded-full border-2 border-neutral-300 dark:border-neutral-600 bg-background group-hover:border-foreground transition-colors duration-150" />
                              </div>
                              <div className="flex-1 min-w-0 pb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-medium">{userNameForLog(log.user_id)}</span>
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal bg-secondary text-secondary-foreground">{ACTION_TYPE_LABELS[log.action_type] ?? log.action_type}</Badge>
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
              <Card className="bg-card border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    긴급 알림
                    {(overdueItems.length + pendingAlerts.length) > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{overdueItems.length + pendingAlerts.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">마감 초과 및 미완료 항목을 확인하세요.</CardDescription>
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
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">미완료 업무</p>
                        <div className="space-y-1">
                          {pendingAlerts.slice(0, 10).map((alert) => (
                            <div key={alert.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/30 cursor-pointer transition-all duration-150" onClick={() => router.push('/view/campaign')}>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium truncate">{alert.taskName}</p>
                                <p className="text-[9px] text-muted-foreground truncate">{alert.campaignName}</p>
                              </div>
                              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-secondary text-secondary-foreground">{alert.category}</Badge>
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
            <Card className="bg-card border border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      담당자별 현황 (일일 체크 + 프로젝트)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">각 담당자의 오늘 업무 완료율과 프로젝트 현황이에요.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={() => setActiveTab('assignee')}>
                    자세히 <ChevronRight className="size-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-1.5 px-2">이름</TableHead>
                      <TableHead className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-1.5 px-2">체크 완료</TableHead>
                      <TableHead className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-1.5 px-2">체크 진행</TableHead>
                      <TableHead className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-1.5 px-2">체크 미완</TableHead>
                      <TableHead className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-1.5 px-2">프로젝트</TableHead>
                      <TableHead className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-1.5 px-2">하위업무</TableHead>
                      <TableHead className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider py-1.5 px-2">완료율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assigneeCombined.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground text-sm">데이터가 없습니다</TableCell></TableRow>
                    ) : (
                      assigneeCombined.map((row) => (
                        <TableRow key={row.userId}>
                          <TableCell className="font-medium text-[12px] py-1.5 px-2">{row.name}</TableCell>
                          <TableCell className="text-center py-1.5 px-2"><Badge variant="secondary" className="bg-foreground/10 text-foreground text-[10px]">{row.checkCompleted}</Badge></TableCell>
                          <TableCell className="text-center py-1.5 px-2"><Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px]">{row.checkInProgress}</Badge></TableCell>
                          <TableCell className="text-center py-1.5 px-2"><Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px]">{row.checkPending}</Badge></TableCell>
                          <TableCell className="text-center py-1.5 px-2"><span className="text-[11px] text-muted-foreground">{row.projCompleted}/{row.projAssigned}</span></TableCell>
                          <TableCell className="text-center py-1.5 px-2"><span className="text-[11px] text-muted-foreground">{row.taskCompleted}/{row.taskAssigned}</span></TableCell>
                          <TableCell className="text-center py-1.5 px-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-foreground transition-all duration-150" style={{ width: `${row.checkRate}%` }} />
                              </div>
                              <span className="text-[10px] font-semibold tabular-nums text-foreground">{row.checkRate}%</span>
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
          <motion.div key="assignee" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-4">
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
                <Card key={a.userId} className="bg-card border border-border hover:border-foreground/20 transition-all duration-150">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-full bg-foreground flex items-center justify-center text-background text-sm font-bold">
                        {a.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">체크 완료율 {a.checkRate}%</p>
                      </div>
                      <div className="ml-auto h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border-2 border-foreground/20 text-foreground bg-secondary">
                        {a.checkRate}%
                      </div>
                    </div>

                    {/* Daily checks */}
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">일일 체크</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-1.5 rounded-lg bg-foreground/5">
                          <p className="text-lg font-bold text-foreground">{a.checkCompleted}</p>
                          <p className="text-[9px] text-muted-foreground">완료</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-secondary">
                          <p className="text-lg font-bold text-foreground">{a.checkInProgress}</p>
                          <p className="text-[9px] text-muted-foreground">진행중</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-secondary">
                          <p className="text-lg font-bold text-foreground">{a.checkPending}</p>
                          <p className="text-[9px] text-muted-foreground">미완료</p>
                        </div>
                      </div>
                    </div>

                    {/* Projects & Tasks */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">프로젝트 & 업무</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary">
                          <FolderKanban className="size-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">{a.projCompleted}/{a.projAssigned}</p>
                            <p className="text-[9px] text-muted-foreground">프로젝트</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary">
                          <CheckCircle2 className="size-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">{a.taskCompleted}/{a.taskAssigned}</p>
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
          <motion.div key="campaign" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-4">
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
                    <Card key={c.id} className="bg-card border border-border hover:border-foreground/20 transition-all duration-150">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{c.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {campaign?.phase && <Badge variant="outline" className="text-[9px] px-1 py-0 border-border text-muted-foreground">{PHASE_CONFIG[campaign.phase]?.label ?? campaign.phase}</Badge>}
                              <Badge variant={campaign?.status === 'active' ? 'default' : 'secondary'} className={cn('text-[9px] px-1 py-0', campaign?.status === 'active' ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground')}>
                                {campaign?.status === 'active' ? '활성' : campaign?.status === 'paused' ? '일시중지' : '완료'}
                              </Badge>
                            </div>
                          </div>
                          <div className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold border-[3px] border-foreground/20 text-foreground">
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
                            <div className="h-full rounded-full bg-foreground transition-all duration-150" style={{ width: `${c.rate}%` }} />
                          </div>
                        </div>

                        {/* Config setup */}
                        {cfgData && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Settings2 className="size-3" />세팅 완료</span>
                              <span className="text-[10px] font-medium text-foreground">{cfgData.done}/{cfgData.total}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-neutral-400 dark:bg-neutral-500 transition-all duration-150" style={{ width: `${cfgData.rate}%` }} />
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
          <motion.div key="project" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="bg-card border border-border">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-foreground">{projectStats.total}</p>
                  <p className="text-[10px] text-muted-foreground">전체</p>
                </CardContent>
              </Card>
              <Card className="bg-card border border-border">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-muted-foreground">{projectStats.notStarted}</p>
                  <p className="text-[10px] text-muted-foreground">진행전</p>
                </CardContent>
              </Card>
              <Card className="bg-card border border-border">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-foreground">{projectStats.inProgress}</p>
                  <p className="text-[10px] text-muted-foreground">진행중</p>
                </CardContent>
              </Card>
              <Card className="bg-card border border-border">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-foreground">{projectStats.completed}</p>
                  <p className="text-[10px] text-muted-foreground">완료</p>
                </CardContent>
              </Card>
              <Card className={cn('bg-card border', projectStats.overdue > 0 ? 'border-red-200 dark:border-red-800/40' : 'border-border')}>
                <CardContent className="p-3 text-center">
                  <p className={cn('text-2xl font-black', projectStats.overdue > 0 ? 'text-red-600' : 'text-muted-foreground')}>{projectStats.overdue}</p>
                  <p className="text-[10px] text-muted-foreground">마감 초과</p>
                </CardContent>
              </Card>
            </div>

            {/* Project List */}
            <div className="space-y-3">
              {projectProgress.map((p) => (
                <Card key={p.id} className={cn('bg-card border hover:border-foreground/20 transition-all duration-150 cursor-pointer', p.isOverdue ? 'border-red-200 dark:border-red-800/40' : 'border-border')}
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
                            <div className="h-full rounded-full bg-foreground transition-all duration-150" style={{ width: `${p.taskRate}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{p.taskDone}/{p.taskTotal} 완료</span>
                          <span className="text-[10px] font-bold tabular-nums text-foreground">{p.taskRate}%</span>
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

    <AiCommandCenter open={aiSheetOpen} onOpenChange={setAiSheetOpen} context="dashboard" />
    </>
  );
}
