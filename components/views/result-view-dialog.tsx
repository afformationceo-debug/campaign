'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Expand, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
import { Button } from '@/components/ui/button';
import type { DailyCheck, Task } from '@/lib/types/database';

interface ResultViewDialogProps {
  check: DailyCheck | null;
  task: Task;
  date: string;
  assigneeId: string;
  campaignId?: string;
}

export function ResultViewDialog({ check, task, date, assigneeId, campaignId }: ResultViewDialogProps) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resultValue = check?.result_value ?? '';
  const hasResult = !!resultValue;

  useEffect(() => {
    if (open) {
      setValue(resultValue);
      setEditing(false);
    }
  }, [open, resultValue]);

  useEffect(() => {
    if (editing) {
      setTimeout(() => {
        textareaRef.current?.focus();
        // 커서를 끝으로
        const len = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(len, len);
      }, 50);
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const trimmed = value.trim();
    if (!check) {
      if (!trimmed) return;
      createCheck({
        campaign_id: campaignId ?? null,
        task_id: task.id,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '진행중',
        result_value: trimmed,
      });
    } else {
      if (trimmed === (check.result_value ?? '')) { setEditing(false); return; }
      updateStatus({
        id: check.id,
        status: check.status,
        assigned_user_id: assigneeId,
        result_value: trimmed,
      });
    }
    setEditing(false);
  }, [check, value, task.id, date, assigneeId, campaignId, updateStatus, createCheck]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => hasResult && setOpen(true)}
        disabled={!hasResult}
        className={cn(
          'shrink-0 p-0.5 rounded transition-colors',
          hasResult
            ? 'text-stone-400 hover:text-orange-600 hover:bg-orange-50'
            : 'text-stone-200 cursor-default'
        )}
        title={hasResult ? '결과값 확대 보기' : ''}
      >
        <Expand className="size-3" />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={() => setOpen(false)}
      />
      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[90vw] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/80">
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-bold text-stone-800 truncate">{task.task_name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-stone-400">{task.category}</span>
              <span className="text-[10px] text-stone-300">|</span>
              <span className="text-[10px] text-stone-400">{date}</span>
              {check?.status && (
                <>
                  <span className="text-[10px] text-stone-300">|</span>
                  <span className={cn(
                    'text-[10px] font-semibold',
                    check.status === '완료' ? 'text-emerald-600' :
                    check.status === '진행중' ? 'text-blue-600' :
                    check.status === '미완료' ? 'text-red-500' : 'text-stone-400'
                  )}>
                    {check.status}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!editing && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1"
                onClick={() => setEditing(true)}
              >
                수정
              </Button>
            )}
            {editing && (
              <Button
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={handleSave}
              >
                <Save className="size-3" />
                저장
              </Button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors"
            >
              <X className="size-4 text-stone-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 메모 섹션 */}
          {check?.note && (
            <div className="mb-4 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 mb-1">메모</p>
              <p className="text-[12px] text-stone-700 whitespace-pre-wrap leading-relaxed">{check.note}</p>
            </div>
          )}

          {/* 결과값 섹션 */}
          <div>
            <p className="text-[10px] font-bold text-stone-500 mb-2">결과값</p>
            {editing ? (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                    handleSave();
                  }
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-full text-[13px] border border-orange-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-orange-200 resize-none leading-relaxed min-h-[200px]"
                placeholder="결과값을 입력하세요..."
              />
            ) : (
              <div className="text-[13px] text-stone-800 whitespace-pre-wrap leading-relaxed bg-stone-50/50 rounded-xl p-4 border border-stone-100 min-h-[120px]">
                {resultValue || <span className="text-stone-300">결과값이 없습니다</span>}
              </div>
            )}
          </div>

          {/* 시간 정보 */}
          {(check?.started_at || check?.start_time) && (
            <div className="mt-4 flex items-center gap-4 text-[10px] text-stone-400">
              {check.start_time && (
                <span>타임슬롯: {check.start_time}~{check.end_time || '?'}</span>
              )}
              {check.started_at && (
                <span>최초 입력: {new Date(check.started_at).toLocaleString('ko-KR')}</span>
              )}
              {check.completed_at && (
                <span>완료: {new Date(check.completed_at).toLocaleString('ko-KR')}</span>
              )}
            </div>
          )}
        </div>

        {editing && (
          <div className="px-5 py-2.5 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
            <span className="text-[10px] text-stone-400">Ctrl+Enter로 저장 | Esc로 취소</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditing(false)}>
                취소
              </Button>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleSave}>
                저장
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
