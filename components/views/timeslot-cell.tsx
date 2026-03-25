'use client';

import { useState, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const { mutate: updateTimeslot } = useUpdateTimeslot();
  const { mutate: createCheck } = useCreateCheck();
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState<string>(check?.start_time ?? '');
  const [endTime, setEndTime] = useState<string>(check?.end_time ?? '');

  const handleOpen = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setStartTime(check?.start_time ?? '');
      setEndTime(check?.end_time ?? '');
    }
    setOpen(isOpen);
  }, [check]);

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
      // No check exists yet: create one with '미완료' status + timeslot
      createCheck({
        campaign_id: null,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '미완료',
        start_time: startTime || null,
        end_time: endTime || null,
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

  const displayStart = check?.start_time;
  const displayEnd = check?.end_time;
  const hasSlot = !!displayStart;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-center gap-1 px-1 py-0.5 rounded-lg text-[11px] transition-colors min-h-[24px]',
            hasSlot
              ? 'text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 font-semibold'
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
            {hasSlot && (
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
