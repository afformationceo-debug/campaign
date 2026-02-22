'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingDown, Trophy, Lightbulb } from 'lucide-react';
import type { Insight } from '@/lib/ai/insights';

const severityConfig = {
  critical: {
    border: 'border-red-500/40 dark:border-red-500/30',
    bg: 'bg-red-50/80 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-300',
    desc: 'text-red-600/80 dark:text-red-400/80',
    dot: 'bg-red-500',
    pulse: true,
  },
  warning: {
    border: 'border-amber-500/40 dark:border-amber-500/30',
    bg: 'bg-amber-50/80 dark:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-300',
    desc: 'text-amber-600/80 dark:text-amber-400/80',
    dot: 'bg-amber-500',
    pulse: false,
  },
  info: {
    border: 'border-blue-500/40 dark:border-blue-500/30',
    bg: 'bg-blue-50/80 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-300',
    desc: 'text-blue-600/80 dark:text-blue-400/80',
    dot: 'bg-blue-500',
    pulse: false,
  },
  positive: {
    border: 'border-emerald-500/40 dark:border-emerald-500/30',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    desc: 'text-emerald-600/80 dark:text-emerald-400/80',
    dot: 'bg-emerald-500',
    pulse: false,
  },
};

const typeIcons = {
  risk: AlertTriangle,
  anomaly: TrendingDown,
  achievement: Trophy,
  recommendation: Lightbulb,
};

export function InsightCard({
  insight,
  onClick,
}: {
  insight: Insight;
  onClick?: () => void;
}) {
  const config = severityConfig[insight.severity];
  const Icon = typeIcons[insight.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 flex flex-col gap-1.5 p-3 rounded-xl border transition-all text-left',
        'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
        'w-[220px] min-h-[80px]',
        config.border,
        config.bg
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className={cn('size-2 rounded-full', config.dot)} />
          {config.pulse && (
            <div className={cn('absolute inset-0 size-2 rounded-full animate-ping', config.dot, 'opacity-50')} />
          )}
        </div>
        <Icon className={cn('size-3.5', config.text)} />
        <span className={cn('text-[12px] font-semibold truncate', config.text)}>
          {insight.title}
        </span>
      </div>
      <p className={cn('text-[11px] leading-[1.5] line-clamp-2', config.desc)}>
        {insight.description}
      </p>
    </button>
  );
}
