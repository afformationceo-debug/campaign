'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { DailyCheck } from '@/lib/types/database';

interface NoteEditPopoverProps {
  check: DailyCheck | null;
  taskId: string;
  date: string;
  assigneeId: string;
  campaignId?: string;
}

export function NoteEditPopover({ check, taskId, date, assigneeId, campaignId }: NoteEditPopoverProps) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasNote = !!check?.note;

  useEffect(() => {
    if (open) {
      setNote(check?.note ?? '');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, check?.note]);

  const handleSave = useCallback(() => {
    const trimmed = note.trim();
    if (!check) {
      if (!trimmed) { setOpen(false); return; }
      createCheck({
        campaign_id: campaignId ?? null,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '미완료',
        note: trimmed,
      });
    } else {
      if (trimmed === (check.note ?? '')) { setOpen(false); return; }
      updateStatus({
        id: check.id,
        status: check.status,
        assigned_user_id: assigneeId,
        note: trimmed,
      });
    }
    setOpen(false);
  }, [check, note, taskId, date, assigneeId, campaignId, updateStatus, createCheck]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'shrink-0 p-0.5 rounded transition-colors',
            hasNote
              ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
              : 'text-stone-300 hover:text-stone-500 hover:bg-stone-50'
          )}
          title={hasNote ? '메모 보기/수정' : '메모 추가'}
        >
          {hasNote ? (
            <MessageSquare className="size-3.5" />
          ) : (
            <Pencil className="size-3" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[280px] p-3 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-stone-700">업무 메모</p>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                handleSave();
              }
            }}
            className="w-full text-[12px] border border-stone-200 rounded-lg p-2 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 resize-none leading-relaxed"
            rows={4}
            placeholder="업무 관련 메모를 입력하세요..."
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-400">Ctrl+Enter로 저장</span>
            <Button size="sm" className="h-7 text-[11px]" onClick={handleSave}>
              저장
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
