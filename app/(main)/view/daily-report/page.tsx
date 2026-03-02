'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  GraduationCap,
  ListChecks,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type {
  Task,
  Campaign,
  DailyCheck,
  User,
  TaskCategory,
  CampaignTaskConfig,
  TaskStep,
  DailyReport,
  TaskTraining,
  StepCheck,
} from '@/lib/types/database';

/* ── Status Config ─────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  '완료': { label: '완료', icon: CheckCircle2, color: 'text-emerald-500' },
  '진행중': { label: '진행중', icon: Clock, color: 'text-amber-500' },
  '미완료': { label: '미완료', icon: Circle, color: 'text-muted-foreground' },
  '해당없음': { label: '해당없음', icon: Circle, color: 'text-muted-foreground/40' },
};

/* ── Assignee Report Card ───────────────────── */
function AssigneeReportCard({
  user,
  date,
  tasks,
  checks,
  campaigns,
  taskConfigs,
  steps,
  stepChecks,
  training,
  report,
  isAdmin,
  onConfirmReport,
}: {
  user: User;
  date: string;
  tasks: Task[];
  checks: DailyCheck[];
  campaigns: Campaign[];
  taskConfigs: CampaignTaskConfig[];
  steps: TaskStep[];
  stepChecks: StepCheck[];
  training: TaskTraining[];
  report: DailyReport | null;
  isAdmin: boolean;
  onConfirmReport: (reportId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Build user's assigned tasks
  const userTasks = useMemo(() => {
    const configMap = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((c) => configMap.set(`${c.campaign_id}:${c.task_id}`, c));

    const checkMap = new Map<string, DailyCheck>();
    checks.forEach((c) => {
      if (c.assigned_user_id === user.id) {
        const key = c.campaign_id ? `${c.campaign_id}:${c.task_id}` : `null:${c.task_id}`;
        checkMap.set(key, c);
      }
    });

    const result: {
      task: Task;
      campaign: Campaign | null;
      check: DailyCheck | null;
      taskSteps: TaskStep[];
      completedSteps: number;
      totalSteps: number;
      isTrained: boolean;
    }[] = [];

    const dailyTasks = tasks.filter(
      (t) => !t.parent_task_id && (t.frequency === 'daily' || t.frequency === 'weekly')
    );

    // Global tasks
    const globalTasks = dailyTasks.filter((t) => t.scope === 'global');
    for (const task of globalTasks) {
      const assignees = task.default_assignees ?? [];
      if (!assignees.includes(user.name)) continue;

      const check = checkMap.get(`null:${task.id}`);
      const taskStepList = steps.filter((s) => s.task_id === task.id).sort((a, b) => a.step_order - b.step_order);
      const checkId = check?.id;
      const completedSteps = checkId
        ? stepChecks.filter((sc) => sc.daily_check_id === checkId && sc.is_completed).length
        : 0;

      const trainRecord = training.find((t) => t.task_id === task.id && t.user_id === user.id);

      result.push({
        task,
        campaign: null,
        check: check ?? null,
        taskSteps: taskStepList,
        completedSteps,
        totalSteps: taskStepList.length,
        isTrained: trainRecord?.is_trained ?? false,
      });
    }

    // Campaign tasks
    const campaignTasks = dailyTasks.filter((t) => t.scope !== 'global');
    for (const campaign of campaigns) {
      for (const task of campaignTasks) {
        const config = configMap.get(`${campaign.id}:${task.id}`);
        const applicable = config ? config.is_applicable : task.is_applicable_default;
        if (!applicable) continue;

        const assigneeOverride = config?.override_assignee;
        const assignees = assigneeOverride ? [assigneeOverride] : (task.default_assignees ?? []);
        if (!assignees.includes(user.name)) continue;

        const check = checkMap.get(`${campaign.id}:${task.id}`);
        const taskStepList = steps.filter((s) => s.task_id === task.id).sort((a, b) => a.step_order - b.step_order);
        const checkId = check?.id;
        const completedSteps = checkId
          ? stepChecks.filter((sc) => sc.daily_check_id === checkId && sc.is_completed).length
          : 0;

        const trainRecord = training.find((t) => t.task_id === task.id && t.user_id === user.id);

        result.push({
          task,
          campaign,
          check: check ?? null,
          taskSteps: taskStepList,
          completedSteps,
          totalSteps: taskStepList.length,
          isTrained: trainRecord?.is_trained ?? false,
        });
      }
    }

    return result;
  }, [user, tasks, checks, campaigns, taskConfigs, steps, stepChecks, training]);

  // Stats
  const stats = useMemo(() => {
    const total = userTasks.length;
    const completed = userTasks.filter((t) => t.check?.status === '완료' || t.check?.status === '해당없음').length;
    const inProgress = userTasks.filter((t) => t.check?.status === '진행중').length;
    const notTrained = userTasks.filter((t) => !t.isTrained).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notTrained, pct };
  }, [userTasks]);

  // Group by category (must be before early return to maintain hooks order)
  const grouped = useMemo(() => {
    const map = new Map<TaskCategory, typeof userTasks>();
    for (const item of userTasks) {
      const cat = item.task.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, items: map.get(cat)! }));
  }, [userTasks]);

  if (userTasks.length === 0) return null;

  const completionColor = stats.pct >= 80
    ? 'text-emerald-500'
    : stats.pct >= 50
      ? 'text-amber-500'
      : 'text-destructive';

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="size-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <UserIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{user.name}</span>
            {user.position && (
              <span className="text-[10px] text-muted-foreground">{user.position}</span>
            )}
            {stats.notTrained > 0 && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 text-amber-600 border-amber-300">
                <GraduationCap className="size-2.5 mr-0.5" />
                미교육 {stats.notTrained}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <div className="flex-1 max-w-[200px]">
              <Progress value={stats.pct} className="h-1.5" />
            </div>
            <span className={cn('text-[11px] font-bold tabular-nums', completionColor)}>
              {stats.pct}%
            </span>
            <span className="text-[10px] text-muted-foreground">
              {stats.completed}/{stats.total} 완료
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {report?.status === '제출완료' && (
            <Badge className="bg-blue-500/15 text-blue-600 border-blue-200 text-[9px]">
              <Send className="size-2.5 mr-0.5" />
              제출완료
            </Badge>
          )}
          {report?.status === '확인완료' && (
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 text-[9px]">
              <Eye className="size-2.5 mr-0.5" />
              확인완료
            </Badge>
          )}
          {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable Detail */}
      {expanded && (
        <div className="border-t">
          {/* Task Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-secondary/20">
                  <th className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground w-[180px]">업무</th>
                  <th className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground w-[140px]">캠페인</th>
                  <th className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground w-[60px] text-center">상태</th>
                  <th className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground w-[100px] text-center">Step 진행</th>
                  <th className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground w-[60px] text-center">교육</th>
                  <th className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground w-[80px] text-center">시간</th>
                  <th className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground">결과값</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ category, items }) => (
                  <CategoryGroup
                    key={category}
                    category={category}
                    items={items}
                    date={date}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Report Summary */}
          {report && (
            <div className="px-4 py-3 border-t bg-secondary/10 space-y-2">
              <div className="flex items-center gap-2">
                <FileCheck className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold">일일 보고</span>
              </div>
              {report.summary && (
                <div className="text-[11px] text-muted-foreground bg-background rounded-lg px-3 py-2 border">
                  <span className="text-[9px] font-semibold text-foreground block mb-0.5">오늘 요약</span>
                  {report.summary}
                </div>
              )}
              {report.issues && (
                <div className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
                  <span className="text-[9px] font-semibold block mb-0.5">이슈</span>
                  {report.issues}
                </div>
              )}
              {report.tomorrow_plan && (
                <div className="text-[11px] text-muted-foreground bg-background rounded-lg px-3 py-2 border">
                  <span className="text-[9px] font-semibold text-foreground block mb-0.5">내일 계획</span>
                  {report.tomorrow_plan}
                </div>
              )}
              {isAdmin && report.status === '제출완료' && (
                <Button
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => onConfirmReport(report.id)}
                >
                  <Eye className="size-3 mr-1" />
                  확인 완료 처리
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Category Group in Table ──────────────── */
function CategoryGroup({
  category,
  items,
  date,
}: {
  category: TaskCategory;
  items: {
    task: Task;
    campaign: Campaign | null;
    check: DailyCheck | null;
    taskSteps: TaskStep[];
    completedSteps: number;
    totalSteps: number;
    isTrained: boolean;
  }[];
  date: string;
}) {
  return (
    <>
      <tr>
        <td colSpan={7} className="px-3 py-1 bg-secondary/40 border-b">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[8px] px-1.5 py-0 rounded-full">
              {category}
            </Badge>
            <span className="text-[9px] text-muted-foreground">{items.length}건</span>
          </div>
        </td>
      </tr>
      {items.map((item, idx) => {
        const statusConf = STATUS_CONFIG[item.check?.status ?? '미완료'];
        const StatusIcon = statusConf.icon;
        const stepPct = item.totalSteps > 0
          ? Math.round((item.completedSteps / item.totalSteps) * 100)
          : null;

        // Time calc
        let timeDisplay = '-';
        if (item.check?.started_at) {
          const start = new Date(item.check.started_at);
          const formatTime = (d: Date) => format(d, 'HH:mm');
          if (item.check.completed_at) {
            timeDisplay = `${formatTime(start)} ~ ${formatTime(new Date(item.check.completed_at))}`;
          } else {
            timeDisplay = `${formatTime(start)} ~`;
          }
        }

        return (
          <tr
            key={`${item.task.id}-${item.campaign?.id ?? 'global'}-${idx}`}
            className="border-b border-border/20 hover:bg-secondary/10 transition-colors"
          >
            <td className="px-3 py-1.5">
              <span className="text-[11px] font-medium">{item.task.task_name}</span>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground truncate block">
                {item.campaign?.campaign_name ?? '전역'}
              </span>
            </td>
            <td className="px-3 py-1.5 text-center">
              <div className={cn('inline-flex items-center gap-0.5', statusConf.color)}>
                <StatusIcon className="size-3" />
                <span className="text-[9px]">{statusConf.label}</span>
              </div>
            </td>
            <td className="px-3 py-1.5 text-center">
              {item.totalSteps > 0 ? (
                <div className="flex items-center gap-1.5 justify-center">
                  <Progress value={stepPct!} className="h-1 w-12" />
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {item.completedSteps}/{item.totalSteps}
                  </span>
                </div>
              ) : (
                <span className="text-[9px] text-muted-foreground/40">-</span>
              )}
            </td>
            <td className="px-3 py-1.5 text-center">
              {item.isTrained ? (
                <CheckCircle2 className="size-3 text-emerald-500 mx-auto" />
              ) : (
                <AlertTriangle className="size-3 text-amber-500 mx-auto" />
              )}
            </td>
            <td className="px-3 py-1.5 text-center">
              <span className="text-[9px] text-muted-foreground tabular-nums">{timeDisplay}</span>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[10px] text-foreground truncate block max-w-[200px]">
                {item.check?.result_value || '-'}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/* ── My Report Dialog ─────────────────────── */
function MyReportDialog({
  open,
  onClose,
  date,
  userId,
  existingReport,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  userId: string;
  existingReport: DailyReport | null;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState(existingReport?.summary ?? '');
  const [issues, setIssues] = useState(existingReport?.issues ?? '');
  const [tomorrowPlan, setTomorrowPlan] = useState(existingReport?.tomorrow_plan ?? '');

  const submitMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      if (existingReport) {
        const { error } = await supabase
          .from('daily_reports')
          .update({
            summary,
            issues: issues || null,
            tomorrow_plan: tomorrowPlan || null,
            status: '제출완료',
            updated_at: now,
          })
          .eq('id', existingReport.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('daily_reports').insert({
          user_id: userId,
          report_date: date,
          summary,
          issues: issues || null,
          tomorrow_plan: tomorrowPlan || null,
          status: '제출완료',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReports.byDate(date) });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            일일 보고 - {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">오늘 업무 요약 *</label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="오늘 수행한 업무 내용을 요약해주세요..."
              className="text-[13px] min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">이슈 / 문제사항</label>
            <Textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="발생한 이슈나 문제가 있다면 작성해주세요..."
              className="text-[13px] min-h-[60px]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">내일 계획</label>
            <Textarea
              value={tomorrowPlan}
              onChange={(e) => setTomorrowPlan(e.target.value)}
              placeholder="내일 진행할 계획을 작성해주세요..."
              className="text-[13px] min-h-[60px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
          <Button
            size="sm"
            onClick={() => submitMutation.mutate()}
            disabled={!summary.trim() || submitMutation.isPending}
          >
            <Send className="size-3 mr-1" />
            {submitMutation.isPending ? '제출 중...' : '보고서 제출'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Page ─────────────────────────────── */
export default function DailyReportPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isAdmin = useIsAdmin();

  const [date, setDate] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Client-only date init to avoid SSR/CSR hydration mismatch (UTC vs KST)
  useEffect(() => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

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
      return (data ?? []) as User[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('loop_order');
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active')
        .order('campaign_name');
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const { data: checks = [] } = useQuery({
    queryKey: queryKeys.checks.byDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .eq('check_date', date);
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
    enabled: !!date,
  });

  const { data: taskConfigs = [] } = useQuery({
    queryKey: queryKeys.taskConfig.all,
    queryFn: () => fetchAll<CampaignTaskConfig>(supabase, 'campaign_task_config'),
  });

  const { data: allSteps = [] } = useQuery({
    queryKey: ['taskSteps', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_steps')
        .select('*')
        .order('step_order');
      if (error) throw error;
      return (data ?? []) as TaskStep[];
    },
  });

  const { data: stepChecks = [] } = useQuery({
    queryKey: queryKeys.stepChecks.byDate(date),
    queryFn: async () => {
      // Get step checks for all daily_checks of this date
      const checkIds = checks.map((c) => c.id);
      if (checkIds.length === 0) return [];
      const { data, error } = await supabase
        .from('step_checks')
        .select('*')
        .in('daily_check_id', checkIds);
      if (error) throw error;
      return (data ?? []) as StepCheck[];
    },
    enabled: !!date && checks.length > 0,
  });

  const { data: training = [] } = useQuery({
    queryKey: queryKeys.training.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_training')
        .select('*');
      if (error) throw error;
      return (data ?? []) as TaskTraining[];
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: queryKeys.dailyReports.byDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('report_date', date);
      if (error) throw error;
      return (data ?? []) as DailyReport[];
    },
    enabled: !!date,
  });

  // ── Confirm report mutation ──
  const confirmMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('daily_reports')
        .update({
          status: '확인완료',
          confirmed_by: profile?.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReports.byDate(date) });
    },
  });

  // ── Navigation helpers ──
  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(format(d, 'yyyy-MM-dd'));
  };
  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(format(d, 'yyyy-MM-dd'));
  };

  // ── Overall stats ──
  const overallStats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let submittedReports = 0;
    let confirmedReports = 0;
    let untrainedCount = 0;

    for (const user of users) {
      const userChecks = checks.filter((c) => c.assigned_user_id === user.id);
      totalTasks += userChecks.length;
      completedTasks += userChecks.filter((c) => c.status === '완료' || c.status === '해당없음').length;

      const userReport = reports.find((r) => r.user_id === user.id);
      if (userReport?.status === '제출완료' || userReport?.status === '확인완료') submittedReports++;
      if (userReport?.status === '확인완료') confirmedReports++;
    }

    const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const reportPct = users.length > 0 ? Math.round((submittedReports / users.length) * 100) : 0;

    return { totalTasks, completedTasks, taskPct, submittedReports, confirmedReports, reportPct };
  }, [users, checks, reports]);

  // ── Filter users ──
  const filteredUsers = useMemo(() => {
    if (filterUser === 'all') return users;
    return users.filter((u) => u.id === filterUser);
  }, [users, filterUser]);

  const myReport = useMemo(() => {
    if (!profile) return null;
    return reports.find((r) => r.user_id === profile.id) ?? null;
  }, [reports, profile]);

  // Wait for client-side date initialization
  if (!date) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {/* Header */}
        <motion.div variants={fadeUpItem}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black tracking-tight">일일 보고서</h1>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                담당자별 업무 완료 현황, Step별 진행도, 교육 이수 여부를 한눈에 확인하고 일일 보고를 관리합니다.
              </p>
            </div>
            {profile && (
              <Button
                size="sm"
                className="text-[11px] h-8"
                onClick={() => setReportDialogOpen(true)}
              >
                <Send className="size-3 mr-1.5" />
                내 보고서 {myReport ? '수정' : '작성'}
              </Button>
            )}
          </div>
        </motion.div>

        {/* Date Nav + Filters + KPI */}
        <motion.div variants={fadeUpItem} className="flex flex-wrap items-center gap-3">
          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-full px-1 py-0.5">
            <Button variant="ghost" size="icon-xs" onClick={prevDay}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-2 h-7">
                  {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(date)}
                  onSelect={(d) => d && setDate(format(d, 'yyyy-MM-dd'))}
                  locale={ko}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon-xs" onClick={nextDay}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          {/* User filter */}
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[140px] h-7 text-[11px]">
              <SelectValue placeholder="담당자 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 담당자</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* KPI chips */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1 bg-secondary/50 rounded-full px-2.5 py-1 text-[10px]">
              <ListChecks className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">업무</span>
              <span className="font-bold">{overallStats.completedTasks}/{overallStats.totalTasks}</span>
              <span className={cn(
                'font-bold',
                overallStats.taskPct >= 80 ? 'text-emerald-500' : overallStats.taskPct >= 50 ? 'text-amber-500' : 'text-destructive'
              )}>
                ({overallStats.taskPct}%)
              </span>
            </div>
            <div className="flex items-center gap-1 bg-secondary/50 rounded-full px-2.5 py-1 text-[10px]">
              <ClipboardCheck className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">보고서</span>
              <span className="font-bold">{overallStats.submittedReports}/{users.length}</span>
              <span className={cn(
                'font-bold',
                overallStats.reportPct >= 80 ? 'text-emerald-500' : overallStats.reportPct >= 50 ? 'text-amber-500' : 'text-destructive'
              )}>
                ({overallStats.reportPct}%)
              </span>
            </div>
          </div>
        </motion.div>

        {/* Assignee Cards */}
        <motion.div variants={fadeUpItem} className="space-y-3">
          {filteredUsers.map((user) => (
            <AssigneeReportCard
              key={user.id}
              user={user}
              date={date}
              tasks={tasks}
              checks={checks}
              campaigns={campaigns}
              taskConfigs={taskConfigs}
              steps={allSteps}
              stepChecks={stepChecks}
              training={training}
              report={reports.find((r) => r.user_id === user.id) ?? null}
              isAdmin={isAdmin ?? false}
              onConfirmReport={(id) => confirmMutation.mutate(id)}
            />
          ))}

          {filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <UserIcon className="size-8 opacity-20" />
              <span className="text-sm">활성 담당자가 없습니다.</span>
            </div>
          )}
        </motion.div>

        {/* Report Dialog */}
        {profile && reportDialogOpen && (
          <MyReportDialog
            open={reportDialogOpen}
            onClose={() => setReportDialogOpen(false)}
            date={date}
            userId={profile.id}
            existingReport={myReport}
          />
        )}
      </motion.div>
    </TooltipProvider>
  );
}
