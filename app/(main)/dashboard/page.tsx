'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format, subDays } from 'date-fns';
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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
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
  '#3b82f6', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899',
  '#f43f5e', '#6366f1', '#14b8a6', '#eab308',
];

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  onboarding: { label: '온보딩', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800' },
  running: { label: '운영중', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  scaling: { label: '스케일링', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800' },
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

  // Weekly trend line chart data
  const weeklyTrendData = useMemo(() => {
    const dateMap = new Map<string, { total: number; completed: number }>();

    // Initialize all 7 days
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
      if (!check.campaign_id) continue; // skip global tasks
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
    if (rate >= 80) return '#10b981';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
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
    <div className="space-y-8">
      {/* Greeting Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {profile?.name ?? '사용자'}님
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
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              활성 캠페인
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCampaigns.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              전체 {campaigns.length}개 중
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 shadow-sm hover:shadow-md transition-shadow ${
          completionRate >= 80 ? 'border-l-emerald-500' : completionRate >= 50 ? 'border-l-amber-500' : 'border-l-red-500'
        }`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 ${
                completionRate >= 80 ? 'text-emerald-500' : completionRate >= 50 ? 'text-amber-500' : 'text-red-500'
              }`} />
              오늘 완료율
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              completionRate >= 80 ? 'text-emerald-600' : completionRate >= 50 ? 'text-amber-600' : 'text-red-600'
            }`}>{completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedChecks.length}/{applicableChecks.length} 완료
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 shadow-sm hover:shadow-md transition-shadow ${
          pendingChecks.length === 0 ? 'border-l-emerald-500' : pendingChecks.length <= 5 ? 'border-l-amber-500' : 'border-l-red-500'
        }`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${
                pendingChecks.length === 0 ? 'text-emerald-500' : 'text-amber-500'
              }`} />
              미완료 항목
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {pendingChecks.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">오늘 남은 업무</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              접속 중
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {onlineUsers.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {onlineUsers.map((u) => u.name).join(', ') || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Phase Distribution */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" />
            캠페인 단계별 분포
          </CardTitle>
          <CardDescription>활성 캠페인의 현재 단계 현황</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-3">
            {(['onboarding', 'running', 'scaling'] as const).map((phase) => {
              const config = PHASE_CONFIG[phase];
              const count = phaseDistribution[phase];
              const pct = totalPhase > 0 ? Math.round((count / totalPhase) * 100) : 0;
              return (
                <div
                  key={phase}
                  className={`rounded-xl border p-4 ${config.bg} ${config.border}`}
                >
                  <p className={`text-xs font-medium ${config.color}`}>{config.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${config.color}`}>{count}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        phase === 'onboarding' ? 'bg-blue-500' : phase === 'running' ? 'bg-emerald-500' : 'bg-purple-500'
                      }`}
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

      {/* Weekly Trend + Category Donut */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Trend Line Chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              주간 완료율 추이
            </CardTitle>
            <CardDescription>최근 7일간 일별 완료율 변화</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyTrendData.every((d) => d.total === 0) ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                데이터가 없습니다
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weeklyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    formatter={(value, _name, props) => {
                      const payload = props?.payload as { completed?: number; total?: number } | undefined;
                      return [
                        `${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`,
                        '완료율',
                      ];
                    }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category donut chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">카테고리별 업무</CardTitle>
            <CardDescription>오늘 카테고리별 업무 분포</CardDescription>
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
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
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
                  <RechartsTooltip formatter={(value) => [`${value}건`, '업무 수']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign completion bar chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            캠페인별 완료율
          </CardTitle>
          <CardDescription>오늘 기준 캠페인별 업무 완료 현황</CardDescription>
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
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <RechartsTooltip
                  formatter={(value, _name, props) => {
                    const payload = props?.payload as { completed?: number; total?: number } | undefined;
                    return [
                      `${value}% (${payload?.completed ?? 0}/${payload?.total ?? 0})`,
                      '완료율',
                    ];
                  }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar
                  dataKey="rate"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={22}
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

      {/* Top/Bottom Ranking + Activity Timeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top/Bottom Campaign Ranking */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              캠페인 완료율 순위
            </CardTitle>
            <CardDescription>상위 5개 / 하위 5개 캠페인</CardDescription>
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
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    상위 캠페인
                  </p>
                  <div className="space-y-2.5">
                    {topCampaigns.map((c, i) => (
                      <div key={`top-${i}`} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{c.name}</span>
                            <span className={`text-xs font-bold ml-2 ${
                              c.rate >= 80 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600'
                            }`}>{c.rate}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
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

                {/* Divider */}
                <div className="border-t" />

                {/* Bottom 5 */}
                <div>
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    하위 캠페인
                  </p>
                  <div className="space-y-2.5">
                    {bottomCampaigns.map((c, i) => (
                      <div key={`bottom-${i}`} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{c.name}</span>
                            <span className={`text-xs font-bold ml-2 ${
                              c.rate >= 80 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600'
                            }`}>{c.rate}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 bg-red-500"
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

        {/* Activity Timeline */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              최근 활동
            </CardTitle>
            <CardDescription>최근 10건의 활동 내역</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[380px]">
              {activityLogs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  활동 내역이 없습니다
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="flex gap-3 relative">
                        <div className="relative z-10 mt-1.5">
                          <div className="h-[14px] w-[14px] rounded-full border-2 border-indigo-400 bg-white dark:bg-background" />
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {userNameForLog(log.user_id)}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {ACTION_TYPE_LABELS[log.action_type] ?? log.action_type}
                            </Badge>
                          </div>
                          {log.target_table && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {log.target_table}
                              {log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
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
      </div>

      {/* Bottom Row - Assignee Summary + Pending Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assignee Summary Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">담당자별 현황</CardTitle>
            <CardDescription>오늘 담당자별 업무 진행률</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="text-center">완료</TableHead>
                  <TableHead className="text-center">진행중</TableHead>
                  <TableHead className="text-center">미완료</TableHead>
                  <TableHead className="text-center">완료율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assigneeSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      데이터가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  assigneeSummary.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        >
                          {row.completed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          {row.inProgress}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        >
                          {row.pending}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={
                            row.rate >= 80
                              ? 'text-emerald-600 font-semibold'
                              : row.rate >= 50
                              ? 'text-amber-600 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {row.rate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pending Alerts */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              미완료 알림
            </CardTitle>
            <CardDescription>
              아직 완료되지 않은 업무 {pendingChecks.length}건
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              {pendingAlerts.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  미완료 업무가 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => router.push('/view/campaign')}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {alert.taskName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.campaignName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            CATEGORY_COLORS[alert.category]?.text ?? ''
                          } ${CATEGORY_COLORS[alert.category]?.bg ?? ''}`}
                        >
                          {alert.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
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
      </div>
    </div>
  );
}
