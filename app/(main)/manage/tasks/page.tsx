'use client';

import { Fragment, useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Pencil, Plus, Trash2, ChevronsUpDown, X, ChevronDown, ChevronRight, CornerDownRight, Bot, Clock, ExternalLink, ListChecks } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// DataTable not used for hierarchical task display
import type { Task, TaskCategory, TaskFrequency, TaskScope, TaskPriority, TaskStep, User } from '@/lib/types/database';

const FREQUENCY_CONFIG: Record<TaskFrequency, { label: string; className: string }> = {
  daily: { label: '매일', className: 'bg-secondary text-secondary-foreground' },
  weekly: { label: '주간', className: 'bg-secondary text-secondary-foreground' },
  monthly: { label: '월간', className: 'bg-secondary text-secondary-foreground' },
  once: { label: '1회', className: 'bg-secondary text-secondary-foreground' },
  as_needed: { label: '수시', className: 'bg-secondary text-secondary-foreground' },
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: '긴급', label: '긴급' },
  { value: '높음', label: '높음' },
  { value: '보통', label: '보통' },
  { value: '낮음', label: '낮음' },
];

const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  '긴급': 'bg-destructive/15 text-destructive border-destructive/30',
  '높음': 'bg-foreground/10 text-foreground border-foreground/20',
  '보통': 'bg-secondary text-muted-foreground border-border',
  '낮음': 'bg-secondary/50 text-muted-foreground/60 border-border/50',
};

interface TaskFormData {
  task_name: string;
  description: string;
  tool: string;
  category: TaskCategory;
  frequency: TaskFrequency;
  loop_order: string;
  default_assignees: string[];
  scope: TaskScope;
  parent_task_id: string | null;
  sub_order: number;
  priority: TaskPriority;
  estimated_minutes: string;
  instruction_url: string;
}

interface StepFormItem {
  id?: string; // existing step id (undefined for new)
  step_order: number;
  step_name: string;
  step_description: string;
  tool_url: string;
  _deleted?: boolean;
}

export default function TasksPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    task_name: '',
    description: '',
    tool: '',
    category: '보고',
    frequency: 'daily',
    loop_order: '',
    default_assignees: [],
    scope: 'campaign',
    parent_task_id: null,
    sub_order: 0,
    priority: '보통',
    estimated_minutes: '',
    instruction_url: '',
  });
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Steps preview: inline expand below task row
  const [stepsPreviewTaskId, setStepsPreviewTaskId] = useState<string | null>(null);
  const [previewSteps, setPreviewSteps] = useState<TaskStep[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const toggleStepsPreview = useCallback(async (taskId: string) => {
    if (stepsPreviewTaskId === taskId) {
      setStepsPreviewTaskId(null);
      return;
    }
    setStepsPreviewTaskId(taskId);
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_steps')
        .select('*')
        .eq('task_id', taskId)
        .order('step_order');
      if (error) throw error;
      setPreviewSteps((data ?? []) as TaskStep[]);
    } catch {
      setPreviewSteps([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [supabase, stepsPreviewTaskId]);

  // Task steps state for edit dialog
  const [steps, setSteps] = useState<StepFormItem[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);

  // Fetch task steps when editing an existing task
  const fetchSteps = useCallback(async (taskId: string) => {
    setStepsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_steps')
        .select('*')
        .eq('task_id', taskId)
        .order('step_order');
      if (error) throw error;
      const fetched = (data as TaskStep[]).map((s) => ({
        id: s.id,
        step_order: s.step_order,
        step_name: s.step_name,
        step_description: s.step_description ?? '',
        tool_url: s.tool_url ?? '',
      }));
      setSteps(fetched);
    } catch {
      setSteps([]);
    } finally {
      setStepsLoading(false);
    }
  }, [supabase]);

  // Fetch active users for assignee selection
  const { data: activeUsers = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as User[];
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('loop_order');
      if (error) throw error;
      return data as Task[];
    },
  });

  const saveSteps = useCallback(async (taskId: string, stepItems: StepFormItem[]) => {
    // Delete removed steps
    const toDelete = stepItems.filter((s) => s._deleted && s.id);
    for (const s of toDelete) {
      await supabase.from('task_steps').delete().eq('id', s.id!);
    }

    // Upsert remaining steps
    const toSave = stepItems.filter((s) => !s._deleted);
    for (const s of toSave) {
      const payload = {
        task_id: taskId,
        step_order: s.step_order,
        step_name: s.step_name,
        step_description: s.step_description || null,
        tool_url: s.tool_url || null,
      };
      if (s.id) {
        await supabase.from('task_steps').update(payload).eq('id', s.id);
      } else {
        await supabase.from('task_steps').insert(payload);
      }
    }
  }, [supabase]);

  const createMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const assigneesArr = data.default_assignees.length > 0 ? data.default_assignees : null;
      const parsedMinutes = data.estimated_minutes ? parseInt(data.estimated_minutes, 10) : null;
      const payload: Record<string, unknown> = {
        task_name: data.task_name,
        description: data.description || null,
        tool: data.tool || null,
        category: data.category,
        frequency: data.frequency,
        loop_order: Number(data.loop_order),
        default_assignees: assigneesArr,
        is_applicable_default: true,
        scope: data.scope,
        priority: data.priority,
        estimated_minutes: parsedMinutes,
        instruction_url: data.instruction_url || null,
      };
      if (data.parent_task_id) {
        payload.parent_task_id = data.parent_task_id;
        payload.sub_order = data.sub_order;
      }
      const { data: inserted, error } = await supabase.from('tasks').insert(payload).select('id').single();
      if (error) throw error;
      // Save steps for newly created task
      if (inserted && steps.filter((s) => !s._deleted).length > 0) {
        await saveSteps(inserted.id, steps);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TaskFormData }) => {
      const assigneesArr = data.default_assignees.length > 0 ? data.default_assignees : null;
      const parsedMinutes = data.estimated_minutes ? parseInt(data.estimated_minutes, 10) : null;
      const { error } = await supabase
        .from('tasks')
        .update({
          task_name: data.task_name,
          description: data.description || null,
          tool: data.tool || null,
          category: data.category,
          frequency: data.frequency,
          loop_order: Number(data.loop_order),
          default_assignees: assigneesArr,
          scope: data.scope,
          priority: data.priority,
          estimated_minutes: parsedMinutes,
          instruction_url: data.instruction_url || null,
        })
        .eq('id', id);
      if (error) throw error;
      // Save steps
      await saveSteps(id, steps);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      // Cascade deletes config/check records, so invalidate those caches too
      queryClient.invalidateQueries({ queryKey: queryKeys.taskConfig.all });
      queryClient.invalidateQueries({ queryKey: ['checks'] });
    },
  });

  // Build hierarchy
  const { topLevelTasks, childTaskMap } = useMemo(() => {
    const top = tasks.filter((t) => !t.parent_task_id);
    const childMap = new Map<string, Task[]>();
    tasks.filter((t) => t.parent_task_id).forEach((t) => {
      const children = childMap.get(t.parent_task_id!) ?? [];
      children.push(t);
      childMap.set(t.parent_task_id!, children);
    });
    childMap.forEach((children) => children.sort((a, b) => a.sub_order - b.sub_order));
    return { topLevelTasks: top, childTaskMap: childMap };
  }, [tasks]);

  const toggleParentExpand = (taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const openCreateDialog = () => {
    setEditingTask(null);
    setSteps([]);
    setFormData({
      task_name: '',
      description: '',
      tool: '',
      category: '보고',
      frequency: 'daily',
      loop_order: String((topLevelTasks.length > 0 ? Math.max(...topLevelTasks.map((t) => t.loop_order)) : 0) + 1),
      default_assignees: [],
      scope: 'campaign',
      parent_task_id: null,
      sub_order: 0,
      priority: '보통',
      estimated_minutes: '',
      instruction_url: '',
    });
    setIsDialogOpen(true);
  };

  const openCreateSubTaskDialog = (parentTask: Task) => {
    const existingChildren = childTaskMap.get(parentTask.id) ?? [];
    const nextSubOrder = existingChildren.length > 0
      ? Math.max(...existingChildren.map((c) => c.sub_order)) + 1
      : 1;
    setEditingTask(null);
    setSteps([]);
    setFormData({
      task_name: '',
      description: '',
      tool: parentTask.tool ?? '',
      category: parentTask.category,
      frequency: parentTask.frequency,
      loop_order: String(parentTask.loop_order),
      default_assignees: parentTask.default_assignees ?? [],
      scope: parentTask.scope,
      parent_task_id: parentTask.id,
      sub_order: nextSubOrder,
      priority: parentTask.priority ?? '보통',
      estimated_minutes: '',
      instruction_url: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      task_name: task.task_name,
      description: task.description ?? '',
      tool: task.tool ?? '',
      category: task.category,
      frequency: task.frequency,
      loop_order: String(task.loop_order),
      default_assignees: task.default_assignees ?? [],
      scope: task.scope ?? 'campaign',
      parent_task_id: task.parent_task_id ?? null,
      sub_order: task.sub_order ?? 0,
      priority: task.priority ?? '보통',
      estimated_minutes: task.estimated_minutes != null ? String(task.estimated_minutes) : '',
      instruction_url: task.instruction_url ?? '',
    });
    setSteps([]);
    fetchSteps(task.id);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTask(null);
    setSteps([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Step management helpers
  const addStep = () => {
    const visibleSteps = steps.filter((s) => !s._deleted);
    const nextOrder = visibleSteps.length > 0 ? Math.max(...visibleSteps.map((s) => s.step_order)) + 1 : 1;
    setSteps((prev) => [...prev, {
      step_order: nextOrder,
      step_name: '',
      step_description: '',
      tool_url: '',
    }]);
  };

  const updateStep = (index: number, field: keyof StepFormItem, value: string | number) => {
    setSteps((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const deleteStep = (index: number) => {
    setSteps((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      // If it has an id (existing in DB), mark as deleted; otherwise remove
      if (s.id) return { ...s, _deleted: true };
      return s;
    }).filter((s) => s.id || !s._deleted)); // remove non-persisted deleted items immediately
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <span className="text-lg">🔒</span>
          </div>
          <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">행위 관리, 체계적으로 정리해줄게.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            캠페인별 업무를 카테고리와 주기로 분류하고, 하위 업무까지 한 곳에서 관리하세요.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="rounded-lg bg-foreground text-background hover:bg-foreground/90">
          <Plus className="h-4 w-4 mr-2" />
          새 업무
        </Button>
      </motion.div>

      {/* AI Agent Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-xl border border-border bg-secondary px-4 py-3.5 overflow-hidden">
          <div className="flex gap-3 items-start relative">
            <div className="relative shrink-0 mt-0.5">
              <div className="size-9 rounded-full bg-foreground flex items-center justify-center">
                <Bot className="size-4 text-background" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-foreground border-2 border-background" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-foreground">bkit AI Agent</p>
                <span className="text-[9px] font-medium text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded-full">행위 관리 가이드</span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-[1.7] space-y-1">
                <p>안녕하세요, 어포메이션 임직원 여러분! 행위(업무) 관리 페이지를 안내해 드립니다.</p>
                <div className="bg-background/50 rounded-lg px-3 py-2 space-y-0.5 border border-border">
                  <p>여기서 등록하는 <strong className="text-foreground">업무 항목</strong>이 담당자별 일일 체크에 반영됩니다.</p>
                  <p><strong className="text-foreground">카테고리, 주기, 범위(전역/캠페인별)</strong>를 정확히 설정해야 올바른 업무가 올바른 대상에게 보입니다.</p>
                  <p><strong className="text-foreground">하위 업무</strong>를 활용하면 큰 업무를 세부 단계로 분리하여 관리할 수 있습니다.</p>
                </div>
                <p className="text-[10px] text-muted-foreground/60">업무 항목의 변경은 곧바로 모든 체크리스트에 반영되니 신중하게 관리해 주세요!</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>
        </div>
      ) : (
        <motion.div variants={fadeUpItem}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground w-10">#</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground">업무명</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground w-[70px]">카테고리</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground w-[50px]">주기</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground w-[50px]">범위</th>
                  <th className="text-center px-3 py-2 text-[11px] font-medium text-muted-foreground w-[50px]">우선순위</th>
                  <th className="text-center px-3 py-2 text-[11px] font-medium text-muted-foreground w-[45px]">소요</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground">담당자</th>
                  <th className="text-center px-3 py-2 text-[11px] font-medium text-muted-foreground w-[40px]">SOP</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground w-[90px]"></th>
                </tr>
              </thead>
              <tbody>
                {topLevelTasks.map((task) => {
                  const children = childTaskMap.get(task.id) ?? [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedParents.has(task.id);
                  const freq = FREQUENCY_CONFIG[task.frequency];

                  return (
                    <Fragment key={task.id}>
                      {/* Parent row */}
                      <tr className={cn('border-b border-border hover:bg-secondary/30 transition-colors', hasChildren && 'bg-secondary/10')}>
                        <td className="px-3 py-2">
                          <span className="text-muted-foreground text-[11px] font-mono">{task.loop_order}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {hasChildren && (
                              <button
                                type="button"
                                className="shrink-0 p-0.5 rounded hover:bg-secondary"
                                onClick={() => toggleParentExpand(task.id)}
                              >
                                {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                              </button>
                            )}
                            <span className="font-medium text-[12px]">{task.task_name}</span>
                            {hasChildren && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
                                하위 {children.length}
                              </Badge>
                            )}
                            <button
                              type="button"
                              className={cn(
                                'shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors border',
                                stepsPreviewTaskId === task.id
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
                              )}
                              onClick={() => toggleStepsPreview(task.id)}
                              title="업무 단계 보기"
                            >
                              <ListChecks className="size-3" />
                              단계
                            </button>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[400px] mt-0.5" title={task.description}>
                              {task.description}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px] bg-secondary text-secondary-foreground rounded-full">
                            {task.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className={`text-[10px] rounded-full ${freq.className}`}>
                            {freq.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className={`text-[10px] rounded-full ${task.scope === 'global' ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground'}`}>
                            {task.scope === 'global' ? '전역' : '캠페인'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {task.priority && task.priority !== '보통' ? (
                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center', PRIORITY_BADGE_CLASS[task.priority])}>
                              {task.priority}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">보통</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {task.estimated_minutes != null ? (
                            <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                              <Clock className="size-2.5" />
                              {task.estimated_minutes}m
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-muted-foreground">
                          {task.default_assignees?.join(', ') ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {task.instruction_url ? (
                            <a
                              href={task.instruction_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
                              title={task.instruction_url}
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon-xs" onClick={() => openCreateSubTaskDialog(task)} title="하위 업무 추가">
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon-xs" onClick={() => openEditDialog(task)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                const msg = hasChildren
                                  ? `"${task.task_name}" 및 하위 ${children.length}개 업무를 모두 삭제하시겠습니까?`
                                  : `"${task.task_name}" 업무를 삭제하시겠습니까?`;
                                if (confirm(msg)) deleteMutation.mutate(task.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Steps preview row (inline below task) */}
                      {stepsPreviewTaskId === task.id && (
                        <tr className="border-b border-border bg-secondary/20">
                          <td colSpan={10} className="px-4 py-2">
                            {previewLoading ? (
                              <div className="flex items-center gap-2 py-1">
                                <div className="size-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                                <span className="text-[11px] text-muted-foreground">단계 불러오는 중...</span>
                              </div>
                            ) : previewSteps.length === 0 ? (
                              <div className="flex items-center gap-2 py-1">
                                <ListChecks className="size-3.5 text-muted-foreground/40" />
                                <span className="text-[11px] text-muted-foreground">
                                  등록된 업무 단계가 없습니다.
                                </span>
                                <button
                                  type="button"
                                  className="text-[10px] text-primary hover:underline ml-1"
                                  onClick={() => openEditDialog(task)}
                                >
                                  단계 추가하기
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <ListChecks className="size-3.5 text-foreground" />
                                  <span className="text-[11px] font-semibold text-foreground">업무 단계 ({previewSteps.length})</span>
                                </div>
                                <div className="grid gap-1">
                                  {previewSteps.map((step) => (
                                    <div key={step.id} className="flex items-start gap-2 pl-1">
                                      <span className="shrink-0 size-5 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center mt-0.5">
                                        {step.step_order}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] font-medium text-foreground">{step.step_name}</span>
                                          {step.tool_url && (
                                            <a
                                              href={step.tool_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
                                            >
                                              <ExternalLink className="size-2.5" />
                                              도구
                                            </a>
                                          )}
                                        </div>
                                        {step.step_description && (
                                          <p className="text-[10px] text-muted-foreground leading-relaxed">{step.step_description}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}

                      {/* Sub-task rows */}
                      {isExpanded && children.map((child) => (
                        <tr key={child.id} className="border-b border-border hover:bg-secondary/20 transition-colors bg-secondary/5">
                          <td className="px-3 py-1.5">
                            <span className="text-muted-foreground/50 text-[10px] font-mono pl-2">{task.loop_order}-{child.sub_order}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2 pl-6">
                              <CornerDownRight className="size-3 text-muted-foreground/50 shrink-0" />
                              <span className="text-[12px]">{child.task_name}</span>
                            </div>
                            {child.description && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[350px] mt-0.5 pl-[34px]" title={child.description}>
                                {child.description}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-[10px] text-muted-foreground">{child.category}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-[10px] text-muted-foreground">{FREQUENCY_CONFIG[child.frequency]?.label}</span>
                          </td>
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5 text-center">
                            {child.priority && child.priority !== '보통' ? (
                              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center', PRIORITY_BADGE_CLASS[child.priority])}>
                                {child.priority}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/30">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {child.estimated_minutes != null ? (
                              <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <Clock className="size-2.5" />
                                {child.estimated_minutes}m
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/30">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-[11px] text-muted-foreground">
                            {child.default_assignees?.join(', ') ?? '-'}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {child.instruction_url ? (
                              <a href={child.instruction_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:text-primary/80">
                                <ExternalLink className="size-3.5" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/30">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon-xs" onClick={() => openEditDialog(child)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`"${child.task_name}" 하위 업무를 삭제하시겠습니까?`)) {
                                    deleteMutation.mutate(child.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={cn('bg-card border-border', editingTask ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
          <DialogHeader>
            <DialogTitle className="font-bold">
              {editingTask
                ? (editingTask.parent_task_id ? '하위 업무 수정' : '업무 수정')
                : (formData.parent_task_id ? '하위 업무 추가' : '새 업무 추가')}
            </DialogTitle>
            <DialogDescription>
              {formData.parent_task_id
                ? '상위 업무의 하위 단계를 추가합니다. 카테고리, 주기, 범위는 상위 업무를 따릅니다.'
                : editingTask ? '업무 항목의 정보를 수정합니다.' : '새로운 업무 항목을 추가합니다.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task_name">업무명 *</Label>
                <Input
                  id="task_name"
                  required
                  value={formData.task_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, task_name: e.target.value }))
                  }
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loop_order">순서 *</Label>
                <Input
                  id="loop_order"
                  type="number"
                  required
                  value={formData.loop_order}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, loop_order: e.target.value }))
                  }
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">상세내용</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="업무 상세내용을 입력하세요 (담당자별 화면에서 조회 가능)"
                rows={3}
                className="text-sm bg-secondary/50 border-border"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>우선순위</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, priority: v as TaskPriority }))
                  }
                >
                  <SelectTrigger className="w-full bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_minutes">예상 소요시간</Label>
                <Input
                  id="estimated_minutes"
                  type="number"
                  min={0}
                  value={formData.estimated_minutes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, estimated_minutes: e.target.value }))
                  }
                  placeholder="예상 소요시간 (분)"
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instruction_url">SOP 문서</Label>
                <Input
                  id="instruction_url"
                  type="url"
                  value={formData.instruction_url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, instruction_url: e.target.value }))
                  }
                  placeholder="SOP 문서 링크 (URL)"
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, category: v as TaskCategory }))
                  }
                  disabled={!!formData.parent_task_id}
                >
                  <SelectTrigger className="w-full bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ORDER.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>주기</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, frequency: v as TaskFrequency }))
                  }
                  disabled={!!formData.parent_task_id}
                >
                  <SelectTrigger className="w-full bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>범위</Label>
              <Select
                value={formData.scope}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, scope: v as TaskScope }))
                }
                disabled={!!formData.parent_task_id}
              >
                <SelectTrigger className="w-full bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="campaign">캠페인 (캠페인별 매트릭스)</SelectItem>
                  <SelectItem value="global">전역 (담당자별 일일 체크만)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tool">도구</Label>
                <Input
                  id="tool"
                  value={formData.tool}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tool: e.target.value }))
                  }
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>기본 담당자</Label>
                <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'w-full justify-between font-normal h-9 bg-secondary/50 border-border',
                        formData.default_assignees.length === 0 && 'text-muted-foreground'
                      )}
                    >
                      <span className="truncate">
                        {formData.default_assignees.length > 0
                          ? formData.default_assignees.join(', ')
                          : '담당자 선택...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-2" align="start">
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {activeUsers.map((user) => {
                        const isSelected = formData.default_assignees.includes(user.name);
                        return (
                          <label
                            key={user.id}
                            className={cn(
                              'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-secondary transition-colors text-sm',
                              isSelected && 'bg-secondary'
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  default_assignees: checked
                                    ? [...prev.default_assignees, user.name]
                                    : prev.default_assignees.filter((n) => n !== user.name),
                                }));
                              }}
                            />
                            <span>{user.name}</span>
                            {user.position && (
                              <span className="text-[10px] text-muted-foreground ml-auto">{user.position}</span>
                            )}
                          </label>
                        );
                      })}
                      {activeUsers.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">등록된 담당자가 없습니다</p>
                      )}
                    </div>
                    {formData.default_assignees.length > 0 && (
                      <div className="border-t border-border mt-2 pt-2">
                        <div className="flex flex-wrap gap-1">
                          {formData.default_assignees.map((name) => (
                            <Badge key={name} variant="secondary" className="text-[10px] gap-1 pr-1 rounded-full">
                              {name}
                              <button
                                type="button"
                                className="hover:text-destructive transition-colors"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    default_assignees: prev.default_assignees.filter((n) => n !== name),
                                  }))
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Task Steps Section */}
            <div className="space-y-3 pt-2">
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold">업무 단계</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStep}
                    className="h-7 text-[11px] rounded-md border-border"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    추가
                  </Button>
                </div>

                {stepsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="size-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {steps.filter((s) => !s._deleted).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-3 bg-secondary/30 rounded-md border border-border">
                        등록된 업무 단계가 없습니다
                      </p>
                    ) : (
                      steps.map((step, index) => {
                        if (step._deleted) return null;
                        return (
                          <div key={step.id ?? `new-${index}`} className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] text-muted-foreground font-mono mt-2 shrink-0 w-5 text-center">
                                {step.step_order}
                              </span>
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={step.step_name}
                                  onChange={(e) => updateStep(index, 'step_name', e.target.value)}
                                  placeholder="단계 이름 *"
                                  className="bg-background border-border h-8 text-[12px]"
                                  required
                                />
                                <Textarea
                                  value={step.step_description}
                                  onChange={(e) => updateStep(index, 'step_description', e.target.value)}
                                  placeholder="단계 설명 (선택)"
                                  rows={2}
                                  className="bg-background border-border text-[12px] min-h-0"
                                />
                                <Input
                                  value={step.tool_url}
                                  onChange={(e) => updateStep(index, 'tool_url', e.target.value)}
                                  placeholder="도구/링크 URL (선택)"
                                  className="bg-background border-border h-8 text-[12px]"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="text-destructive hover:text-destructive mt-1"
                                onClick={() => deleteStep(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-lg border-border">
                취소
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || createMutation.isPending} className="bg-foreground text-background hover:bg-foreground/90 rounded-lg">
                {(updateMutation.isPending || createMutation.isPending) ? '저장 중...' : editingTask ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
