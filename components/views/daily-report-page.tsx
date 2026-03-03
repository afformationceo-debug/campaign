'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
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
  Flame,
  GraduationCap,
  Layers,
  Send,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  User as UserIcon,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import {
  DAILY_OPS_FLOW,
  DAILY_REPORT_WRITING_GUIDE,
  EXAMPLE_DAY_SCENARIO,
  MANAGER_REVIEW_CHECKLIST,
} from '@/lib/guides/daily-ops-guide';
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

/* ─── Motion Variants (Neural) ─── */
const neuralStagger: Variants = {
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const neuralFadeUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

const neuralScale: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

const expandVariants: Variants = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

/* ─── Status Config ─── */
const STATUS_CONFIG = {
  완료: {
    label: '완료',
    color: 'text-emerald-600',
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    glow: 'shadow-emerald-200/50',
    icon: CheckCircle2,
  },
  진행중: {
    label: '진행중',
    color: 'text-cyan-600',
    badge: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
    glow: 'shadow-cyan-200/50',
    icon: Clock,
  },
  미완료: {
    label: '미완료',
    color: 'text-muted-foreground',
    badge: 'bg-secondary/60 text-muted-foreground border-border',
    glow: '',
    icon: Circle,
  },
  해당없음: {
    label: '해당없음',
    color: 'text-muted-foreground/70',
    badge: 'bg-secondary/40 text-muted-foreground border-border',
    glow: '',
    icon: Circle,
  },
} as const;

/* ─── Section Accent System ─── */
const SECTION_ACCENTS = {
  cyan: {
    border: 'accent-l-cyan',
    bg: 'bg-cyan-50/40',
    text: 'text-cyan-700',
    iconBg: 'bg-cyan-100',
    iconText: 'text-cyan-600',
    emptyBg: 'bg-cyan-50/20',
    emptyBorder: 'border-cyan-200/40',
    ring: 'ring-cyan-200/60',
  },
  violet: {
    border: 'accent-l-violet',
    bg: 'bg-violet-50/40',
    text: 'text-violet-700',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    emptyBg: 'bg-violet-50/20',
    emptyBorder: 'border-violet-200/40',
    ring: 'ring-violet-200/60',
  },
  amber: {
    border: 'accent-l-amber',
    bg: 'bg-amber-50/40',
    text: 'text-amber-700',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    emptyBg: 'bg-amber-50/20',
    emptyBorder: 'border-amber-200/40',
    ring: 'ring-amber-200/60',
  },
  rose: {
    border: 'accent-l-rose',
    bg: 'bg-rose-50/40',
    text: 'text-rose-700',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    emptyBg: 'bg-rose-50/20',
    emptyBorder: 'border-rose-200/40',
    ring: 'ring-rose-200/60',
  },
  emerald: {
    border: 'accent-l-emerald',
    bg: 'bg-emerald-50/40',
    text: 'text-emerald-700',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    emptyBg: 'bg-emerald-50/20',
    emptyBorder: 'border-emerald-200/40',
    ring: 'ring-emerald-200/60',
  },
} as const;

type AccentKey = keyof typeof SECTION_ACCENTS;

const REPORT_SECTION_CONFIG: Array<{
  label: string;
  key: keyof Pick<DailyReport, 'summary' | 'impact_summary' | 'issues' | 'support_needed' | 'tomorrow_plan'>;
  icon: ElementType;
  accent: AccentKey;
  required?: boolean;
  emptyHint: string;
}> = [
  {
    label: '오늘 나온 결과',
    key: 'summary',
    icon: Zap,
    accent: 'cyan',
    required: true,
    emptyHint: '아직 작성되지 않았습니다. 오늘 실제로 완료되거나 확정된 결과를 기록해 주세요.',
  },
  {
    label: '영향 / 변화',
    key: 'impact_summary',
    icon: TrendingUp,
    accent: 'violet',
    emptyHint: '일정, 고객, 매출, 품질에 어떤 변화가 생겼는지 아직 기록이 없습니다.',
  },
  {
    label: '막힌 이슈 / 리스크',
    key: 'issues',
    icon: AlertTriangle,
    accent: 'amber',
    emptyHint: '오늘 드러난 지연, 대기, 품질 이슈가 아직 기록되지 않았습니다.',
  },
  {
    label: '지원 필요 / 의사결정 요청',
    key: 'support_needed',
    icon: Shield,
    accent: 'rose',
    emptyHint: '현재 필요한 지원이나 의사결정 요청이 없습니다.',
  },
  {
    label: '내일 집중',
    key: 'tomorrow_plan',
    icon: Target,
    accent: 'emerald',
    emptyHint: '다음 날 집중할 핵심 항목이 아직 기록되지 않았습니다.',
  },
];

/* ─── Constants ─── */
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

/* ─── Utility Functions ─── */
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

/* ─── UI Components ─── */

function LiveIndicator() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-cyan-400" />
      <span className="relative inline-flex size-2 rounded-full bg-cyan-500" />
    </span>
  );
}

function SectionIcon({
  icon: Icon,
  accent,
  size = 'sm',
}: {
  icon: ElementType;
  accent: AccentKey;
  size?: 'sm' | 'md';
}) {
  const style = SECTION_ACCENTS[accent];
  const sizeClass = size === 'md' ? 'size-8' : 'size-6';
  const iconSize = size === 'md' ? 'size-4' : 'size-3';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg',
        sizeClass,
        style.iconBg,
        style.iconText
      )}
    >
      <Icon className={iconSize} />
    </div>
  );
}

function ReportStatusBadge({ status }: { status: DailyReport['status'] }) {
  if (status === '확인완료') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] shadow-sm shadow-emerald-200/30">
        <Eye className="mr-1 size-3" />
        확인완료
      </Badge>
    );
  }

  if (status === '제출완료') {
    return (
      <Badge className="bg-cyan-500/10 text-cyan-600 border-cyan-200 text-[10px] shadow-sm shadow-cyan-200/30">
        <Send className="mr-1 size-3" />
        제출완료
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[10px] border-dashed">
      미제출
    </Badge>
  );
}

/* ─── Command Flow Pipeline ─── */
function CommandFlowCard() {
  return (
    <motion.div
      variants={neuralScale}
      className="neural-card rounded-2xl border bg-card/80 backdrop-blur-sm p-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-violet-100">
          <Bot className="size-4 text-cyan-700" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight">AI Ops 워크플로우</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            근거 수집 → 결과 정리 → 의미 보고의 3-Step 자동화 파이프라인
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {DAILY_OPS_FLOW.map((step, index) => (
          <div key={step.title} className="group relative">
            <div className="rounded-xl border bg-gradient-to-br from-background to-secondary/30 px-4 py-4 transition-all duration-300 hover:shadow-md hover:shadow-cyan-100/30 hover:border-cyan-200/60">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-cyan-500/10 font-mono text-[10px] font-bold text-cyan-600">
                  {index + 1}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Step
                </span>
              </div>
              <div className="mt-2 text-[12px] font-bold text-foreground">{step.title}</div>
              <p className="mt-1.5 text-[11px] leading-[1.6] text-muted-foreground">{step.description}</p>
            </div>
            {index < 2 && (
              <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                <ArrowRight className="size-3.5 text-cyan-300" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-dashed border-cyan-200/50 bg-cyan-50/20 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-600">
            <Zap className="size-3" />
            결과값 예시
          </div>
          <p className="mt-1.5 text-[11px] text-foreground/80">{EXAMPLE_DAY_SCENARIO.taskEntry}</p>
        </div>
        <div className="rounded-xl border border-dashed border-violet-200/50 bg-violet-50/20 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">
            <FileText className="size-3" />
            보고서 예시
          </div>
          <p className="mt-1.5 text-[11px] text-foreground/80">{EXAMPLE_DAY_SCENARIO.reportSummary}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Report Fields Guide ─── */
function ReportFieldsGuideCard() {
  return (
    <motion.div variants={neuralScale} className="rounded-2xl border bg-card/80 backdrop-blur-sm p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-rose-100">
          <Layers className="size-4 text-violet-700" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight">5-Field 보고 구조</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            각 필드는 색상으로 구분됩니다. 짧고 분명하게 채우면 충분합니다.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {REPORT_SECTION_CONFIG.map((section) => {
          const accent = SECTION_ACCENTS[section.accent];
          return (
            <div
              key={section.label}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-200 hover:shadow-sm',
                accent.border,
                accent.bg
              )}
            >
              <SectionIcon icon={section.icon} accent={section.accent} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-foreground">{section.label}</span>
                  {section.required && (
                    <span className="rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-600">
                      필수
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-[1.5] text-muted-foreground">
                  {DAILY_REPORT_WRITING_GUIDE.find((g) => g.label === section.label)?.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── Manager Checklist ─── */
function ManagerChecklistCard() {
  return (
    <motion.div
      variants={neuralScale}
      className="rounded-2xl border bg-card/80 backdrop-blur-sm p-5 xl:sticky xl:top-20"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
          <Eye className="size-4 text-amber-700" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight">확인 체크리스트</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            확인완료 전에 다섯 가지가 보이면 충분합니다.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {MANAGER_REVIEW_CHECKLIST.map((item, index) => (
          <div
            key={item}
            className="group flex items-start gap-3 rounded-xl border bg-gradient-to-br from-background to-secondary/20 px-4 py-3 transition-all duration-200 hover:border-amber-200/60 hover:shadow-sm hover:shadow-amber-100/30"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 font-mono text-[10px] font-bold text-amber-600 transition-colors group-hover:bg-amber-500/20">
              {index + 1}
            </span>
            <p className="text-[11px] leading-[1.6] text-foreground/80">{item}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Insight List ─── */
function InsightList({
  title,
  description,
  entries,
  emptyMessage,
  tone = 'default',
  icon: Icon = Activity,
  accentColor = 'cyan' as AccentKey,
  showUserName = false,
}: {
  title: string;
  description: string;
  entries: Array<DailyReportInsightEntry & { userName?: string }>;
  emptyMessage: string;
  tone?: 'default' | 'warning';
  icon?: ElementType;
  accentColor?: AccentKey;
  showUserName?: boolean;
}) {
  const accent = SECTION_ACCENTS[accentColor];

  return (
    <div className="neural-card rounded-2xl border bg-card/80 backdrop-blur-sm p-5">
      <div className="mb-4 flex items-center gap-3">
        <SectionIcon icon={Icon} accent={accentColor} size="md" />
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </div>
        {entries.length > 0 && (
          <Badge
            variant="secondary"
            className={cn('ml-auto text-[10px] font-bold tabular-nums', accent.text)}
          >
            {entries.length}
          </Badge>
        )}
      </div>

      {entries.length === 0 ? (
        <div className={cn(
          'rounded-xl border border-dashed px-4 py-6 text-center text-[12px] text-muted-foreground',
          accent.emptyBorder, accent.emptyBg
        )}>
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
              <motion.div
                key={`${entry.userName ?? 'user'}:${entry.taskId}:${entry.campaignName}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'rounded-xl border px-4 py-3.5 transition-all duration-200 hover:shadow-sm',
                  tone === 'warning'
                    ? 'accent-l-amber bg-amber-50/30 hover:shadow-amber-100/40'
                    : `${accent.border} ${accent.bg} hover:shadow-cyan-100/30`
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('text-[9px] shadow-sm', statusConf.badge, statusConf.glow)}>
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
                    <span className="text-[10px] font-bold text-foreground">{entry.userName}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{entry.campaignName}</span>
                </div>

                <div className="mt-2 text-[12px] font-bold text-foreground">{entry.taskName}</div>
                <p className="mt-1 text-[11px] leading-[1.6] text-muted-foreground/80">{note}</p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  {entry.stepProgressLabel && (
                    <span className="rounded-full bg-background/80 px-2 py-0.5 ring-1 ring-border/50">{entry.stepProgressLabel}</span>
                  )}
                  {entry.timeRangeLabel && (
                    <span className="rounded-full bg-background/80 px-2 py-0.5 ring-1 ring-border/50">{entry.timeRangeLabel}</span>
                  )}
                  {!entry.isTrained && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">교육 미이수</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Report Narrative (BUG FIX: always show all 5 sections) ─── */
function ReportNarrative({
  report,
  isAdmin,
  onConfirmReport,
}: {
  report: DailyReport | null;
  isAdmin: boolean;
  onConfirmReport: (reportId: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card/80 backdrop-blur-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100">
            <FileText className="size-4 text-rose-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">서술 보고</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              5가지 필드의 현재 상태입니다.
            </p>
          </div>
        </div>
        <ReportStatusBadge status={report?.status ?? '미제출'} />
      </div>

      <div className="mt-4 space-y-2.5">
        {REPORT_SECTION_CONFIG.map((section) => {
          const value = report?.[section.key] ?? null;
          const filled = hasText(value);
          const accent = SECTION_ACCENTS[section.accent];
          const SectionIconEl = section.icon;

          return (
            <div
              key={section.label}
              className={cn(
                'rounded-xl border px-4 py-3 transition-all duration-200',
                filled
                  ? `${accent.border} ${accent.bg}`
                  : `border-dashed ${accent.emptyBorder} ${accent.emptyBg}`
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex size-5 items-center justify-center rounded-md',
                    filled ? accent.iconBg : 'bg-muted/50'
                  )}
                >
                  <SectionIconEl className={cn('size-3', filled ? accent.iconText : 'text-muted-foreground/50')} />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-[0.12em]',
                    filled ? accent.text : 'text-muted-foreground/60'
                  )}
                >
                  {section.label}
                </span>
                {section.required && !filled && (
                  <span className="ml-auto rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-bold text-rose-500">
                    미작성
                  </span>
                )}
                {filled && (
                  <CheckCircle2 className="ml-auto size-3 text-emerald-400" />
                )}
              </div>
              <p
                className={cn(
                  'mt-1.5 text-[12px] leading-[1.6]',
                  filled ? 'text-foreground' : 'text-muted-foreground/50 italic'
                )}
              >
                {filled ? value : section.emptyHint}
              </p>
            </div>
          );
        })}
      </div>

      {isAdmin && report?.status === '제출완료' && (
        <Button
          size="sm"
          className="mt-4 h-8 bg-emerald-600 text-[11px] text-white shadow-sm shadow-emerald-200/50 hover:bg-emerald-700"
          onClick={() => onConfirmReport(report.id)}
        >
          <Eye className="mr-1.5 size-3.5" />
          확인 완료 처리
        </Button>
      )}
    </div>
  );
}

/* ─── Evidence Table ─── */
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
      <div className="rounded-xl border border-dashed border-cyan-200/40 bg-cyan-50/10 px-4 py-6 text-center text-[12px] text-muted-foreground">
        자동으로 수집된 근거 업무가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border shadow-sm">
      <table className="min-w-full text-left">
        <thead className="bg-gradient-to-r from-secondary/60 to-secondary/30">
          <tr>
            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">업무</th>
            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">캠페인</th>
            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">상태</th>
            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">결과 근거</th>
            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Step</th>
            <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">시간</th>
          </tr>
        </thead>
        <tbody>
          {groupedItems.map(({ category, items: categoryItems }) => {
            const categoryStyle = CATEGORY_COLORS[category];

            return (
              <Fragment key={category}>
                <tr className="border-t bg-gradient-to-r from-secondary/20 to-transparent">
                  <td colSpan={6} className="px-4 py-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-1 text-[10px] font-bold shadow-sm',
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
                      className="border-t border-border/40 align-top transition-colors hover:bg-cyan-50/20"
                    >
                      <td className="px-4 py-3">
                        <div className="text-[12px] font-semibold text-foreground">{item.task.task_name}</div>
                        {!item.isTrained && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
                            <GraduationCap className="size-3" />
                            교육 미이수
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {item.campaign?.campaign_name ?? '전역 업무'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[9px] shadow-sm', statusConf.badge, statusConf.glow)}>
                          <StatusIcon className="mr-1 size-2.5" />
                          {statusConf.label}
                        </Badge>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-[11px] text-foreground">
                        {item.check?.result_value ? (
                          <span className="font-medium">{item.check.result_value}</span>
                        ) : (
                          <span className="text-muted-foreground/50 italic">없음</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {item.totalSteps > 0 ? `${item.completedSteps}/${item.totalSteps}` : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{timeRange}</td>
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

/* ─── Assignee Report Card ─── */
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

  const filledSections = REPORT_SECTION_CONFIG.filter(
    (s) => hasText(report?.[s.key] ?? null)
  ).length;

  return (
    <motion.div
      variants={neuralScale}
      className="group overflow-hidden rounded-2xl border bg-card/80 backdrop-blur-sm shadow-sm transition-shadow duration-300 hover:shadow-md hover:shadow-cyan-100/20"
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start gap-4 px-5 py-5 text-left transition-all duration-300 hover:bg-gradient-to-r hover:from-cyan-50/30 hover:via-violet-50/10 hover:to-transparent"
      >
        <div className="relative mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-violet-100 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:shadow-cyan-200/30">
          <UserIcon className="size-4.5 text-cyan-700" />
          {filledSections >= 5 && (
            <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 shadow-sm shadow-emerald-200/50">
              <CheckCircle2 className="size-2 text-white" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-black tracking-tight">{user.name}</span>
            {user.position && (
              <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] text-muted-foreground">{user.position}</span>
            )}
            <ReportStatusBadge status={report?.status ?? '미제출'} />
            {filledSections > 0 && (
              <Badge variant="secondary" className="text-[9px] font-bold tabular-nums">
                {filledSections}/5 작성
              </Badge>
            )}
            {hasText(report?.support_needed) && (
              <Badge className="bg-rose-500/10 text-rose-600 border-rose-200 text-[10px] shadow-sm shadow-rose-200/30">
                <Shield className="mr-1 size-3" />
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

          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {reportItems.length > 0 ? insights.headline : '자동 수집된 업무 근거는 없고, 담당자 서술 보고만 있습니다.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex min-w-[180px] items-center gap-2.5">
              <Progress value={completionPct} className="h-2 flex-1" />
              <span className={cn('font-mono text-[12px] font-black tabular-nums', getCompletionColor(completionPct))}>
                {completionPct}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] font-semibold">
                <Sparkles className="mr-1 size-3 text-cyan-500" />
                결과 {insights.highlightEntries.length}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                <AlertTriangle className="mr-1 size-3 text-amber-500" />
                후속 {insights.attentionEntries.length}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-semibold tabular-nums">
                근거 {insights.resultValueCount}건
              </Badge>
            </div>
          </div>
        </div>

        <div className="pt-1">
          <div className={cn(
            'flex size-7 items-center justify-center rounded-lg transition-all duration-200',
            expanded ? 'bg-cyan-100 text-cyan-600' : 'bg-secondary text-muted-foreground'
          )}>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            variants={expandVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden border-t"
          >
            <div className="grid gap-4 bg-gradient-to-b from-secondary/10 to-transparent p-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <InsightList
                  title="자동 수집된 오늘 결과"
                  description="체크 상태, 결과값, Step 진행, 시간 기록을 바탕으로 실제 진척을 추린 목록입니다."
                  entries={insights.highlightEntries}
                  emptyMessage="오늘 결과로 잡힌 업무가 아직 없습니다."
                  icon={Sparkles}
                  accentColor="cyan"
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricMiniCard label="완료" value={`${insights.completedTasks}건`} accent="emerald" />
                  <MetricMiniCard label="결과 근거" value={`${insights.resultValueCount}건`} accent="cyan" />
                  <MetricMiniCard label="Step" value={`${insights.completedStepCount}/${insights.totalStepCount || 0}`} accent="violet" />
                  <MetricMiniCard label="활성 캠페인" value={`${insights.activeCampaignCount}개`} accent="amber" />
                </div>

                <InsightList
                  title="후속 확인 / 리스크 신호"
                  description="진행 중, 미완료, 교육 미이수 같은 후속 대응 신호를 모았습니다."
                  entries={insights.attentionEntries}
                  emptyMessage="즉시 후속 확인이 필요한 항목이 없습니다."
                  tone="warning"
                  icon={AlertTriangle}
                  accentColor="amber"
                />
              </div>

              <ReportNarrative
                report={report}
                isAdmin={isAdmin}
                onConfirmReport={onConfirmReport}
              />
            </div>

            <div className="border-t p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100">
                  <FileCheck className="size-4 text-cyan-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">근거 업무 상세</h3>
                  <p className="text-[11px] text-muted-foreground">
                    보고서 판단에 필요한 운영 근거를 내려다보는 표입니다.
                  </p>
                </div>
              </div>

              <EvidenceTable items={reportItems} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Metric Cards ─── */
function MetricMiniCard({
  label,
  value,
  accent = 'cyan',
}: {
  label: string;
  value: string;
  accent?: AccentKey;
}) {
  const style = SECTION_ACCENTS[accent];

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 transition-all duration-200 hover:shadow-sm',
      style.border
    )}>
      <div className={cn('text-[10px] font-bold uppercase tracking-[0.16em]', style.text)}>
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[15px] font-black tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  );
}

function HeroMetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  accent = 'cyan',
  valueClassName,
  index = 0,
}: {
  icon: ElementType;
  label: string;
  value: string;
  subValue: string;
  accent?: AccentKey;
  valueClassName?: string;
  index?: number;
}) {
  const style = SECTION_ACCENTS[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        'neural-card rounded-2xl border bg-card/80 backdrop-blur-sm p-4 transition-all duration-300',
        'hover:shadow-lg hover:shadow-cyan-100/20 hover:-translate-y-0.5',
        style.border
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('flex size-6 items-center justify-center rounded-lg', style.iconBg, style.iconText)}>
          <Icon className="size-3" />
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className={cn('mt-3 font-mono text-2xl font-black tracking-tight animate-number-pop', valueClassName)}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground/70">{subValue}</div>
    </motion.div>
  );
}

/* ─── Report Writing Dialog ─── */
function MyReportDialog({
  open,
  onClose,
  date,
  userId,
  userName,
  existingReport,
  insights,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  userId: string;
  userName: string;
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

  const fields = [
    {
      section: REPORT_SECTION_CONFIG[0],
      value: summary,
      setter: setSummary,
      placeholder: '완료, 승인, 발송, 배포, 정리, 확정처럼 오늘 실제로 바뀐 결과를 적어주세요.',
      minH: 'min-h-[84px]',
    },
    {
      section: REPORT_SECTION_CONFIG[1],
      value: impactSummary,
      setter: setImpactSummary,
      placeholder: '그 결과로 고객, 캠페인, 일정, 팀에 어떤 변화가 생겼는지 적어주세요.',
      minH: 'min-h-[72px]',
    },
    {
      section: REPORT_SECTION_CONFIG[2],
      value: issues,
      setter: setIssues,
      placeholder: '지연, 대기, 품질 이슈, 누락 위험 등 오늘 드러난 리스크를 적어주세요.',
      minH: 'min-h-[72px]',
    },
    {
      section: REPORT_SECTION_CONFIG[3],
      value: supportNeeded,
      setter: setSupportNeeded,
      placeholder: '상급자 승인, 타부서 협조, 리소스 지원 등 필요한 도움을 적어주세요.',
      minH: 'min-h-[72px]',
    },
    {
      section: REPORT_SECTION_CONFIG[4],
      value: tomorrowPlan,
      setter: setTomorrowPlan,
      placeholder: '다음 날 반드시 이어갈 핵심 한두 가지를 적어주세요.',
      minH: 'min-h-[72px]',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-black">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-violet-100">
              <Sparkles className="size-3.5 text-cyan-700" />
            </div>
            결과 중심 보고 — {userName} · {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
          </DialogTitle>
          <DialogDescription>
            자동 근거를 참고하여 결과와 영향만 정리합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border bg-gradient-to-b from-secondary/20 to-background p-4">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-lg bg-cyan-100">
                <BarChart3 className="size-3 text-cyan-600" />
              </div>
              <div>
                <h3 className="text-[12px] font-bold">시스템 근거</h3>
                <p className="text-[10px] text-muted-foreground">{insights.headline}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {evidenceEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-background px-3 py-4 text-center text-[11px] text-muted-foreground">
                  자동 근거가 아직 없습니다.
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
                        <span className="text-[10px] font-bold">{entry.taskName}</span>
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

          <div className="space-y-3">
            {fields.map(({ section, value, setter, placeholder, minH }) => {
              const accent = SECTION_ACCENTS[section.accent];

              return (
                <div key={section.label}>
                  <label className={cn(
                    'mb-1.5 flex items-center gap-2 text-[11px] font-bold',
                    accent.text
                  )}>
                    <SectionIcon icon={section.icon} accent={section.accent} />
                    {section.label}
                    {section.required && <span className="text-rose-400">*</span>}
                  </label>
                  <Textarea
                    value={value}
                    onChange={(event) => setter(event.target.value)}
                    placeholder={placeholder}
                    className={cn(
                      minH,
                      'text-[13px] transition-all duration-200',
                      'focus:ring-2',
                      accent.ring
                    )}
                  />
                </div>
              );
            })}
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
            className="bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-sm shadow-cyan-200/50 hover:from-cyan-700 hover:to-cyan-600"
          >
            <Send className="mr-1.5 size-3.5" />
            {submitMutation.isPending ? '제출 중...' : '결과 보고 제출'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */
export default function DailyReportPageView() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isAdmin = useIsAdmin();

  const [date, setDate] = useState(getTodayDate);
  const [filterUser, setFilterUser] = useState('all');
  const [reportAuthorId, setReportAuthorId] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  /* ── Data Queries ── */
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

  /* ── Mutations ── */
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

  /* ── Computed Data ── */
  const filteredUsers = useMemo(() => {
    if (filterUser === 'all') return users;
    return users.filter((user) => user.id === filterUser);
  }, [filterUser, users]);

  const reportByUserId = useMemo(() => {
    const map = new Map<string, DailyReport>();
    reports.forEach((report) => map.set(report.user_id, report));
    return map;
  }, [reports]);

  const effectiveReportAuthorId = useMemo(() => {
    if (reportAuthorId) return reportAuthorId;
    if (filterUser !== 'all') return filterUser;
    return '';
  }, [filterUser, reportAuthorId]);

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

    type NarrativeEntry = { userName: string; content: string };
    const narrativeSummaries: NarrativeEntry[] = [];
    const narrativeImpacts: NarrativeEntry[] = [];
    const narrativeIssues: NarrativeEntry[] = [];
    const narrativeSupports: NarrativeEntry[] = [];
    const narrativeTomorrows: NarrativeEntry[] = [];

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

      if (hasText(report?.summary)) {
        narrativeSummaries.push({ userName: user.name, content: report!.summary! });
      }
      if (hasText(report?.impact_summary)) {
        narrativeImpacts.push({ userName: user.name, content: report!.impact_summary! });
      }
      if (hasText(report?.issues)) {
        narrativeIssues.push({ userName: user.name, content: report!.issues! });
      }
      if (hasText(report?.support_needed)) {
        narrativeSupports.push({ userName: user.name, content: report!.support_needed! });
      }
      if (hasText(report?.tomorrow_plan)) {
        narrativeTomorrows.push({ userName: user.name, content: report!.tomorrow_plan! });
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
      narrativeSummaries,
      narrativeImpacts,
      narrativeIssues,
      narrativeSupports,
      narrativeTomorrows,
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

  const selectedReportAuthor = useMemo(
    () => users.find((user) => user.id === effectiveReportAuthorId) ?? null,
    [users, effectiveReportAuthorId]
  );

  const selectedAuthorReport = useMemo(() => {
    if (!selectedReportAuthor) return null;
    return reportByUserId.get(selectedReportAuthor.id) ?? null;
  }, [selectedReportAuthor, reportByUserId]);

  const selectedAuthorInsights = useMemo(() => {
    if (!selectedReportAuthor) return EMPTY_INSIGHTS;
    return reportDataByUserId.get(selectedReportAuthor.id)?.insights ?? EMPTY_INSIGHTS;
  }, [selectedReportAuthor, reportDataByUserId]);

  /* ── Render ── */
  return (
    <motion.div
      variants={neuralStagger}
      initial="initial"
      animate="animate"
      className="space-y-5"
    >
      {/* ── Hero Header ── */}
      <motion.div variants={neuralFadeUp} className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-cyan-50/30 p-6 shadow-sm">
        <div className="pointer-events-none absolute inset-0 ai-grid-bg opacity-40" />
        <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-gradient-to-br from-cyan-200/20 to-violet-200/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-gradient-to-tr from-emerald-200/15 to-cyan-200/15 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-cyan-200/40">
                <Bot className="size-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black tracking-tight text-gradient">일일 보고서</h1>
                  <LiveIndicator />
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge className="border-cyan-200 bg-cyan-500/10 text-[9px] font-bold text-cyan-600 shadow-sm shadow-cyan-200/30">
                    <Sparkles className="mr-1 size-2.5" />
                    AI Ops Dashboard
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    결과 근거 자동 수집 · 5-Field 서술 보고 · 실시간 인사이트
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Select
                value={selectedReportAuthor?.id}
                onValueChange={setReportAuthorId}
              >
                <SelectTrigger className="h-9 w-[170px] text-[11px] border-cyan-200/50 focus:ring-cyan-200/50">
                  <SelectValue placeholder="보고 작성자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                className="h-9 bg-gradient-to-r from-cyan-600 to-cyan-500 text-[11px] text-white shadow-md shadow-cyan-200/40 hover:from-cyan-700 hover:to-cyan-600 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-200/50"
                onClick={() => setReportDialogOpen(true)}
                disabled={!selectedReportAuthor}
              >
                <Send className="mr-1.5 size-3.5" />
                {selectedReportAuthor
                  ? `${selectedReportAuthor.name} 결과 보고 ${selectedAuthorReport ? '수정' : '작성'}`
                  : '작성자 선택'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              공용 로그인 환경에서는 실제 작성 담당자를 먼저 선택해 주세요.
            </p>
          </div>
        </div>

        {/* Date & Filter Controls (integrated) */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/40 pt-4">
          <div className="flex items-center gap-1 rounded-xl border bg-background/60 backdrop-blur-sm px-1 py-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="icon-xs"
              className="hover:bg-cyan-50 hover:text-cyan-600"
              onClick={() => {
                const previousDate = new Date(date);
                previousDate.setDate(previousDate.getDate() - 1);
                setDate(format(previousDate, 'yyyy-MM-dd'));
              }}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-3 font-mono text-[12px] font-bold">
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
            <Button
              variant="ghost"
              size="icon-xs"
              className="hover:bg-cyan-50 hover:text-cyan-600"
              onClick={() => {
                const nextDate = new Date(date);
                nextDate.setDate(nextDate.getDate() + 1);
                setDate(format(nextDate, 'yyyy-MM-dd'));
              }}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="h-8 w-[160px] text-[11px] bg-background/60 backdrop-blur-sm">
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
        </div>
      </motion.div>

      {/* ── Hero Metrics ── */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 ai-grid-bg rounded-2xl p-3">
        <HeroMetricCard
          icon={CheckCircle2}
          label="완료된 결과"
          value={`${overallStats.completedTasks}건`}
          subValue={`전체 ${overallStats.totalTasks}건 중 ${overallStats.completionPct}%`}
          valueClassName={getCompletionColor(overallStats.completionPct)}
          accent="emerald"
          index={0}
        />
        <HeroMetricCard
          icon={BarChart3}
          label="결과 근거"
          value={`${overallStats.resultValueCount}건`}
          subValue="result_value 또는 운영 근거"
          accent="cyan"
          index={1}
        />
        <HeroMetricCard
          icon={Flame}
          label="후속 확인"
          value={`${overallStats.followUpCount}건`}
          subValue="진행중 + 미완료 기준"
          valueClassName={overallStats.followUpCount > 0 ? 'text-amber-600' : undefined}
          accent="amber"
          index={2}
        />
        <HeroMetricCard
          icon={Shield}
          label="지원 요청"
          value={`${overallStats.supportRequestCount}건`}
          subValue={`영향 기록 ${overallStats.impactRecordedCount}건`}
          valueClassName={overallStats.supportRequestCount > 0 ? 'text-rose-600' : undefined}
          accent="rose"
          index={3}
        />
        <HeroMetricCard
          icon={ClipboardCheck}
          label="보고 제출"
          value={`${overallStats.submittedReports}/${filteredUsers.length}`}
          subValue={`확인 ${overallStats.confirmedReports}건 · ${overallStats.reportPct}%`}
          valueClassName={getCompletionColor(overallStats.reportPct)}
          accent="violet"
          index={4}
        />
      </div>

      {/* ── Guide Section ── */}
      <motion.div variants={neuralFadeUp} className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <CommandFlowCard />
          <ReportFieldsGuideCard />
        </div>
        <ManagerChecklistCard />
      </motion.div>

      {/* ── Organization 5-Field Narrative Overview ── */}
      <motion.div variants={neuralFadeUp}>
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-cyan-200/40">
            <Sparkles className="size-5 text-white" />
            <span className="absolute -right-0.5 -top-0.5 flex size-3">
              <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-emerald-400" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight">조직 전체 5-Field 서술 현황</h2>
            <p className="text-[11px] text-muted-foreground">
              전 담당자가 작성한 보고 필드를 실시간으로 집계합니다.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {([
            { section: REPORT_SECTION_CONFIG[0], entries: overallStats.narrativeSummaries },
            { section: REPORT_SECTION_CONFIG[1], entries: overallStats.narrativeImpacts },
            { section: REPORT_SECTION_CONFIG[2], entries: overallStats.narrativeIssues },
            { section: REPORT_SECTION_CONFIG[3], entries: overallStats.narrativeSupports },
            { section: REPORT_SECTION_CONFIG[4], entries: overallStats.narrativeTomorrows },
          ] as const).map(({ section, entries }) => {
            const accent = SECTION_ACCENTS[section.accent];
            const SIcon = section.icon;

            return (
              <motion.div
                key={section.label}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'neural-card group rounded-2xl border bg-card/80 backdrop-blur-sm p-5 transition-all duration-300',
                  'hover:shadow-lg hover:-translate-y-0.5',
                  accent.border,
                  entries.length > 0
                    ? 'animate-glow-breathe'
                    : ''
                )}
                style={entries.length > 0 ? { '--glow-color': section.accent === 'cyan' ? 'rgba(6,182,212,0.2)' : section.accent === 'violet' ? 'rgba(139,92,246,0.2)' : section.accent === 'amber' ? 'rgba(245,158,11,0.2)' : section.accent === 'rose' ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)' } as React.CSSProperties : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex size-8 items-center justify-center rounded-xl', accent.iconBg)}>
                    <SIcon className={cn('size-4', accent.iconText)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[11px] font-bold uppercase tracking-[0.1em]', accent.text)}>
                        {section.label}
                      </span>
                      {section.required && (
                        <span className="rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-bold text-cyan-600">필수</span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] font-bold tabular-nums',
                      entries.length > 0 ? accent.text : 'text-muted-foreground/50'
                    )}
                  >
                    {entries.length}명 작성
                  </Badge>
                </div>

                {entries.length === 0 ? (
                  <div className={cn(
                    'mt-3 rounded-xl border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground/50',
                    accent.emptyBorder, accent.emptyBg
                  )}>
                    {section.emptyHint}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {entries.map((entry) => (
                      <motion.div
                        key={entry.userName}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className={cn(
                          'rounded-xl border px-3.5 py-2.5 transition-all duration-200 hover:shadow-sm',
                          accent.border, accent.bg
                        )}
                      >
                        <span className="text-[11px] font-bold text-foreground">{entry.userName}</span>
                        <p className="mt-1 text-[11px] leading-[1.65] text-foreground/80">{entry.content}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Auto-collected highlights card */}
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="neural-card rounded-2xl border bg-gradient-to-br from-card/80 to-cyan-50/20 backdrop-blur-sm p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 accent-l-cyan md:col-span-2 xl:col-span-1"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-violet-100">
                <Activity className="size-4 text-cyan-600" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-700">자동 수집 결과</span>
              </div>
              {overallStats.highlights.length > 0 && (
                <Badge variant="secondary" className="text-[10px] font-bold tabular-nums text-cyan-700">
                  {overallStats.highlights.length}건
                </Badge>
              )}
            </div>

            {overallStats.highlights.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-cyan-200/40 bg-cyan-50/20 px-3 py-4 text-center text-[11px] text-muted-foreground/50">
                오늘 결과로 떠오른 근거가 아직 없습니다.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {overallStats.highlights.slice(0, 4).map((entry) => {
                  const statusConf = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.미완료;
                  const StatusIcon = statusConf.icon;

                  return (
                    <motion.div
                      key={`${entry.userName}:${entry.taskId}:${entry.campaignName}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl border border-cyan-200/40 bg-cyan-50/30 px-3.5 py-2.5 transition-all duration-200 hover:shadow-sm hover:shadow-cyan-100/40"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={cn('text-[8px] shadow-sm', statusConf.badge, statusConf.glow)}>
                          <StatusIcon className="mr-0.5 size-2" />
                          {statusConf.label}
                        </Badge>
                        <span className="text-[10px] font-bold">{entry.userName}</span>
                        <span className="text-[10px] text-muted-foreground">· {entry.taskName}</span>
                      </div>
                      {hasText(entry.resultValue) && (
                        <p className="mt-1 text-[11px] leading-[1.5] text-foreground/80">{entry.resultValue}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ── Per-User Report Cards ── */}
      <motion.div variants={neuralFadeUp} className="space-y-3">
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
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/60">
              <UserIcon className="size-6 opacity-30" />
            </div>
            <span className="text-sm font-medium">표시할 일일 보고 데이터가 없습니다.</span>
            <span className="text-[11px] text-muted-foreground/60">
              담당자별 업무에서 체크를 시작하면 여기에 근거가 수집됩니다.
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Report Dialog ── */}
      {selectedReportAuthor && reportDialogOpen && (
        <MyReportDialog
          key={`${date}:${selectedReportAuthor.id}:${selectedAuthorReport?.id ?? 'new'}`}
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          date={date}
          userId={selectedReportAuthor.id}
          userName={selectedReportAuthor.name}
          existingReport={selectedAuthorReport}
          insights={selectedAuthorInsights}
        />
      )}
    </motion.div>
  );
}
