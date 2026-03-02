'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, Clock, Circle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS, getNextStatus } from '@/lib/utils/status-colors';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DailyCheck, CheckStatus } from '@/lib/types/database';

interface StatusCellProps {
  check: DailyCheck | null;
  isApplicable: boolean;
  campaignId?: string;
  taskId?: string;
  date?: string;
  assigneeId?: string;
}

const STATUS_ICONS: Record<CheckStatus, React.ElementType> = {
  '완료': CheckCircle2,
  '진행중': Clock,
  '미완료': Circle,
  '해당없음': Minus,
};

const STATUS_LABELS: Record<CheckStatus, string> = {
  '완료': '완료',
  '진행중': '진행중',
  '미완료': '미완료',
  '해당없음': '해당없음',
};

export function StatusCell({ check, isApplicable, campaignId, taskId, date, assigneeId }: StatusCellProps) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [pulse, setPulse] = useState(false);
  const prevStatusRef = useRef<CheckStatus | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect realtime updates and trigger pulse animation
  useEffect(() => {
    if (check) {
      if (prevStatusRef.current !== null && prevStatusRef.current !== check.status) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 600);
        return () => clearTimeout(timer);
      }
      prevStatusRef.current = check.status;
    }
  }, [check?.status]);

  // Initialize note value when popover opens
  useEffect(() => {
    if (noteOpen && check) {
      setNoteValue(check.note ?? '');
    }
  }, [noteOpen, check]);

  const handleClick = useCallback(() => {
    if (!isApplicable) return;
    // If no check record exists yet, create one with '진행중'
    if (!check) {
      if (taskId && date && assigneeId) {
        createCheck({
          campaign_id: campaignId ?? null,
          task_id: taskId,
          check_date: date,
          assigned_user_id: assigneeId,
          status: '진행중',
        });
      }
      return;
    }
    const nextStatus = getNextStatus(check.status);
    updateStatus({ id: check.id, status: nextStatus, assigned_user_id: assigneeId });
  }, [check, isApplicable, updateStatus, createCheck, campaignId, taskId, date, assigneeId]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!check || !isApplicable) return;
      setNoteOpen(true);
    },
    [check, isApplicable]
  );

  const handleTouchStart = useCallback(() => {
    if (!check || !isApplicable) return;
    longPressTimer.current = setTimeout(() => {
      setNoteOpen(true);
    }, 500);
  }, [check, isApplicable]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleNoteSave = useCallback(() => {
    if (!check) return;
    updateStatus({ id: check.id, status: check.status, assigned_user_id: assigneeId, note: noteValue });
    setNoteOpen(false);
  }, [assigneeId, check, noteValue, updateStatus]);

  // Not applicable: gray disabled cell
  if (!isApplicable) {
    return (
      <div
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md',
          'bg-muted/40 cursor-not-allowed'
        )}
      >
        <Minus className="size-2.5 text-muted-foreground/30" />
      </div>
    );
  }

  // No check record yet (applicable but no data) - clickable to create
  if (!check) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md',
          'border border-dashed border-muted-foreground/20',
          'text-muted-foreground/30',
          'hover:border-primary/40 hover:text-primary/60 hover:bg-primary/5',
          'transition-all duration-200 cursor-pointer',
          'hover:scale-110'
        )}
        aria-label="클릭하여 체크 시작"
      >
        <Circle className="size-2.5" />
      </button>
    );
  }

  const status = check.status;
  const colors = STATUS_COLORS[status];
  const Icon = STATUS_ICONS[status];

  return (
    <Popover open={noteOpen} onOpenChange={(open) => { if (!open) setNoteOpen(false); }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <div className="relative">
              <button
                type="button"
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md',
                  'transition-all duration-200 cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'hover:scale-110 active:scale-95',
                  'border border-border/50 bg-card',
                  colors.text,
                  pulse && 'animate-pulse ring-1 ring-border',
                  check.note && 'ring-1 ring-offset-1 ring-border'
                )}
                aria-label={`상태: ${STATUS_LABELS[status]}`}
              >
                <Icon className="size-3" />
              </button>
              {check.note && (
                <div className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground border border-background" />
              )}
            </div>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <p className="font-medium">{STATUS_LABELS[status]}</p>
          {check.note && (
            <p className="mt-1 text-[10px] opacity-80">{check.note}</p>
          )}
          <p className="mt-1 text-[9px] opacity-50">우클릭: 메모 추가/수정</p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        className="w-64 bg-card border-border"
        side="bottom"
        align="center"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="note-input" className="text-[11px] text-muted-foreground">
              메모
            </Label>
            <Input
              id="note-input"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="메모를 입력하세요..."
              className="mt-1 h-8 text-[13px] rounded-lg bg-secondary/50 border-border"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleNoteSave();
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setNoteOpen(false)}
              className="rounded-lg"
            >
              취소
            </Button>
            <Button size="xs" onClick={handleNoteSave} className="rounded-lg">
              저장
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
