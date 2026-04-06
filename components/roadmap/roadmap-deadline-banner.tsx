'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import type { DeadlineAlert } from '@/hooks/use-deadline-alerts';

interface DeadlineBannerProps {
  overdue: DeadlineAlert[];
  imminent: DeadlineAlert[];
  okCount: number;
}

export function RoadmapDeadlineBanner({ overdue, imminent, okCount }: DeadlineBannerProps) {
  const [expanded, setExpanded] = useState(overdue.length > 0);

  if (overdue.length === 0 && imminent.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-4 py-2.5 text-[12px] hover:bg-stone-50/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}

        {overdue.length > 0 && (
          <span className="flex items-center gap-1.5 text-red-600 font-medium">
            <AlertTriangle className="size-3.5" />
            마감 지남 {overdue.length}건
          </span>
        )}
        {imminent.length > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600 font-medium">
            <Clock className="size-3.5" />
            3일 이내 {imminent.length}건
          </span>
        )}
        <span className="flex items-center gap-1.5 text-emerald-600 ml-auto">
          <CheckCircle2 className="size-3.5" />
          여유 {okCount}건
        </span>
      </button>

      {expanded && (overdue.length > 0 || imminent.length > 0) && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 border-t pt-2">
          {overdue.map((alert) => (
            <span
              key={alert.id}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100"
            >
              <span className="size-1.5 rounded-full bg-red-500" />
              {alert.name}
              <span className="font-medium">
                · {Math.abs(alert.daysRemaining)}일 지남
              </span>
            </span>
          ))}
          {imminent.map((alert) => (
            <span
              key={alert.id}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100"
            >
              <span className="size-1.5 rounded-full bg-amber-500" />
              {alert.name}
              <span className="font-medium">
                ·{' '}
                {alert.daysRemaining === 0
                  ? '오늘 마감'
                  : `${alert.daysRemaining}일 남음`}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
