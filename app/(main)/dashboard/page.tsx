'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { motion } from 'framer-motion';
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
  LineChart,
  Line,
  Area,
  AreaChart,
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
} from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  Campaign,
  Task,
  DailyCheck,
  User,
  TaskCategory,
  ActivityLog,
} from '@/lib/types/database';

const today = format(new Date(), 'yyyy-MM-dd');

const PIE_COLORS = [
  'oklch(0.55 0.22 265)',
  'oklch(0.65 0.18 165)',
  'oklch(0.55 0.16 145)',
  'oklch(0.75 0.15 85)',
  'oklch(0.6 0.2 25)',
  'oklch(0.6 0.2 330)',
  'oklch(0.5 0.2 280)',
  'oklch(0.7 0.14 200)',
  'oklch(0.65 0.15 60)',
];

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; bar: string }> = {
  onboarding: { label: '온보딩', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50/80 dark:bg-blue-950/30', border: 'border-blue-200/60 dark:border-blue-800/40', bar: 'bg-blue-500' },
  running: { label: '운영중', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50/80 dark:bg-emerald-950/30', border: 'border-emerald-200/60 dark:border-emerald-800/40', bar: 'bg-emerald-500' },
  scaling: { label: '스케일링', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50/80 dark:bg-purple-950/30', border: 'border-purple-200/60 dark:border-purple-800/40', bar: 'bg-purple-500' },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  'check.update': '체크 수정',
  'check.create': '체크 생성',
  'campaign.create': '캠페인 생성',
  'campaign.update': '캠페인 수정',
  'task.create': '업무 생성',
  'task.update': '업무 수정',
  'config.update': '설정 변경',
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile } = useAuth();
  const { onlineUsers } = usePresence(
    'global',
    profile
      ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url ?? undefined }
      : undefined
  );

  useRealtimeChecks(today);

  // Fetch campaigns
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

  // Fetch today's checks
  const { data: checks = [] } = useQuery({
    queryKey: queryKeys.checks.byDate(today),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .eq('check_date', today);
      if (error) throw error;
      return data as DailyCheck[];
    },
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as User[];
    },
  });

  // Fetch weekly checks (past 7 days)
  const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const { data: weeklyChecks = [] } = useQuery({
    queryKey: ['checks', 'weekly', sevenDaysAgo, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .gte('check_date', sevenDaysAgo)
        .lte('check_date', today);
      if (error) throw error;
      return data as DailyCheck[];
    },
  });

  // Fetch recent activity logs
  const { data: activityLogs = [] } = useQuery({
    queryKey: ['activity-logs', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as ActivityLog[];
    },
  });

  // KPI calculations
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const applicableChecks = checks.filter((c) => c.status !== '해당없음');
  const completedChecks = applicableChecks.filter((c) => c.status === '완료');
  const pendingChecks = applicableChecks.filter((c) => c.status === '미완료');
  const completionRate =
    applicableChecks.length > 0
      ? Math.round((completedChecks.length / applicableChecks.length) * 100)
      : 0;

  // Yesterday's rate for trend comparison
  const yesterdayRate = useMemo(() => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const yesterdayChecks = weeklyChecks.filter(
      (c) => c.check_date === yesterday && c.status !== '해당없음'
    );
    const yesterdayCompleted = yesterdayChecks.filter((c) => c.status === '완료');
    return yesterdayChecks.length > 0
      ? Math.round((yesterdayCompleted.length / yesterdayChecks.length) * 100)
      : null;
  }, [weeklyChecks]);

  const rateDiff = yesterdayRate !== null ? completionRate - yesterdayRate : null;

  // Weekly trend area chart data
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
      date,
      label: format(new Date(date + 'T00:00:00'), 'MM/dd'),
      rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      completed: stats.completed,
      total: stats.total,
    }));
  }, [weeklyChecks]);

  // Campaign phase distribution
  const phaseDistribution = useMemo(() => {
    const phaseCounts: Record<string, number> = { onboarding: 0, running: 0, scaling: 0 };
    for (const c of activeCampaigns) {
      if (phaseCounts[c.phase] !== undefined) {
        phaseCounts[c.phase] += 1;
      }
    }
    return phaseCounts;
  }, [activeCampaigns]);

  // Campaign completion chart data
  const campaignChartData = useMemo(() => {
    const campaignMap = new Map<string, { total: number; completed: number }>();
    for (const check of checks) {
      if (check.status === '해당없음') continue;
      if (!check.campaign_id) continue;
      const existing = campaignMap.get(check.campaign_id) || { total: 0, completed: 0 };
      existing.total += 1;
      if (check.status === '완료') existing.completed += 1;
      campaignMap.set(check.campaign_id, existing);
    }
    return Array.from(campaignMap.entries())
      .map(([campaignId, stats]) => {
        const campaign = campaigns.find((c) => c.id === campaignId);
        const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        return {
          name: campaign?.campaign_name ?? '알 수 없음',
          rate,
          completed: stats.completed,
          total: stats.total,
        };
      })
      .sort((a, b) => a.rate - b.rate);
  }, [checks, campaigns]);

  // Top 5 / Bottom 5 campaign ranking
  const { topCampaigns, bottomCampaigns } = useMemo(() => {
    const sorted = [...campaignChartData].sort((a, b) => b.rate - a.rate);
    return {
      topCampaigns: sorted.slice(0, 5),
      bottomCampaigns: sorted.length > 5
        ? sorted.slice(-5).reverse()
        : sorted.slice(Math.max(0, sorted.length - 5)).reverse(),
    };
  }, [campaignChartData]);

  // Assignee summary data
  const assigneeSummary = useMemo(() => {
    const userMap = new Map<
      string,
      { completed: number; inProgress: number; pending: number }
    >();
    for (const check of checks) {
      if (check.status === '해당없음' || !check.assigned_user_id) continue;
      const existing = userMap.get(check.assigned_user_id) || {
        completed: 0,
        inProgress: 0,
        pending: 0,
      };
      if (check.status === '완료') existing.completed += 1;
      else if (check.status === '진행중') existing.inProgress += 1;
      else if (check.status === '미완료') existing.pending += 1;
      userMap.set(check.assigned_user_id, existing);
    }
    return Array.from(userMap.entries())
      .map(([userId, stats]) => {
        const user = users.find((u) => u.id === userId);
        const total = stats.completed + stats.inProgress + stats.pending;
        return {
          userId,
          name: user?.name ?? '알 수 없음',
          ...stats,
          total,
          rate: total > 0 ? Math.round((stats.completed / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [checks, users]);

  // Category donut data
  const categoryData = useMemo(() => {
    const taskCategoryMap = new Map<string, TaskCategory>();
    for (const task of tasks) {
      taskCategoryMap.set(task.id, task.category);
    }
    const catCounts = new Map<TaskCategory, number>();
    for (const check of checks) {
      if (check.status === '해당없음') continue;
      const cat = taskCategoryMap.get(check.task_id);
      if (cat) {
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
      }
    }
    return CATEGORY_ORDER
      .filter((cat) => (catCounts.get(cat) || 0) > 0)
      .map((cat) => ({
        name: cat,
        value: catCounts.get(cat) || 0,
      }));
  }, [checks, tasks]);

  // Pending alerts
  const pendingAlerts = useMemo(() => {
    return checks
      .filter((c) => c.status === '미완료')
      .map((check) => {
        const campaign = campaigns.find((c) => c.id === check.campaign_id);
        const task = tasks.find((t) => t.id === check.task_id);
        const user = check.assigned_user_id
          ? users.find((u) => u.id === check.assigned_user_id)
          : null;
        return {
          id: check.id,
          campaignName: campaign?.campaign_name ?? '-',
          taskName: task?.task_name ?? '-',
          assignee: user?.name ?? '미배정',
          category: task?.category ?? '보고',
        };
      })
      .slice(0, 20);
  }, [checks, campaigns, tasks, users]);

  const getBarColor = (rate: number) => {
    if (rate >= 80) return 'oklch(0.6 0.18 155)';
    if (rate >= 50) return 'oklch(0.7 0.15 85)';
    return 'oklch(0.6 0.2 25)';
  };

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후에요';
    return '좋은 저녁이에요';
  };

  const userNameForLog = (userId: string | null) => {
    if (!userId) return '시스템';
    const user = users.find((u) => u.id === userId);
    return user?.name ?? '알 수 없음';
  };

  const formatLogTime = (createdAt: string) => {
    try {
      return format(new Date(createdAt), 'MM/dd HH:mm');
    } catch {
      return '-';
    }
  };

  const totalPhase = phaseDistribution.onboarding + phaseDistribution.running + phaseDistribution.scaling;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Greeting Header */}
      <motion.div variants={fadeUpItem} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, <span className="text-gradient">{profile?.name ?? '사용자'}</span>님
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'yyyy년 MM월 dd일')} 기준 실시간 현황
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">
            {onlineUsers.length}명 접속 중
          </span>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Active campaigns */}
        <motion.div variants={fadeUpItem}>
          <Card className="glass-card relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-bl-[40px]" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                활성 캠페인
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{activeCampaigns.length}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                전체 {campaigns.length}개 중
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Completion rate */}
        <motion.div variants={fadeUpItem}>
          <Card className="glass-card relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-[40px]" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                  completionRate >= 80 ? 'bg-emerald-500/10' : completionRate >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'
                }`}>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${
                    completionRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : completionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  }`} />
                </div>
                오늘 완료율
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold tracking-tight ${
                  completionRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : completionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                }`}>{completionRate}%</span>
                {rateDiff !== null && rateDiff !== 0 && (
                  <span className={`text-xs font-medium flex items-center gap-0.5 mb-1 ${
                    rateDiff > 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {rateDiff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(rateDiff)}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {completedChecks.length}/{applicableChecks.length} 완료
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending */}
        <motion.div variants={fadeUpItem}>
          <Card className="glass-card relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-bl-[40px]" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                미완료 항목
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {pendingChecks.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">오늘 남은 업무</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Online users */}
        <motion.div variants={fadeUpItem}>
          <Card className="glass-card relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-[40px]" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                접속 중
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {onlineUsers.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {onlineUsers.map((u) => u.name).join(', ') || '-'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Campaign Phase Distribution */}
      <motion.div variants={fadeUpItem}>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-purple-500" />
              </div>
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
                  <div
                    key={phase}
                    className={`rounded-xl border p-4 ${config.bg} ${config.border} transition-all hover:scale-[1.02]`}
                  >
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${config.color}`}>{config.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${config.color}`}>{count}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${config.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Weekly Trend + Category Donut */}
      <div className="grid gap-5 lg:grid-cols-3">
        <motion.div variants={fadeUpItem} className="lg:col-span-2">
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                </div>
                주간 완료율 추이
              </CardTitle>
              <CardDescription className="text-xs">최근 7일간 일별 완료율 변화</CardDescription>
            </CardHeader>
            <CardContent>
              {weeklyTrendData.every((d) => d.total === 0) ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  데이터가 없습니다
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0 0 / 40%)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <RechartsTooltip
                      formatter={(value, _name, props) => {
                        const payload = props?.payload as { completed?: number; total?: number } | undefined;
                        return [
                          `${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`,
                          '완료율',
                        ];
                      }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid oklch(0.9 0 0)',
                        boxShadow: '0 4px 12px oklch(0 0 0 / 8%)',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="oklch(0.55 0.22 265)"
                      strokeWidth={2.5}
                      fill="url(#colorRate)"
                      dot={{ fill: 'oklch(0.55 0.22 265)', r: 4, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: 'oklch(0.45 0.2 265)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUpItem}>
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">카테고리별 업무</CardTitle>
              <CardDescription className="text-xs">오늘 카테고리별 업무 분포</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  데이터가 없습니다
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {categoryData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={PIE_COLORS[CATEGORY_ORDER.indexOf(entry.name as TaskCategory) % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value) => [`${value}건`, '업무 수']}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid oklch(0.9 0 0)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Campaign completion bar chart */}
      <motion.div variants={fadeUpItem}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center">
                <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              캠페인별 완료율
            </CardTitle>
            <CardDescription className="text-xs">오늘 기준 캠페인별 업무 완료 현황</CardDescription>
          </CardHeader>
          <CardContent>
            {campaignChartData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                데이터가 없습니다
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, campaignChartData.length * 32)}>
                <BarChart
                  data={campaignChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.85 0 0 / 40%)" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <RechartsTooltip
                    formatter={(value, _name, props) => {
                      const payload = props?.payload as { completed?: number; total?: number } | undefined;
                      return [
                        `${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`,
                        '완료율',
                      ];
                    }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid oklch(0.9 0 0)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="rate"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={20}
                  >
                    {campaignChartData.map((entry, idx) => (
                      <Cell key={idx} fill={getBarColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Top/Bottom Ranking + Activity Timeline */}
      <div className="grid gap-5 lg:grid-cols-2">
        <motion.div variants={fadeUpItem}>
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                캠페인 완료율 순위
              </CardTitle>
              <CardDescription className="text-xs">상위 5개 / 하위 5개 캠페인</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignChartData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  데이터가 없습니다
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Top 5 */}
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1 uppercase tracking-wider">
                      <TrendingUp className="h-3 w-3" />
                      상위 캠페인
                    </p>
                    <div className="space-y-2.5">
                      {topCampaigns.map((c, i) => (
                        <div key={`top-${i}`} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-muted-foreground/60 w-4 text-right tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate">{c.name}</span>
                              <span className={`text-xs font-bold ml-2 tabular-nums ${
                                c.rate >= 80 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600'
                              }`}>{c.rate}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 bg-emerald-500"
                                style={{ width: `${c.rate}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t" />

                  {/* Bottom 5 */}
                  <div>
                    <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-1 uppercase tracking-wider">
                      <TrendingDown className="h-3 w-3" />
                      하위 캠페인
                    </p>
                    <div className="space-y-2.5">
                      {bottomCampaigns.map((c, i) => (
                        <div key={`bottom-${i}`} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-muted-foreground/60 w-4 text-right tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate">{c.name}</span>
                              <span className={`text-xs font-bold ml-2 tabular-nums ${
                                c.rate >= 80 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600'
                              }`}>{c.rate}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 bg-red-400"
                                style={{ width: `${c.rate}%` }}
                              />
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
        </motion.div>

        {/* Activity Timeline */}
        <motion.div variants={fadeUpItem}>
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center">
                  <Activity className="h-3.5 w-3.5 text-indigo-500" />
                </div>
                최근 활동
              </CardTitle>
              <CardDescription className="text-xs">최근 10건의 활동 내역</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[380px]">
                {activityLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    활동 내역이 없습니다
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-4">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="flex gap-3 relative group">
                          <div className="relative z-10 mt-1.5">
                            <div className="h-[14px] w-[14px] rounded-full border-2 border-primary/40 bg-background group-hover:border-primary transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {userNameForLog(log.user_id)}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                {ACTION_TYPE_LABELS[log.action_type] ?? log.action_type}
                              </Badge>
                            </div>
                            {log.target_table && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {log.target_table}
                                {log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">
                              {formatLogTime(log.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row - Assignee Summary + Pending Alerts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Assignee Summary Table */}
        <motion.div variants={fadeUpItem}>
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">담당자별 현황</CardTitle>
              <CardDescription className="text-xs">오늘 담당자별 업무 진행률</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">이름</TableHead>
                    <TableHead className="text-center text-xs">완료</TableHead>
                    <TableHead className="text-center text-xs">진행중</TableHead>
                    <TableHead className="text-center text-xs">미완료</TableHead>
                    <TableHead className="text-center text-xs">완료율</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assigneeSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-16 text-center text-muted-foreground text-sm">
                        데이터가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    assigneeSummary.map((row) => (
                      <TableRow key={row.userId} className="group">
                        <TableCell className="font-medium text-sm">{row.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px]"
                          >
                            {row.completed}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[11px]"
                          >
                            {row.inProgress}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[11px]"
                          >
                            {row.pending}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="hidden sm:block w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  row.rate >= 80 ? 'bg-emerald-500' : row.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${row.rate}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                row.rate >= 80
                                  ? 'text-emerald-600'
                                  : row.rate >= 50
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {row.rate}%
                            </span>
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

        {/* Pending Alerts */}
        <motion.div variants={fadeUpItem}>
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                </div>
                미완료 알림
                {pendingChecks.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">
                    {pendingChecks.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px]">
                {pendingAlerts.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    미완료 업무가 없습니다
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {pendingAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-transparent hover:border-border hover:bg-accent/50 cursor-pointer transition-all"
                        onClick={() => router.push('/view/campaign')}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {alert.taskName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {alert.campaignName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              CATEGORY_COLORS[alert.category]?.text ?? ''
                            } ${CATEGORY_COLORS[alert.category]?.bg ?? ''}`}
                          >
                            {alert.category}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {alert.assignee}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
