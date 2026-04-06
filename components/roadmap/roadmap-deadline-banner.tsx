'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeadlineAlert } from '@/hooks/use-deadline-alerts';

interface DeadlineBannerProps {
  overdue: DeadlineAlert[];
  imminent: DeadlineAlert[];
  okCount: number;
}

const MAX_VISIBLE = 8;

export function RoadmapDeadlineBanner({ overdue, imminent, okCount }: DeadlineBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (overdue.length === 0 && imminent.length === 0) return null;

  const visibleOverdue = showAll ? overdue : overdue.slice(0, MAX_VISIBLE);
  const visibleImminent = showAll ? imminent : imminent.slice(0, Math.max(0, MAX_VISIBLE - visibleOverdue.length));
  const hiddenCount = (overdue.length + imminent.length) - (visibleOverdue.length + visibleImminent.length);

  return (
    <div className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      overdue.length > 0 ? 'bg-red-50/30 border-red-200' : 'bg-amber-50/30 border-amber-200',
    )}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2 text-[12px] hover:bg-white/40 transition-colors"
      >
        {expanded ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}

        {overdue.length > 0 && (
          <span className="flex items-center gap-1.5 text-red-600 font-bold">
            <AlertTriangle className="size-4" />
            마감 지남 {overdue.length}건
          </span>
        )}
        {imminent.length > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600 font-medium">
            <Clock className="size-3.5" />
            3일 이내 {imminent.length}건
          </span>
        )}
        <span className="flex items-center gap-1.5 text-emerald-600 ml-auto text-[11px]">
          <CheckCircle2 className="size-3.5" />
          여유 {okCount}건
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t pt-2 space-y-2">
          {/* 마감 지남 — 긴급도순 (오래된 것 먼저) */}
          {visibleOverdue.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleOverdue.map((alert) => (
                <span
                  key={alert.id}
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border',
                    Math.abs(alert.daysRemaining) > 14
                      ? 'bg-red-100 text-red-800 border-red-300 font-bold'
                      : Math.abs(alert.daysRemaining) > 7
                        ? 'bg-red-50 text-red-700 border-red-200 font-medium'
                        : 'bg-red-50/50 text-red-600 border-red-100',
                  )}
                >
                  <span className={cn(
                    'size-1.5 rounded-full',
                    Math.abs(alert.daysRemaining) > 14 ? 'bg-red-600' : 'bg-red-400',
                  )} />
                  {alert.name} · {Math.abs(alert.daysRemaining)}일 지남
                </span>
              ))}
            </div>
          )}

          {/* 3일 이내 */}
          {visibleImminent.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleImminent.map((alert) => (
                <span
                  key={alert.id}
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border',
                    alert.daysRemaining === 0
                      ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                      : 'bg-amber-50 text-amber-700 border-amber-100',
                  )}
                >
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  {alert.name} · {alert.daysRemaining === 0 ? '오늘 마감' : `${alert.daysRemaining}일 남음`}
                </span>
              ))}
            </div>
          )}

          {/* 더보기/접기 */}
          {hiddenCount > 0 && !showAll && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-white/60 transition-colors"
            >
              + {hiddenCount}건 더보기
            </button>
          )}
          {showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-white/60 transition-colors"
            >
              접기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
