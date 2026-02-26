'use client';

import { Fragment, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Pencil, Plus, Trash2, ChevronsUpDown, X, ChevronDown, ChevronRight, CornerDownRight, Bot } from 'lucide-react';
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
import type { Task, TaskCategory, TaskFrequency, TaskScope, User } from '@/lib/types/database';

const FREQUENCY_CONFIG: Record<TaskFrequency, { label: string; className: string }> = {
  daily: { label: '매일', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' },
  weekly: { label: '주간', className: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
  monthly: { label: '월간', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' },
  once: { label: '1회', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30' },
  as_needed: { label: '수시', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' },
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
  });
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

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

  const createMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const assigneesArr = data.default_assignees.length > 0 ? data.default_assignees : null;
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
      };
      if (data.parent_task_id) {
        payload.parent_task_id = data.parent_task_id;
        payload.sub_order = data.sub_order;
      }
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TaskFormData }) => {
      const assigneesArr = data.default_assignees.length > 0 ? data.default_assignees : null;
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
        })
        .eq('id', id);
      if (error) throw error;
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
    });
    setIsDialogOpen(true);
  };

  const openCreateSubTaskDialog = (parentTask: Task) => {
    const existingChildren = childTaskMap.get(parentTask.id) ?? [];
    const nextSubOrder = existingChildren.length > 0
      ? Math.max(...existingChildren.map((c) => c.sub_order)) + 1
      : 1;
    setEditingTask(null);
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
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTask(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
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
          <h1 className="text-xl font-bold tracking-tight">행위 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">
            전체 {topLevelTasks.length}개 업무 (하위 {tasks.length - topLevelTasks.length}개 포함)
          </p>
        </div>
        <Button onClick={openCreateDialog} className="rounded-lg">
          <Plus className="h-4 w-4 mr-2" />
          새 업무
        </Button>
      </motion.div>

      {/* AI Agent Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-xl border border-purple-100 dark:border-purple-900/30 bg-gradient-to-r from-purple-50/80 via-fuchsia-50/50 to-transparent dark:from-purple-950/30 dark:via-fuchsia-950/20 dark:to-transparent px-4 py-3.5 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100/30 to-transparent dark:from-purple-900/15 rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-fuchsia-100/20 to-transparent dark:from-fuchsia-900/10 rounded-tr-full" />
          <div className="flex gap-3 items-start relative">
            <div className="relative shrink-0 mt-0.5">
              <div className="size-9 rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-600 flex items-center justify-center shadow-md shadow-purple-200/50 dark:shadow-purple-900/30 ring-2 ring-white/80 dark:ring-white/10">
                <Bot className="size-4 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-purple-900 dark:text-purple-200">어포메이션 본질 AI Agent</p>
                <span className="text-[9px] font-medium text-purple-500/60 dark:text-purple-400/50 bg-purple-100/60 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">행위 관리 가이드</span>
              </div>
              <div className="text-[11px] text-purple-800/80 dark:text-purple-300/70 leading-[1.7] space-y-1">
                <p>안녕하세요, 어포메이션 임직원 여러분! 행위(업무) 관리 페이지를 안내해 드립니다.</p>
                <div className="bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2 space-y-0.5 border border-purple-100/50 dark:border-purple-800/20">
                  <p>여기서 등록하는 <strong className="text-purple-700 dark:text-purple-300">업무 항목</strong>이 담당자별 일일 체크에 반영됩니다.</p>
                  <p><strong className="text-fuchsia-700 dark:text-fuchsia-300">카테고리, 주기, 범위(전역/캠페인별)</strong>를 정확히 설정해야 올바른 업무가 올바른 대상에게 보입니다.</p>
                  <p><strong className="text-pink-700 dark:text-pink-300">하위 업무</strong>를 활용하면 큰 업무를 세부 단계로 분리하여 관리할 수 있습니다.</p>
                </div>
                <p className="text-[10px] text-purple-600/60 dark:text-purple-400/40">업무 항목의 변경은 곧바로 모든 체크리스트에 반영되니 신중하게 관리해 주세요!</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>
        </div>
      ) : (
        <motion.div variants={fadeUpItem}>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-12">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">업무명</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[80px]">카테고리</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[60px]">주기</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[60px]">범위</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">담당자</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[100px]"></th>
                </tr>
              </thead>
              <tbody>
                {topLevelTasks.map((task) => {
                  const children = childTaskMap.get(task.id) ?? [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedParents.has(task.id);
                  const color = CATEGORY_COLORS[task.category];
                  const freq = FREQUENCY_CONFIG[task.frequency];

                  return (
                    <Fragment key={task.id}>
                      {/* Parent row */}
                      <tr className={cn('border-b hover:bg-muted/30 transition-colors', hasChildren && 'bg-muted/10')}>
                        <td className="px-3 py-2">
                          <span className="text-muted-foreground text-xs font-mono">{task.loop_order}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {hasChildren && (
                              <button
                                type="button"
                                className="shrink-0 p-0.5 rounded hover:bg-accent"
                                onClick={() => toggleParentExpand(task.id)}
                              >
                                {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                              </button>
                            )}
                            <span className="font-medium">{task.task_name}</span>
                            {hasChildren && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                하위 {children.length}
                              </Badge>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[400px] mt-0.5" title={task.description}>
                              {task.description}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className={`text-[10px] ${color.bg} ${color.text} ${color.darkBg}`}>
                            {task.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className={`text-[10px] ${freq.className}`}>
                            {freq.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className={`text-[10px] ${task.scope === 'global' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30'}`}>
                            {task.scope === 'global' ? '전역' : '캠페인'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {task.default_assignees?.join(', ') ?? '-'}
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
                              className="text-red-500 hover:text-red-700"
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

                      {/* Sub-task rows */}
                      {isExpanded && children.map((child) => (
                        <tr key={child.id} className="border-b hover:bg-muted/20 transition-colors bg-accent/5">
                          <td className="px-3 py-1.5">
                            <span className="text-muted-foreground/50 text-[10px] font-mono pl-2">{child.sub_order}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2 pl-6">
                              <CornerDownRight className="size-3 text-muted-foreground/50 shrink-0" />
                              <span className="text-sm">{child.task_name}</span>
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
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">
                            {child.default_assignees?.join(', ') ?? '-'}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon-xs" onClick={() => openEditDialog(child)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-red-500 hover:text-red-700"
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="text-sm"
              />
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
                  <SelectTrigger className="w-full">
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
                  <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
                        'w-full justify-between font-normal h-9',
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
                              'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm',
                              isSelected && 'bg-accent'
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
                      <div className="border-t mt-2 pt-2">
                        <div className="flex flex-wrap gap-1">
                          {formData.default_assignees.map((name) => (
                            <Badge key={name} variant="secondary" className="text-[10px] gap-1 pr-1">
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                취소
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || createMutation.isPending}>
                {(updateMutation.isPending || createMutation.isPending) ? '저장 중...' : editingTask ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
