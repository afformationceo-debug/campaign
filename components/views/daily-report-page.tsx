'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  ClipboardCheck,
  Clock,
  Eye,
  FileCheck,
  FileText,
  GraduationCap,
  Send,
  Target,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import {
  buildDailyReportInsights,
  buildUserDailyReportItems,
  type DailyReportInsightEntry,
  type DailyReportInsights,
  type DailyReportTaskItem,
} from '@/lib/daily-report/report-insights';
import type {
  Campaign,
  CampaignTaskConfig,
  DailyCheck,
  DailyReport,
  StepCheck,
  Task,
  TaskTraining,
  TaskStep,
  User,
} from '@/lib/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STATUS_CONFIG = {
  완료: {
    label: '완료',
    color: 'text-emerald-600',
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    icon: CheckCircle2,
  },
  진행중: {
    label: '진행중',
    color: 'text-blue-600',
    badge: 'bg-blue-500/10 text-blue-600 border-blue-200',
    icon: Clock,
  },
  미완료: {
    label: '미완료',
    color: 'text-muted-foreground',
    badge: 'bg-secondary/60 text-muted-foreground border-border',
    icon: Circle,
  },
  해당없음: {
    label: '해당없음',
    color: 'text-muted-foreground/70',
    badge: 'bg-secondary/40 text-muted-foreground border-border',
    icon: Circle,
  },
} as const;

const EMPTY_INSIGHTS: DailyReportInsights = {
  totalTasks: 0,
  completedTasks: 0,
  inProgressTasks: 0,
  pendingTasks: 0,
  notTrainedCount: 0,
  resultValueCount: 0,
  completedStepCount: 0,
  totalStepCount: 0,
  activeCampaignCount: 0,
  highlightEntries: [],
  attentionEntries: [],
  headline: '완료 0건 · 결과 근거 0건 · 후속 확인 0건',
};

type ReportSection = {
  label: string;
  value: string | null;
  tone?: 'default' | 'warning' | 'info';
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function getTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function getCompletionColor(value: number) {
  if (value >= 80) return 'text-emerald-500';
  if (value >= 50) return 'text-amber-500';
  return 'text-destructive';
}

function ReportStatusBadge({ status }: { status: DailyReport['status'] }) {
  if (status === '확인완료') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
        <Eye className="mr-1 size-3" />
        확인완료
      </Badge>
    );
  }

  if (status === '제출완료') {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]">
        <Send className="mr-1 size-3" />
        제출완료
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[10px]">
      미제출
    </Badge>
  );
}

function InsightList({
  title,
  description,
  entries,
  emptyMessage,
  tone = 'default',
  showUserName = false,
}: {
  title: string;
  description: string;
  entries: Array<DailyReportInsightEntry & { userName?: string }>;
  emptyMessage: string;
  tone?: 'default' | 'warning';
  showUserName?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed px-3 py-5 text-[12px] text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry) => {
            const statusConf = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.미완료;
            const StatusIcon = statusConf.icon;
            const categoryStyle = CATEGORY_COLORS[entry.category];
            const note = hasText(entry.resultValue)
              ? entry.resultValue
              : entry.status === '진행중'
                ? '후속 확인이 필요한 진행 중 항목입니다.'
                : entry.status === '미완료'
                  ? '아직 결과 근거가 남지 않은 항목입니다.'
                  : '운영 근거는 남았지만 결과 설명은 아직 없습니다.';

            return (
              <div
                key={`${entry.userName ?? 'user'}:${entry.taskId}:${entry.campaignName}`}
                className={cn(
                  'rounded-xl border px-3 py-3',
                  tone === 'warning' ? 'bg-amber-50/60 border-amber-200/60' : 'bg-secondary/20'
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('text-[9px]', statusConf.badge)}>
                    <StatusIcon className="mr-1 size-2.5" />
                    {statusConf.label}
                  </Badge>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[9px] font-semibold',
                      categoryStyle.bg,
                      categoryStyle.text,
                      categoryStyle.border
                    )}
                  >
                    {entry.category}
                  </span>
                  {showUserName && entry.userName && (
                    <span className="text-[10px] font-semibold text-foreground">{entry.userName}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{entry.campaignName}</span>
                </div>

                <div className="mt-2 text-[12px] font-semibold text-foreground">{entry.taskName}</div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{note}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  {entry.stepProgressLabel && (
                    <span className="rounded-full bg-background px-2 py-0.5">{entry.stepProgressLabel}</span>
                  )}
                  {entry.timeRangeLabel && (
                    <span className="rounded-full bg-background px-2 py-0.5">{entry.timeRangeLabel}</span>
                  )}
                  {!entry.isTrained && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">교육 미이수</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportNarrative({
  report,
  isAdmin,
  onConfirmReport,
}: {
  report: DailyReport | null;
  isAdmin: boolean;
  onConfirmReport: (reportId: string) => void;
}) {
  const sections: ReportSection[] = [
    { label: '오늘 나온 결과', value: report?.summary ?? null },
    { label: '영향 / 변화', value: report?.impact_summary ?? null, tone: 'info' },
    { label: '막힌 이슈 / 리스크', value: report?.issues ?? null, tone: 'warning' },
    { label: '지원 필요 / 의사결정 요청', value: report?.support_needed ?? null, tone: 'info' },
    { label: '내일 집중', value: report?.tomorrow_plan ?? null },
  ];

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight">담당자 서술 보고</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            자동 수집된 근거 위에 실제 영향, 리스크, 지원 요청을 덧붙이는 구역입니다.
          </p>
        </div>
        <ReportStatusBadge status={report?.status ?? '미제출'} />
      </div>

      {!report ? (
        <div className="mt-4 rounded-xl border border-dashed px-3 py-5 text-[12px] text-muted-foreground">
          아직 제출된 일일 보고가 없습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {sections
            .filter((section) => hasText(section.value))
            .map((section) => (
              <div
                key={section.label}
                className={cn(
                  'rounded-xl border px-3 py-3',
                  section.tone === 'warning'
                    ? 'border-amber-200 bg-amber-50/70'
                    : section.tone === 'info'
                      ? 'border-sky-200 bg-sky-50/60'
                      : 'bg-secondary/20'
                )}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {section.label}
                </div>
                <p className="mt-1 text-[12px] leading-5 text-foreground">{section.value}</p>
              </div>
            ))}

          {!sections.some((section) => hasText(section.value)) && (
            <div className="rounded-xl border border-dashed px-3 py-5 text-[12px] text-muted-foreground">
              보고서는 제출되었지만 결과/영향/지원 요청 서술은 아직 비어 있습니다.
            </div>
          )}
        </div>
      )}

      {isAdmin && report?.status === '제출완료' && (
        <Button size="sm" className="mt-4 h-8 text-[11px]" onClick={() => onConfirmReport(report.id)}>
          <Eye className="mr-1 size-3.5" />
          확인 완료 처리
        </Button>
      )}
    </div>
  );
}

function EvidenceTable({ items }: { items: DailyReportTaskItem[] }) {
  const groupedItems = useMemo(() => {
    const grouped = new Map<string, DailyReportTaskItem[]>();

    items.forEach((item) => {
      const current = grouped.get(item.task.category) ?? [];
      current.push(item);
      grouped.set(item.task.category, current);
    });

    return CATEGORY_ORDER
      .filter((category) => grouped.has(category))
      .map((category) => ({
        category,
        items: grouped.get(category) ?? [],
      }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-3 py-5 text-[12px] text-muted-foreground">
        자동으로 수집된 근거 업무가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-left">
        <thead className="bg-secondary/40">
          <tr>
            <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground">업무</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground">캠페인</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground">상태</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground">결과 근거</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground">Step</th>
            <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground">시간</th>
          </tr>
        </thead>
        <tbody>
          {groupedItems.map(({ category, items: categoryItems }) => {
            const categoryStyle = CATEGORY_COLORS[category];

            return (
              <Fragment key={category}>
                <tr className="border-t bg-background">
                  <td colSpan={6} className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-1 text-[10px] font-semibold',
                        categoryStyle.bg,
                        categoryStyle.text,
                        categoryStyle.border
                      )}
                    >
                      {category}
                    </span>
                  </td>
                </tr>
                {categoryItems.map((item) => {
                  const statusConf = STATUS_CONFIG[item.check?.status ?? '미완료'] ?? STATUS_CONFIG.미완료;
                  const StatusIcon = statusConf.icon;
                  const timeRange = item.check?.started_at
                    ? `${format(new Date(item.check.started_at), 'HH:mm')}~${item.check.completed_at ? format(new Date(item.check.completed_at), 'HH:mm') : ''}`
                    : '-';

                  return (
                    <tr
                      key={`${item.task.id}:${item.campaign?.id ?? 'global'}`}
                      className="border-t border-border/60 align-top"
                    >
                      <td className="px-3 py-2.5">
                        <div className="text-[12px] font-medium text-foreground">{item.task.task_name}</div>
                        {!item.isTrained && (
                          <div className="mt-1 text-[10px] text-amber-600">교육 미이수</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                        {item.campaign?.campaign_name ?? '전역 업무'}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={cn('text-[9px]', statusConf.badge)}>
                          <StatusIcon className="mr-1 size-2.5" />
                          {statusConf.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-foreground">
                        {item.check?.result_value ? item.check.result_value : '결과값 없음'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                        {item.totalSteps > 0 ? `${item.completedSteps}/${item.totalSteps}` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{timeRange}</td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssigneeReportCard({
  user,
  reportItems,
  insights,
  report,
  isAdmin,
  onConfirmReport,
}: {
  user: User;
  reportItems: DailyReportTaskItem[];
  insights: DailyReportInsights;
  report: DailyReport | null;
  isAdmin: boolean;
  onConfirmReport: (reportId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (reportItems.length === 0 && !report) {
    return null;
  }

  const completionPct = insights.totalTasks > 0
    ? Math.round((insights.completedTasks / insights.totalTasks) * 100)
    : 0;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/20"
      >
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <UserIcon className="size-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{user.name}</span>
            {user.position && (
              <span className="text-[10px] text-muted-foreground">{user.position}</span>
            )}
            <ReportStatusBadge status={report?.status ?? '미제출'} />
            {hasText(report?.impact_summary) && (
              <Badge variant="outline" className="text-[10px]">
                영향 기록
              </Badge>
            )}
            {hasText(report?.support_needed) && (
              <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-[10px]">
                지원 요청
              </Badge>
            )}
            {insights.notTrainedCount > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                <GraduationCap className="mr-1 size-3" />
                미교육 {insights.notTrainedCount}
              </Badge>
            )}
          </div>

          <p className="mt-1 text-[11px] text-muted-foreground">
            {reportItems.length > 0 ? insights.headline : '자동 수집된 업무 근거는 없고, 담당자 서술 보고만 있습니다.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[200px] items-center gap-2">
              <Progress value={completionPct} className="h-1.5" />
              <span className={cn('text-[11px] font-bold tabular-nums', getCompletionColor(completionPct))}>
                {completionPct}%
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              결과 {insights.highlightEntries.length}건
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              후속 {insights.attentionEntries.length}건
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              근거 {insights.resultValueCount}건
            </Badge>
          </div>
        </div>

        <div className="pt-1 text-muted-foreground">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t">
          <div className="grid gap-4 border-b bg-secondary/10 p-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <InsightList
                title="자동 수집된 오늘 결과"
                description="체크 상태, 결과값, Step 진행, 시간 기록을 바탕으로 실제 진척을 추린 목록입니다."
                entries={insights.highlightEntries}
                emptyMessage="오늘 결과로 잡힌 업무가 아직 없습니다."
              />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricMiniCard label="완료" value={`${insights.completedTasks}건`} />
                <MetricMiniCard label="결과 근거" value={`${insights.resultValueCount}건`} />
                <MetricMiniCard label="Step" value={`${insights.completedStepCount}/${insights.totalStepCount || 0}`} />
                <MetricMiniCard label="활성 캠페인" value={`${insights.activeCampaignCount}개`} />
              </div>

              <InsightList
                title="후속 확인 / 리스크 신호"
                description="진행 중, 미완료, 교육 미이수 같은 후속 대응 신호를 모았습니다."
                entries={insights.attentionEntries}
                emptyMessage="즉시 후속 확인이 필요한 항목이 없습니다."
                tone="warning"
              />
            </div>

            <ReportNarrative
              report={report}
              isAdmin={isAdmin}
              onConfirmReport={onConfirmReport}
            />
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileCheck className="size-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-bold tracking-tight">근거가 된 업무 상세</h3>
                <p className="text-[11px] text-muted-foreground">
                  담당자 체크판 전체가 아니라, 보고서 판단에 필요한 운영 근거를 내려다보는 표입니다.
                </p>
              </div>
            </div>

            <EvidenceTable items={reportItems} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  valueClassName,
}: {
  icon: ElementType;
  label: string;
  value: string;
  subValue: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div className={cn('mt-2 text-xl font-black tracking-tight', valueClassName)}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{subValue}</div>
    </div>
  );
}

function MyReportDialog({
  open,
  onClose,
  date,
  userId,
  existingReport,
  insights,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  userId: string;
  existingReport: DailyReport | null;
  insights: DailyReportInsights;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState(() => existingReport?.summary ?? '');
  const [impactSummary, setImpactSummary] = useState(() => existingReport?.impact_summary ?? '');
  const [issues, setIssues] = useState(() => existingReport?.issues ?? '');
  const [supportNeeded, setSupportNeeded] = useState(() => existingReport?.support_needed ?? '');
  const [tomorrowPlan, setTomorrowPlan] = useState(() => existingReport?.tomorrow_plan ?? '');

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        summary: summary.trim(),
        impact_summary: impactSummary.trim() || null,
        issues: issues.trim() || null,
        support_needed: supportNeeded.trim() || null,
        tomorrow_plan: tomorrowPlan.trim() || null,
        status: '제출완료' as const,
        updated_at: new Date().toISOString(),
      };

      if (existingReport) {
        const { error } = await supabase
          .from('daily_reports')
          .update(payload)
          .eq('id', existingReport.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('daily_reports').insert({
        user_id: userId,
        report_date: date,
        ...payload,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReports.byDate(date) });
      onClose();
    },
  });

  const evidenceEntries = useMemo(
    () => [...insights.highlightEntries.slice(0, 3), ...insights.attentionEntries.slice(0, 2)],
    [insights]
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            결과 중심 일일 보고 - {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
          </DialogTitle>
          <DialogDescription>
            체크리스트를 다시 적는 대신, 자동으로 모인 근거를 보고 실제 결과와 영향만 정리합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border bg-secondary/15 p-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-bold">오늘 시스템이 잡은 근거</h3>
                <p className="text-[11px] text-muted-foreground">{insights.headline}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {evidenceEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-background px-3 py-4 text-[12px] text-muted-foreground">
                  자동 근거가 아직 없습니다. 체크 업데이트 후 다시 열면 근거가 더 명확해집니다.
                </div>
              ) : (
                evidenceEntries.map((entry) => {
                  const statusConf = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.미완료;
                  const StatusIcon = statusConf.icon;

                  return (
                    <div key={`${entry.taskId}:${entry.campaignName}`} className="rounded-xl border bg-background px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn('text-[9px]', statusConf.badge)}>
                          <StatusIcon className="mr-1 size-2.5" />
                          {statusConf.label}
                        </Badge>
                        <span className="text-[10px] font-semibold">{entry.taskName}</span>
                        <span className="text-[10px] text-muted-foreground">{entry.campaignName}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {hasText(entry.resultValue)
                          ? entry.resultValue
                          : entry.stepProgressLabel ?? entry.timeRangeLabel ?? '상세 근거 없음'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">오늘 나온 결과 *</label>
              <Textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="완료, 승인, 발송, 배포, 정리, 확정처럼 오늘 실제로 바뀐 결과를 적어주세요."
                className="min-h-[84px] text-[13px]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">영향 / 변화</label>
              <Textarea
                value={impactSummary}
                onChange={(event) => setImpactSummary(event.target.value)}
                placeholder="그 결과로 고객, 캠페인, 일정, 팀에 어떤 변화가 생겼는지 적어주세요."
                className="min-h-[72px] text-[13px]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">막힌 이슈 / 리스크</label>
              <Textarea
                value={issues}
                onChange={(event) => setIssues(event.target.value)}
                placeholder="지연, 대기, 품질 이슈, 누락 위험 등 오늘 드러난 리스크를 적어주세요."
                className="min-h-[72px] text-[13px]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">지원 필요 / 의사결정 요청</label>
              <Textarea
                value={supportNeeded}
                onChange={(event) => setSupportNeeded(event.target.value)}
                placeholder="상급자 승인, 타부서 협조, 리소스 지원 등 필요한 도움을 적어주세요."
                className="min-h-[72px] text-[13px]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">내일 집중</label>
              <Textarea
                value={tomorrowPlan}
                onChange={(event) => setTomorrowPlan(event.target.value)}
                placeholder="다음 날 반드시 이어갈 핵심 한두 가지를 적어주세요."
                className="min-h-[72px] text-[13px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={() => submitMutation.mutate()}
            disabled={!summary.trim() || submitMutation.isPending}
          >
            <Send className="mr-1 size-3.5" />
            {submitMutation.isPending ? '제출 중...' : '결과 보고 제출'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DailyReportPageView() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isAdmin = useIsAdmin();

  const [date, setDate] = useState(getTodayDate);
  const [filterUser, setFilterUser] = useState('all');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

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
        .order('loop_order', { ascending: true });

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
        .order('campaign_name', { ascending: true });

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
    enabled: Boolean(date),
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
        .order('step_order', { ascending: true });

      if (error) throw error;
      return (data ?? []) as TaskStep[];
    },
  });

  const { data: stepChecks = [] } = useQuery({
    queryKey: queryKeys.stepChecks.byDate(date),
    queryFn: async () => {
      const checkIds = checks.map((check) => check.id);
      if (checkIds.length === 0) return [];

      const { data, error } = await supabase
        .from('step_checks')
        .select('*')
        .in('daily_check_id', checkIds);

      if (error) throw error;
      return (data ?? []) as StepCheck[];
    },
    enabled: Boolean(date) && checks.length > 0,
  });

  const { data: training = [] } = useQuery({
    queryKey: queryKeys.training.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('task_training').select('*');

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
    enabled: Boolean(date),
  });

  const confirmMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('daily_reports')
        .update({
          status: '확인완료',
          confirmed_by: profile?.id ?? null,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReports.byDate(date) });
    },
  });

  const filteredUsers = useMemo(() => {
    if (filterUser === 'all') return users;
    return users.filter((user) => user.id === filterUser);
  }, [filterUser, users]);

  const reportByUserId = useMemo(() => {
    const map = new Map<string, DailyReport>();
    reports.forEach((report) => map.set(report.user_id, report));
    return map;
  }, [reports]);

  const reportDataByUserId = useMemo(() => {
    const map = new Map<string, { items: DailyReportTaskItem[]; insights: DailyReportInsights }>();

    users.forEach((user) => {
      const items = buildUserDailyReportItems({
        user,
        tasks,
        checks,
        campaigns,
        taskConfigs,
        steps: allSteps,
        stepChecks,
        training,
      });

      map.set(user.id, {
        items,
        insights: buildDailyReportInsights(items),
      });
    });

    return map;
  }, [users, tasks, checks, campaigns, taskConfigs, allSteps, stepChecks, training]);

  const overallStats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let resultValueCount = 0;
    let followUpCount = 0;
    let submittedReports = 0;
    let confirmedReports = 0;
    let supportRequestCount = 0;
    let impactRecordedCount = 0;

    const highlightPool: Array<DailyReportInsightEntry & { userName: string }> = [];
    const supportRequests: Array<{ userName: string; supportNeeded: string | null; issues: string | null }> = [];

    filteredUsers.forEach((user) => {
      const reportData = reportDataByUserId.get(user.id) ?? { items: [], insights: EMPTY_INSIGHTS };
      const report = reportByUserId.get(user.id) ?? null;

      totalTasks += reportData.insights.totalTasks;
      completedTasks += reportData.insights.completedTasks;
      resultValueCount += reportData.insights.resultValueCount;
      followUpCount += reportData.insights.inProgressTasks + reportData.insights.pendingTasks;

      reportData.insights.highlightEntries.slice(0, 2).forEach((entry) => {
        highlightPool.push({ ...entry, userName: user.name });
      });

      if (report?.status === '제출완료' || report?.status === '확인완료') {
        submittedReports += 1;
      }
      if (report?.status === '확인완료') {
        confirmedReports += 1;
      }
      if (hasText(report?.support_needed)) {
        supportRequestCount += 1;
      }
      if (hasText(report?.impact_summary)) {
        impactRecordedCount += 1;
      }
      if (hasText(report?.support_needed) || hasText(report?.issues)) {
        supportRequests.push({
          userName: user.name,
          supportNeeded: report?.support_needed ?? null,
          issues: report?.issues ?? null,
        });
      }
    });

    const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const reportPct = filteredUsers.length > 0 ? Math.round((submittedReports / filteredUsers.length) * 100) : 0;

    highlightPool.sort((left, right) => {
      const leftScore = (left.status === '완료' ? 20 : left.status === '진행중' ? 10 : 0) + (hasText(left.resultValue) ? 3 : 0);
      const rightScore = (right.status === '완료' ? 20 : right.status === '진행중' ? 10 : 0) + (hasText(right.resultValue) ? 3 : 0);
      return rightScore - leftScore;
    });

    return {
      totalTasks,
      completedTasks,
      resultValueCount,
      followUpCount,
      submittedReports,
      confirmedReports,
      supportRequestCount,
      impactRecordedCount,
      completionPct,
      reportPct,
      highlights: highlightPool.slice(0, 6),
      supportRequests: supportRequests.slice(0, 6),
    };
  }, [filteredUsers, reportByUserId, reportDataByUserId]);

  const visibleUsers = useMemo(
    () => filteredUsers.filter((user) => {
      const reportData = reportDataByUserId.get(user.id);
      const report = reportByUserId.get(user.id);
      return Boolean(reportData?.items.length || report);
    }),
    [filteredUsers, reportByUserId, reportDataByUserId]
  );

  const myReport = useMemo(() => {
    if (!profile) return null;
    return reportByUserId.get(profile.id) ?? null;
  }, [profile, reportByUserId]);

  const myInsights = useMemo(() => {
    if (!profile) return EMPTY_INSIGHTS;
    return reportDataByUserId.get(profile.id)?.insights ?? EMPTY_INSIGHTS;
  }, [profile, reportDataByUserId]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      <motion.div variants={fadeUpItem}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-black tracking-tight">일일 보고서</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              담당자 체크를 다시 보여주는 화면이 아니라, 실제 결과와 영향, 후속 대응이 무엇인지 보도록 바꾼 일일 리뷰 보드입니다.
            </p>
          </div>

          {profile && (
            <Button size="sm" className="h-8 text-[11px]" onClick={() => setReportDialogOpen(true)}>
              <Send className="mr-1.5 size-3.5" />
              내 결과 보고 {myReport ? '수정' : '작성'}
            </Button>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-secondary/50 px-1 py-0.5">
          <Button variant="ghost" size="icon-xs" onClick={() => {
            const previousDate = new Date(date);
            previousDate.setDate(previousDate.getDate() - 1);
            setDate(format(previousDate, 'yyyy-MM-dd'));
          }}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px] font-semibold">
                {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(date)}
                onSelect={(selectedDate) => {
                  if (selectedDate) {
                    setDate(format(selectedDate, 'yyyy-MM-dd'));
                  }
                }}
                locale={ko}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon-xs" onClick={() => {
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            setDate(format(nextDate, 'yyyy-MM-dd'));
          }}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>

        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="h-7 w-[160px] text-[11px]">
            <SelectValue placeholder="담당자 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 담당자</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={CheckCircle2}
          label="완료된 결과"
          value={`${overallStats.completedTasks}건`}
          subValue={`전체 ${overallStats.totalTasks}건 중 ${overallStats.completionPct}%`}
          valueClassName={getCompletionColor(overallStats.completionPct)}
        />
        <MetricCard
          icon={FileText}
          label="결과 근거 등록"
          value={`${overallStats.resultValueCount}건`}
          subValue="result_value 또는 운영 근거가 남은 업무"
        />
        <MetricCard
          icon={AlertTriangle}
          label="후속 확인"
          value={`${overallStats.followUpCount}건`}
          subValue="진행중 + 미완료 기준"
          valueClassName={overallStats.followUpCount > 0 ? 'text-amber-600' : undefined}
        />
        <MetricCard
          icon={Target}
          label="지원 요청"
          value={`${overallStats.supportRequestCount}건`}
          subValue={`영향 기록 ${overallStats.impactRecordedCount}건`}
          valueClassName={overallStats.supportRequestCount > 0 ? 'text-amber-600' : undefined}
        />
        <MetricCard
          icon={ClipboardCheck}
          label="보고 제출"
          value={`${overallStats.submittedReports}/${filteredUsers.length}`}
          subValue={`확인완료 ${overallStats.confirmedReports}건 · 제출율 ${overallStats.reportPct}%`}
          valueClassName={getCompletionColor(overallStats.reportPct)}
        />
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <InsightList
          title="오늘 조직이 실제로 움직인 결과"
          description="담당자별 자동 수집 결과 중 우선순위가 높은 근거를 모았습니다."
          entries={overallStats.highlights}
          emptyMessage="오늘 결과로 떠오른 근거가 아직 없습니다."
          showUserName
        />

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">지원 / 의사결정 요청</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                담당자 보고에서 바로 대응이 필요한 요청과 리스크를 모은 목록입니다.
              </p>
            </div>
          </div>

          {overallStats.supportRequests.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed px-3 py-5 text-[12px] text-muted-foreground">
              현재 노출된 지원 요청이나 주요 리스크가 없습니다.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {overallStats.supportRequests.map((item) => (
                <div key={item.userName} className="rounded-xl border bg-amber-50/60 px-3 py-3">
                  <div className="text-[12px] font-semibold">{item.userName}</div>
                  {hasText(item.supportNeeded) && (
                    <p className="mt-1 text-[11px] leading-5 text-foreground">{item.supportNeeded}</p>
                  )}
                  {hasText(item.issues) && (
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.issues}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem} className="space-y-3">
        {visibleUsers.map((user) => {
          const reportData = reportDataByUserId.get(user.id) ?? { items: [], insights: EMPTY_INSIGHTS };

          return (
            <AssigneeReportCard
              key={user.id}
              user={user}
              reportItems={reportData.items}
              insights={reportData.insights}
              report={reportByUserId.get(user.id) ?? null}
              isAdmin={Boolean(isAdmin)}
              onConfirmReport={(reportId) => confirmMutation.mutate(reportId)}
            />
          );
        })}

        {visibleUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <UserIcon className="size-8 opacity-20" />
            <span className="text-sm">표시할 일일 보고 데이터가 없습니다.</span>
          </div>
        )}
      </motion.div>

      {profile && reportDialogOpen && (
        <MyReportDialog
          key={`${date}:${myReport?.id ?? 'new'}`}
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          date={date}
          userId={profile.id}
          existingReport={myReport}
          insights={myInsights}
        />
      )}
    </motion.div>
  );
}
