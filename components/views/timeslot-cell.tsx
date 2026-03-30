'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useUpdateTimeslot, useCreateCheck } from '@/hooks/use-update-check-status';
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
import { Button } from '@/components/ui/button';
import type { DailyCheck } from '@/lib/types/database';

// 30분 단위 시간 옵션 (09:00 ~ 21:00)
const TIME_OPTIONS: string[] = [];
for (let h = 9; h <= 21; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 21) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
  }
}

interface TimeSlotCellProps {
  check: DailyCheck | null;
  taskId: string;
  date: string;
  assigneeId: string;
}

export function TimeSlotCell({ check, taskId, date, assigneeId }: TimeSlotCellProps) {
  const supabase = createClient();
  const { mutate: updateTimeslot } = useUpdateTimeslot();
  const { mutate: createCheck } = useCreateCheck();
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  // 오늘 체크에 타임슬롯이 없으면 → 이전 날짜에서 최근 타임슬롯 조회
  const needsFallback = !check?.start_time;
  const { data: prevSlot } = useQuery({
    queryKey: ['timeslot-fallback', taskId, assigneeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_checks')
        .select('start_time, end_time')
        .eq('task_id', taskId)
        .eq('assigned_user_id', assigneeId)
        .is('campaign_id', null)
        .not('start_time', 'is', null)
        .order('check_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { start_time: string; end_time: string } | null;
    },
    enabled: needsFallback && !!assigneeId,
    staleTime: 10 * 60 * 1000, // 10분 캐시
  });

  // 실제 표시할 타임슬롯: 오늘 체크 > 이전 날짜 fallback
  const displayStart = check?.start_time ?? prevSlot?.start_time ?? null;
  const displayEnd = check?.end_time ?? prevSlot?.end_time ?? null;
  const hasSlot = !!displayStart;
  const isFallback = !check?.start_time && !!prevSlot?.start_time;

  const handleOpen = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setStartTime(displayStart ?? '');
      setEndTime(displayEnd ?? '');
    }
    setOpen(isOpen);
  }, [displayStart, displayEnd]);

  const handleSave = useCallback(() => {
    if (!startTime) {
      setOpen(false);
      return;
    }

    if (check) {
      updateTimeslot({
        checkId: check.id,
        start_time: startTime || null,
        end_time: endTime || null,
      });
    } else {
      createCheck({
        campaign_id: null,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '미완료',
        start_time: startTime || null,
        end_time: endTime || null,
        timeslot_only: true,
      });
    }
    setOpen(false);
  }, [check, startTime, endTime, taskId, date, assigneeId, updateTimeslot, createCheck]);

  const handleClear = useCallback(() => {
    if (check) {
      updateTimeslot({
        checkId: check.id,
        start_time: null,
        end_time: null,
      });
    }
    setStartTime('');
    setEndTime('');
    setOpen(false);
  }, [check, updateTimeslot]);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-center gap-1 px-1 py-0.5 rounded-lg text-[11px] transition-colors min-h-[24px]',
            hasSlot
              ? isFallback
                ? 'text-indigo-400 bg-indigo-50/40 hover:bg-indigo-100/60 font-medium italic'
                : 'text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 font-semibold'
              : 'text-stone-300 hover:bg-stone-50 hover:text-stone-500'
          )}
        >
          {hasSlot ? (
            <span className="tabular-nums whitespace-nowrap">
              {displayStart}~{displayEnd || '?'}
            </span>
          ) : (
            <>
              <Clock className="size-3" />
              <span>설정</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[220px] p-3 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-stone-700">타임슬롯 설정</p>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-stone-500 w-8 shrink-0">시작</span>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="h-7 text-[12px] flex-1">
                  <SelectValue placeholder="시작 시간" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={`s-${t}`} value={t} className="text-[12px]">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-stone-500 w-8 shrink-0">종료</span>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="h-7 text-[12px] flex-1">
                  <SelectValue placeholder="종료 시간" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {TIME_OPTIONS.filter((t) => !startTime || t > startTime).map((t) => (
                    <SelectItem key={`e-${t}`} value={t} className="text-[12px]">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <Button
              size="sm"
              className="flex-1 h-7 text-[11px]"
              onClick={handleSave}
              disabled={!startTime}
            >
              저장
            </Button>
            {(hasSlot && !isFallback) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={handleClear}
              >
                초기화
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
