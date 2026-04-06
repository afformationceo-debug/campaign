'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FolderOpen,
  GripVertical,
  ListTodo,
  User as UserIcon,
  Users,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Project, ProjectTask, ProjectState, User as UserType } from '@/lib/types/database';
import type { ProjectTreeNode } from '@/hooks/use-project-tree';

interface BoardViewProps {
  roots: ProjectTreeNode[];
  users: UserType[];
  tasksByProject: Map<string, ProjectTask[]>;
  onUpdateProject: (input: { id: string; [key: string]: any }) => void;
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  onReorderProjects: (items: { id: string; sort_order: number }[]) => void;
  onReorderTasks: (input: { projectId: string; items: { id: string; sort_order: number }[] }) => void;
}

// ── Helpers (todayMs 파라미터로 hydration 안전) ───────

function getDeadlineStatus(dueDate: string | null, state: string, todayMs: number): 'overdue' | 'imminent' | 'ok' | null {
  if (!dueDate || state === '완료' || todayMs === 0) return null;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - todayMs) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'imminent';
  return 'ok';
}

function formatDate(date: string | null): string {
  if (!date) return '';
  return date.slice(5).replace('-', '/');
}

function getDaysLabel(dueDate: string, todayMs: number): string {
  if (todayMs === 0) return '';
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - todayMs) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}일 지남`;
  if (diff === 0) return '오늘 마감';
  return `${diff}일 남음`;
}

// Client-only today hook (prevents hydration mismatch)
function useTodayMs(): number {
  const [todayMs, setTodayMs] = useState(0);
  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setTodayMs(now.getTime());
  }, []);
  return todayMs;
}

const deadlineBadgeStyles = {
  overdue: 'bg-red-50 text-red-700 border-red-200',
  imminent: 'bg-amber-50 text-amber-700 border-amber-200',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
} as const;

// ── Drag & Drop Types ────────────────────────────────

type DragItem = { type: 'project' | 'task'; id: string; projectId?: string } | null;

// ── Inline Editable Date ─────────────────────────────

function InlineDate({
  value,
  onChange,
  todayMs,
  state,
  className,
}: {
  value: string | null;
  onChange: (date: string) => void;
  todayMs: number;
  state: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [editing]);

  const status = getDeadlineStatus(value, state, todayMs);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value ?? ''}
        className="text-[10px] border rounded px-1 py-0.5 w-[110px] bg-white"
        onBlur={(e) => {
          setEditing(false);
          if (e.target.value && e.target.value !== value) {
            onChange(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
      />
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={cn('text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-0.5', className)}
      >
        <Calendar className="size-3" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={cn(
        'text-[10px] transition-colors cursor-pointer hover:underline',
        status ? cn('px-1.5 py-0.5 rounded-full border font-medium', deadlineBadgeStyles[status]) : 'text-muted-foreground',
        className,
      )}
    >
      {formatDate(value)}
    </button>
  );
}

// ── Inline Editable Text ─────────────────────────────

function InlineText({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        className={cn('text-[12px] border rounded px-1.5 py-0.5 w-full bg-white', className)}
        onBlur={(e) => {
          setEditing(false);
          const trimmed = e.target.value.trim();
          if (trimmed && trimmed !== value) {
            onSave(trimmed);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={cn('cursor-pointer hover:bg-stone-100 rounded px-0.5 transition-colors', className)}
    >
      {value}
    </span>
  );
}

// ── Task Item (with memo/result toggle + inline edit + drag) ──

function TaskItem({
  task,
  onToggle,
  onUpdateTask,
  todayMs,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  task: ProjectTask;
  onToggle: () => void;
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  todayMs: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const done = task.state === '완료';
  const status = getDeadlineStatus(task.due_date, task.state, todayMs);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'rounded-lg transition-colors',
        done && 'opacity-60',
        isDragging && 'opacity-30',
        isDragOver && 'border-t-2 border-t-orange-400',
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 group/task">
        <GripVertical className="size-3 text-muted-foreground/20 group-hover/task:text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0 transition-colors" />
        <button type="button" onClick={onToggle} className="shrink-0">
          {done ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <Circle className="size-4 text-stone-300 hover:text-orange-400 transition-colors" />
          )}
        </button>
        <span className={cn('flex-1 text-[12px] truncate', done && 'line-through text-muted-foreground')}>
          <InlineText
            value={task.title}
            onSave={(title) => onUpdateTask({ id: task.id, project_id: task.project_id, title })}
            className={cn(done && 'line-through text-muted-foreground')}
          />
        </span>
        {(task.memo || task.result_value) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail); }}
            className="shrink-0 p-0.5 rounded hover:bg-stone-100"
          >
            <FileText className={cn('size-3', showDetail ? 'text-orange-500' : 'text-stone-300')} />
          </button>
        )}
        {status && task.due_date && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border shrink-0', deadlineBadgeStyles[status])}>
            {formatDate(task.due_date)}
          </span>
        )}
        {task.due_date && !status && (
          <span className="text-[9px] text-muted-foreground shrink-0">{formatDate(task.due_date)}</span>
        )}
      </div>
      {/* Memo/Result toggle */}
      {showDetail && (
        <div className="mx-2.5 mb-2 px-2.5 py-2 bg-stone-50 rounded-lg text-[11px] space-y-1 border border-stone-100">
          {task.memo && (
            <p className="text-stone-600"><span className="font-medium text-stone-500">메모:</span> {task.memo}</p>
          )}
          {task.result_value && (
            <p className="text-stone-600"><span className="font-medium text-stone-500">결과:</span> {task.result_value}</p>
          )}
          {!task.memo && !task.result_value && (
            <p className="text-stone-400 italic">내용 없음</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub Project Row ───────────────────────────────────

function SubProjectRow({
  node,
  onUpdateTask,
  todayMs,
  dragItem,
  dragOverItem,
  onTaskDragStart,
  onTaskDragOver,
  onTaskDrop,
  onDragEnd,
}: {
  node: ProjectTreeNode;
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  todayMs: number;
  dragItem: DragItem;
  dragOverItem: DragItem;
  onTaskDragStart: (taskId: string, projectId: string) => void;
  onTaskDragOver: (e: React.DragEvent, taskId: string, projectId: string) => void;
  onTaskDrop: (projectId: string) => void;
  onDragEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isCompleted = node.project.state === '완료';
  const status = getDeadlineStatus(node.project.due_date, node.project.state, todayMs);

  const handleToggleTask = useCallback((task: ProjectTask) => {
    const nextState: ProjectState = task.state === '완료' ? '진행중' : '완료';
    onUpdateTask({ id: task.id, project_id: task.project_id, state: nextState });
  }, [onUpdateTask]);

  return (
    <div className={cn('ml-1 rounded-lg', isCompleted && 'opacity-50')}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] hover:bg-stone-100/60 transition-colors"
      >
        {open ? <ChevronDown className="size-3 text-muted-foreground shrink-0" /> : <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
        {isCompleted ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> : <FolderOpen className="size-3.5 text-stone-400 shrink-0" />}
        <span className={cn('flex-1 truncate font-medium text-left', isCompleted && 'line-through')}>{node.project.project_name}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{node.stats.completedTasks}/{node.stats.totalTasks}</span>

        {/* 시작일~마감일 표시 */}
        {(node.project.start_date || node.project.due_date) && (
          <span className="text-[9px] text-muted-foreground shrink-0 flex items-center gap-0.5">
            <Calendar className="size-2.5" />
            {node.project.start_date && formatDate(node.project.start_date)}
            {node.project.start_date && node.project.due_date && <span className="text-muted-foreground/40">~</span>}
            {node.project.due_date && formatDate(node.project.due_date)}
          </span>
        )}

        {/* 마감일 배지 */}
        {status && node.project.due_date && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border shrink-0', deadlineBadgeStyles[status])}>
            {getDaysLabel(node.project.due_date, todayMs)}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden ml-4"
          >
            {node.project.memo && (
              <p className="text-[10px] text-stone-500 px-2 py-1 bg-stone-50 rounded mx-1 mb-1 line-clamp-3">{node.project.memo}</p>
            )}
            {node.tasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={() => handleToggleTask(t)}
                onUpdateTask={onUpdateTask}
                todayMs={todayMs}
                isDragging={dragItem?.type === 'task' && dragItem.id === t.id}
                isDragOver={dragOverItem?.type === 'task' && dragOverItem.id === t.id}
                onDragStart={() => onTaskDragStart(t.id, t.project_id)}
                onDragOver={(e) => onTaskDragOver(e, t.id, t.project_id)}
                onDrop={() => onTaskDrop(t.project_id)}
                onDragEnd={onDragEnd}
              />
            ))}
            {node.tasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2 py-1">하위 항목 없음</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Completed Section (collapsed by default) ──────────

function CompletedSection({
  completedSubs,
  completedTasks,
  onUpdateTask,
  onToggleTask,
  todayMs,
  dragItem,
  dragOverItem,
  onTaskDragStart,
  onTaskDragOver,
  onTaskDrop,
  onDragEnd,
}: {
  completedSubs: ProjectTreeNode[];
  completedTasks: ProjectTask[];
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  onToggleTask: (task: ProjectTask) => void;
  todayMs: number;
  dragItem: DragItem;
  dragOverItem: DragItem;
  onTaskDragStart: (taskId: string, projectId: string) => void;
  onTaskDragOver: (e: React.DragEvent, taskId: string, projectId: string) => void;
  onTaskDrop: (projectId: string) => void;
  onDragEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const total = completedSubs.length + completedTasks.length;

  return (
    <div className="border-t border-dashed border-stone-200 pt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <CheckCircle2 className="size-3" />
        <span className="font-medium">완료 ({total})</span>
      </button>
      {open && (
        <div className="space-y-0.5 opacity-60">
          {completedSubs.map((sp) => (
            <SubProjectRow
              key={sp.project.id}
              node={sp}
              onUpdateTask={onUpdateTask}
              todayMs={todayMs}
              dragItem={dragItem}
              dragOverItem={dragOverItem}
              onTaskDragStart={onTaskDragStart}
              onTaskDragOver={onTaskDragOver}
              onTaskDrop={onTaskDrop}
              onDragEnd={onDragEnd}
            />
          ))}
          {completedTasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={() => onToggleTask(t)}
              onUpdateTask={onUpdateTask}
              todayMs={todayMs}
              isDragging={dragItem?.type === 'task' && dragItem.id === t.id}
              isDragOver={dragOverItem?.type === 'task' && dragOverItem.id === t.id}
              onDragStart={() => onTaskDragStart(t.id, t.project_id)}
              onDragOver={(e) => onTaskDragOver(e, t.id, t.project_id)}
              onDrop={() => onTaskDrop(t.project_id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project Card ──────────────────────────────────────

function ProjectCard({
  node,
  users,
  onUpdateProject,
  onUpdateTask,
  todayMs,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragItem,
  dragOverItem,
  onTaskDragStart,
  onTaskDragOver,
  onTaskDrop,
}: {
  node: ProjectTreeNode;
  users: UserType[];
  onUpdateProject: (input: { id: string; [key: string]: any }) => void;
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  todayMs: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  dragItem: DragItem;
  dragOverItem: DragItem;
  onTaskDragStart: (taskId: string, projectId: string) => void;
  onTaskDragOver: (e: React.DragEvent, taskId: string, projectId: string) => void;
  onTaskDrop: (projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { project, subProjects, tasks, stats } = node;
  const status = getDeadlineStatus(project.due_date, project.state, todayMs);
  const isCompleted = project.state === '완료';
  const assigneeNames = (project.assignee_ids?.length ? project.assignee_ids : (project.assignee_id ? [project.assignee_id] : []))
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean);

  const handleToggleTask = useCallback((task: ProjectTask) => {
    const nextState: ProjectState = task.state === '완료' ? '진행중' : '완료';
    onUpdateTask({ id: task.id, project_id: task.project_id, state: nextState });
  }, [onUpdateTask]);

  const handleToggleProjectState = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState: ProjectState = isCompleted ? '진행중' : '완료';
    onUpdateProject({ id: project.id, state: nextState });
  }, [isCompleted, onUpdateProject, project.id]);

  // 미완료/완료 태스크 분리
  const inProgressTasks = tasks.filter((t) => t.state !== '완료');
  const completedTasks = tasks.filter((t) => t.state === '완료');
  const inProgressSubs = subProjects.filter((sp) => sp.project.state !== '완료');
  const completedSubs = subProjects.filter((sp) => sp.project.state === '완료');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      draggable
      onDragStart={(e) => {
        // framer-motion 이벤트는 native가 아님 — native handler 사용
      }}
      onDragOver={(e) => {
        // framer-motion 이벤트
      }}
      className={cn(
        'rounded-xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden',
        isCompleted && 'border-emerald-200 bg-emerald-50/30 opacity-70',
        status === 'overdue' && 'border-red-200',
        status === 'imminent' && 'border-amber-200',
        isDragging && 'opacity-30 scale-95',
        isDragOver && 'ring-2 ring-orange-400 ring-offset-1',
      )}
    >
      {/* Card header — drag handle area */}
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOver(e);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop();
        }}
        onDragEnd={onDragEnd}
      >
        <div className="w-full text-left px-3.5 py-3 space-y-2">
          <div className="flex items-start gap-2">
            {/* 프로젝트 상태 토글 아이콘 */}
            <button
              type="button"
              onClick={handleToggleProjectState}
              className="shrink-0 mt-0.5"
              title={isCompleted ? '진행중으로 변경' : '완료로 변경'}
            >
              {isCompleted ? (
                <CheckCircle2 className="size-4 text-emerald-500 hover:text-orange-500 transition-colors" />
              ) : (
                <Clock className="size-4 text-orange-500 hover:text-emerald-500 transition-colors" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={cn('flex-1 text-[13px] font-semibold leading-tight line-clamp-2 text-left', isCompleted && 'line-through text-muted-foreground')}
            >
              {project.project_name}
            </button>
            <GripVertical className="size-4 text-muted-foreground/30 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0 mt-0.5 transition-colors" />
            <button type="button" onClick={() => setExpanded(!expanded)} className="shrink-0 mt-0.5">
              {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', isCompleted ? 'bg-emerald-500' : stats.progressPct > 0 ? 'bg-orange-500' : 'bg-stone-200')}
                style={{ width: `${stats.progressPct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium shrink-0 tabular-nums">
              {stats.deepCompletedTasks}/{stats.deepTotalTasks}
            </span>
          </div>

          {/* Info row: dates (inline editable) + deadline badge */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            {project.start_date && (
              <span className="text-muted-foreground">{formatDate(project.start_date)}</span>
            )}
            {project.start_date && project.due_date && <span className="text-muted-foreground/40">~</span>}
            <InlineDate
              value={project.due_date}
              onChange={(date) => onUpdateProject({ id: project.id, due_date: date })}
              todayMs={todayMs}
              state={project.state}
            />
            {status && project.due_date && (
              <span className={cn('px-1.5 py-0.5 rounded-full border font-medium text-[9px]', deadlineBadgeStyles[status])}>
                {getDaysLabel(project.due_date, todayMs)}
              </span>
            )}
            {assigneeNames.length > 0 && (
              <span className="ml-auto text-muted-foreground flex items-center gap-0.5">
                <UserIcon className="size-3" />
                {assigneeNames.join(', ')}
              </span>
            )}
          </div>

          {/* Memo preview */}
          {project.memo && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{project.memo}</p>
          )}

          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-blue-500 flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3" />
              {project.url.replace(/^https?:\/\//, '').slice(0, 30)}
            </a>
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-2 py-2 space-y-2">
              {/* 진행중 하위 프로젝트 */}
              {inProgressSubs.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-medium text-orange-600 uppercase tracking-wider px-2 pt-1 flex items-center gap-1">
                    <Clock className="size-3" /> 진행중 ({inProgressSubs.length})
                  </p>
                  {inProgressSubs.map((sp) => (
                    <SubProjectRow
                      key={sp.project.id}
                      node={sp}
                      onUpdateTask={onUpdateTask}
                      todayMs={todayMs}
                      dragItem={dragItem}
                      dragOverItem={dragOverItem}
                      onTaskDragStart={onTaskDragStart}
                      onTaskDragOver={onTaskDragOver}
                      onTaskDrop={onTaskDrop}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              )}

              {/* 진행중 태스크 */}
              {inProgressTasks.length > 0 && (
                <div className="space-y-0.5">
                  {(inProgressSubs.length > 0 || completedSubs.length > 0) && (
                    <p className="text-[10px] font-medium text-orange-600 uppercase tracking-wider px-2 pt-1 flex items-center gap-1">
                      <Clock className="size-3" /> 진행중 태스크 ({inProgressTasks.length})
                    </p>
                  )}
                  {inProgressTasks.map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      onToggle={() => handleToggleTask(t)}
                      onUpdateTask={onUpdateTask}
                      todayMs={todayMs}
                      isDragging={dragItem?.type === 'task' && dragItem.id === t.id}
                      isDragOver={dragOverItem?.type === 'task' && dragOverItem.id === t.id}
                      onDragStart={() => onTaskDragStart(t.id, t.project_id)}
                      onDragOver={(e) => onTaskDragOver(e, t.id, t.project_id)}
                      onDrop={() => onTaskDrop(t.project_id)}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              )}

              {/* 완료된 항목 (접혀있음) */}
              {(completedSubs.length > 0 || completedTasks.length > 0) && (
                <CompletedSection
                  completedSubs={completedSubs}
                  completedTasks={completedTasks}
                  onUpdateTask={onUpdateTask}
                  onToggleTask={handleToggleTask}
                  todayMs={todayMs}
                  dragItem={dragItem}
                  dragOverItem={dragOverItem}
                  onTaskDragStart={onTaskDragStart}
                  onTaskDragOver={onTaskDragOver}
                  onTaskDrop={onTaskDrop}
                  onDragEnd={onDragEnd}
                />
              )}

              {tasks.length === 0 && subProjects.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-3">
                  <ListTodo className="size-4 mx-auto mb-1 text-stone-300" />
                  하위 항목 없음
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────

export function BoardView({
  roots,
  users,
  tasksByProject,
  onUpdateProject,
  onUpdateTask,
  onReorderProjects,
  onReorderTasks,
}: BoardViewProps) {
  const todayMs = useTodayMs();
  const [showCompleted, setShowCompleted] = useState(false);

  // ─── Drag & Drop State ──────────────────────────────
  const [dragItem, setDragItem] = useState<DragItem>(null);
  const [dragOverItem, setDragOverItem] = useState<DragItem>(null);

  // Project drag handlers
  const handleProjectDragStart = useCallback((projectId: string) => {
    setDragItem({ type: 'project', id: projectId });
  }, []);

  const handleProjectDragOver = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    if (dragItem?.type === 'project' && dragItem.id !== projectId) {
      setDragOverItem({ type: 'project', id: projectId });
    }
  }, [dragItem]);

  const handleProjectDrop = useCallback((columnNodes: ProjectTreeNode[]) => {
    if (!dragItem || !dragOverItem || dragItem.type !== 'project' || dragOverItem.type !== 'project') {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }
    const fromIdx = columnNodes.findIndex((n) => n.project.id === dragItem.id);
    const toIdx = columnNodes.findIndex((n) => n.project.id === dragOverItem.id);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }
    const reordered = [...columnNodes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updates = reordered.map((n, idx) => ({ id: n.project.id, sort_order: idx }));
    onReorderProjects(updates);
    setDragItem(null);
    setDragOverItem(null);
  }, [dragItem, dragOverItem, onReorderProjects]);

  // Task drag handlers
  const handleTaskDragStart = useCallback((taskId: string, projectId: string) => {
    setDragItem({ type: 'task', id: taskId, projectId });
  }, []);

  const handleTaskDragOver = useCallback((e: React.DragEvent, taskId: string, projectId: string) => {
    e.preventDefault();
    if (dragItem?.type === 'task' && dragItem.projectId === projectId && dragItem.id !== taskId) {
      setDragOverItem({ type: 'task', id: taskId, projectId });
    }
  }, [dragItem]);

  const handleTaskDrop = useCallback((projectId: string) => {
    if (!dragItem || !dragOverItem || dragItem.type !== 'task' || dragOverItem.type !== 'task' || dragItem.projectId !== projectId) {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }
    const tasks = tasksByProject.get(projectId) || [];
    const fromIdx = tasks.findIndex((t) => t.id === dragItem.id);
    const toIdx = tasks.findIndex((t) => t.id === dragOverItem.id);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }
    const reordered = [...tasks];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updates = reordered.map((t, idx) => ({ id: t.id, sort_order: idx }));
    onReorderTasks({ projectId, items: updates });
    setDragItem(null);
    setDragOverItem(null);
  }, [dragItem, dragOverItem, tasksByProject, onReorderTasks]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDragOverItem(null);
  }, []);

  // ─── Column Grouping (담당자별) ──────────────────────
  const columns = useMemo(() => {
    const grouped = new Map<string, ProjectTreeNode[]>();

    for (const node of roots) {
      const assigneeIds =
        node.project.assignee_ids?.length > 0
          ? node.project.assignee_ids
          : node.project.assignee_id
            ? [node.project.assignee_id]
            : ['__unassigned__'];

      for (const aid of assigneeIds) {
        const list = grouped.get(aid) ?? [];
        list.push(node);
        grouped.set(aid, list);
      }
    }

    const result: { id: string; user: UserType | null; nodes: ProjectTreeNode[] }[] = [];

    for (const user of users.filter((u) => u.is_active)) {
      const nodes = grouped.get(user.id);
      if (nodes && nodes.length > 0) {
        result.push({ id: user.id, user, nodes });
      }
    }

    const unassigned = grouped.get('__unassigned__');
    if (unassigned && unassigned.length > 0) {
      result.push({ id: '__unassigned__', user: null, nodes: unassigned });
    }

    return result;
  }, [roots, users]);

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Users className="size-10 mb-3 text-stone-300" />
        <p className="text-sm">프로젝트가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle for completed projects */}
      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setShowCompleted(!showCompleted)}
          className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors', showCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'text-muted-foreground border-stone-200 hover:bg-stone-50')}
        >
          {showCompleted ? '\u2705 완료 포함' : '완료 숨김'}
        </button>
      </div>

      <div
        className={cn(
          'flex gap-4 pb-4 snap-x',
          // 높이를 뷰포트 기준으로 제한하여 가로 스크롤바가 보이는 영역에 위치
          'overflow-x-auto overflow-y-auto overscroll-x-contain',
          'max-h-[calc(100vh-280px)]',
          'max-md:flex-col max-md:overflow-x-visible max-md:max-h-none',
          '[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-stone-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-stone-400',
          '[&::-webkit-scrollbar:vertical]:w-2 [&::-webkit-scrollbar-thumb:vertical]:bg-stone-200',
        )}
        style={{ scrollbarGutter: 'stable' }}
      >
        {columns.map((col) => {
          const visibleNodes = showCompleted
            ? col.nodes
            : col.nodes.filter((n) => n.project.state !== '완료');
          const completedCount = col.nodes.filter((n) => n.project.state === '완료').length;
          const inProgressCount = col.nodes.length - completedCount;

          return (
            <div key={col.id} className={cn('flex-shrink-0 w-[340px] max-md:w-full snap-start flex flex-col gap-2')}>
              {/* Column header */}
              <div className="flex items-center gap-2 px-2 py-2 sticky top-0 bg-stone-50/90 backdrop-blur-sm z-10 rounded-xl border">
                {col.user ? (
                  <div className="size-7 rounded-full bg-orange-100 flex items-center justify-center ring-2 ring-white">
                    <UserIcon className="size-4 text-orange-600" />
                  </div>
                ) : (
                  <div className="size-7 rounded-full bg-stone-100 flex items-center justify-center ring-2 ring-white">
                    <UserIcon className="size-4 text-stone-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-bold truncate block">{col.user?.name ?? '미지정'}</span>
                  <span className="text-[10px] text-muted-foreground">{inProgressCount} 진행중 · {completedCount} 완료</span>
                </div>
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{col.nodes.length}</Badge>
              </div>

              {/* Cards */}
              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {visibleNodes.map((node) => (
                    <ProjectCard
                      key={node.project.id}
                      node={node}
                      users={users}
                      onUpdateProject={onUpdateProject}
                      onUpdateTask={onUpdateTask}
                      todayMs={todayMs}
                      isDragging={dragItem?.type === 'project' && dragItem.id === node.project.id}
                      isDragOver={dragOverItem?.type === 'project' && dragOverItem.id === node.project.id}
                      onDragStart={() => handleProjectDragStart(node.project.id)}
                      onDragOver={(e) => handleProjectDragOver(e, node.project.id)}
                      onDrop={() => handleProjectDrop(visibleNodes)}
                      onDragEnd={handleDragEnd}
                      dragItem={dragItem}
                      dragOverItem={dragOverItem}
                      onTaskDragStart={handleTaskDragStart}
                      onTaskDragOver={handleTaskDragOver}
                      onTaskDrop={handleTaskDrop}
                    />
                  ))}
                </AnimatePresence>
                {visibleNodes.length === 0 && (
                  <div className="text-center py-6 text-[11px] text-muted-foreground border border-dashed rounded-xl">
                    {completedCount > 0 ? `완료 ${completedCount}건 (숨김)` : '프로젝트 없음'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
