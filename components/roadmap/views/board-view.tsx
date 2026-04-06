'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FolderOpen,
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

// ── Task Item (with memo/result toggle) ───────────────

function TaskItem({
  task,
  onToggle,
  todayMs,
}: {
  task: ProjectTask;
  onToggle: () => void;
  todayMs: number;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const done = task.state === '완료';
  const status = getDeadlineStatus(task.due_date, task.state, todayMs);

  return (
    <div className={cn('rounded-lg transition-colors', done && 'opacity-60')}>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button type="button" onClick={onToggle} className="shrink-0">
          {done ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <Circle className="size-4 text-stone-300 hover:text-orange-400 transition-colors" />
          )}
        </button>
        <span className={cn('flex-1 text-[12px] truncate', done && 'line-through text-muted-foreground')}>
          {task.title}
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
}: {
  node: ProjectTreeNode;
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  todayMs: number;
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
        {status && node.project.due_date && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border shrink-0', deadlineBadgeStyles[status])}>
            {formatDate(node.project.due_date)}
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
              <TaskItem key={t.id} task={t} onToggle={() => handleToggleTask(t)} todayMs={todayMs} />
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

// ── Project Card ──────────────────────────────────────

function ProjectCard({
  node,
  users,
  onUpdateTask,
  todayMs,
}: {
  node: ProjectTreeNode;
  users: UserType[];
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  todayMs: number;
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

  // 미완료/완료 태스크 분리
  const inProgressTasks = tasks.filter((t) => t.state !== '완료');
  const completedTasks = tasks.filter((t) => t.state === '완료');
  const inProgressSubs = subProjects.filter((sp) => sp.project.state !== '완료');
  const completedSubs = subProjects.filter((sp) => sp.project.state === '완료');

  return (
    <div className={cn(
      'rounded-xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden',
      isCompleted && 'border-emerald-200 bg-emerald-50/30 opacity-70',
      status === 'overdue' && 'border-red-200',
      status === 'imminent' && 'border-amber-200',
    )}>
      {/* Card header */}
      <button type="button" onClick={() => setExpanded(!expanded)} className="w-full text-left px-3.5 py-3 space-y-2">
        <div className="flex items-start gap-2">
          {isCompleted ? (
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <Clock className="size-4 text-orange-500 shrink-0 mt-0.5" />
          )}
          <span className={cn('flex-1 text-[13px] font-semibold leading-tight line-clamp-2', isCompleted && 'line-through text-muted-foreground')}>
            {project.project_name}
          </span>
          {expanded ? <ChevronDown className="size-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />}
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

        {/* Info row: dates + deadline badge */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          {project.start_date && (
            <span className="text-muted-foreground">{formatDate(project.start_date)}</span>
          )}
          {project.start_date && project.due_date && <span className="text-muted-foreground/40">~</span>}
          {project.due_date && (
            <span className="text-muted-foreground">{formatDate(project.due_date)}</span>
          )}
          {status && project.due_date && (
            <span className={cn('px-1.5 py-0.5 rounded-full border font-medium', deadlineBadgeStyles[status])}>
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
          <span className="text-[10px] text-blue-500 flex items-center gap-1">
            <ExternalLink className="size-3" />
            {project.url.replace(/^https?:\/\//, '').slice(0, 30)}
          </span>
        )}
      </button>

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
                    <SubProjectRow key={sp.project.id} node={sp} onUpdateTask={onUpdateTask} todayMs={todayMs} />
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
                    <TaskItem key={t.id} task={t} onToggle={() => handleToggleTask(t)} todayMs={todayMs} />
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
}: {
  completedSubs: ProjectTreeNode[];
  completedTasks: ProjectTask[];
  onUpdateTask: (input: { id: string; project_id: string; [key: string]: any }) => void;
  onToggleTask: (task: ProjectTask) => void;
  todayMs: number;
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
            <SubProjectRow key={sp.project.id} node={sp} onUpdateTask={onUpdateTask} todayMs={todayMs} />
          ))}
          {completedTasks.map((t) => (
            <TaskItem key={t.id} task={t} onToggle={() => onToggleTask(t)} todayMs={todayMs} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function BoardView({
  roots,
  users,
  tasksByProject,
  onUpdateProject,
  onUpdateTask,
}: BoardViewProps) {
  const todayMs = useTodayMs();
  const [showCompleted, setShowCompleted] = useState(false);

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
          {showCompleted ? '✅ 완료 포함' : '완료 숨김'}
        </button>
      </div>

      <div className={cn(
        'flex gap-4 pb-4 snap-x',
        // 가로 스크롤: sticky bottom scrollbar — 맨 밑까지 안 내려가도 스크롤 가능
        'overflow-x-auto overscroll-x-contain',
        'max-md:flex-col max-md:overflow-x-visible',
        // 스크롤바 항상 표시 (macOS에서 기본 숨김 방지)
        '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-stone-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-stone-400',
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
                {visibleNodes.map((node) => (
                  <ProjectCard key={node.project.id} node={node} users={users} onUpdateTask={onUpdateTask} todayMs={todayMs} />
                ))}
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
