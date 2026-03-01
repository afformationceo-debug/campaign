'use client';

import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Task, TaskStep } from '@/lib/types/database';

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  '긴급': { label: '긴급', color: 'text-red-600' },
  '높음': { label: '높음', color: 'text-orange-500' },
  '보통': { label: '보통', color: 'text-muted-foreground' },
  '낮음': { label: '낮음', color: 'text-muted-foreground/50' },
};

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const supabase = createClient();

  const { data: steps = [] } = useQuery({
    queryKey: ['task-steps', task?.id],
    queryFn: async () => {
      if (!task) return [];
      const { data, error } = await supabase
        .from('task_steps')
        .select('*')
        .eq('task_id', task.id)
        .order('step_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskStep[];
    },
    enabled: !!task,
  });

  if (!task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['보통'];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[340px] bg-background border-l border-border z-50 overflow-y-auto shadow-xl">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground leading-tight">{task.task_name}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="space-y-0.5">
              <span className="text-muted-foreground">카테고리</span>
              <p className="font-medium">{task.category}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">우선순위</span>
              <p className={cn('font-bold', priorityConfig.color)}>{priorityConfig.label}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">담당자</span>
              <p className="font-medium">{task.default_assignees?.join(', ') || '전체'}</p>
            </div>
            {task.estimated_minutes && (
              <div className="space-y-0.5">
                <span className="text-muted-foreground">예상 소요</span>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="size-3" />
                  {task.estimated_minutes}분
                </p>
              </div>
            )}
            {task.tool && (
              <div className="space-y-0.5">
                <span className="text-muted-foreground">도구</span>
                <p className="font-medium">{task.tool}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">설명</span>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/50 rounded-lg p-2.5 border border-border">
                {task.description}
              </p>
            </div>
          )}

          {/* SOP Link */}
          {task.instruction_url && (
            <a
              href={task.instruction_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-medium text-foreground bg-secondary rounded-lg px-3 py-2 border border-border hover:bg-secondary/80 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              SOP 문서 보기
            </a>
          )}

          {/* Task Steps (Guide only) */}
          {steps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  업무 흐름
                </span>
                <span className="text-[10px] text-muted-foreground/60">{steps.length}단계</span>
              </div>
              <div className="space-y-0">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="flex gap-2.5 py-1.5 border-b border-border/50 last:border-0"
                  >
                    <div className="flex flex-col items-center shrink-0">
                      <div className="size-5 rounded-full bg-secondary border border-border flex items-center justify-center">
                        <span className="text-[9px] font-bold text-foreground">{idx + 1}</span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-0.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[11px] font-medium text-foreground">{step.step_name}</p>
                      {step.step_description && (
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{step.step_description}</p>
                      )}
                      {step.tool_url && (
                        <a
                          href={step.tool_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-foreground/70 hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="size-2.5" />
                          도구 열기
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
