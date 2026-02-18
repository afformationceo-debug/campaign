'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Pencil, Plus, Trash2, ChevronsUpDown, X } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { DataTable, type ColumnDef } from '@/components/manage/data-table';
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
  });
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

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
      const { error } = await supabase.from('tasks').insert({
        task_name: data.task_name,
        description: data.description || null,
        tool: data.tool || null,
        category: data.category,
        frequency: data.frequency,
        loop_order: Number(data.loop_order),
        default_assignees: assigneesArr,
        is_applicable_default: true,
        scope: data.scope,
      });
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

  const openCreateDialog = () => {
    setEditingTask(null);
    setFormData({
      task_name: '',
      description: '',
      tool: '',
      category: '보고',
      frequency: 'daily',
      loop_order: String((tasks.length > 0 ? Math.max(...tasks.map((t) => t.loop_order)) : 0) + 1),
      default_assignees: [],
      scope: 'campaign',
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

  const columns: ColumnDef<Task>[] = [
    {
      key: 'loop_order',
      header: '#',
      sortable: true,
      className: 'w-12',
      sortValue: (row) => row.loop_order,
      cell: (row) => (
        <span className="text-muted-foreground text-xs font-mono">
          {row.loop_order}
        </span>
      ),
    },
    {
      key: 'task_name',
      header: '업무명',
      sortable: true,
      cell: (row) => <span className="font-medium">{row.task_name}</span>,
    },
    {
      key: 'category',
      header: '카테고리',
      sortable: true,
      sortValue: (row) => CATEGORY_ORDER.indexOf(row.category),
      cell: (row) => {
        const color = CATEGORY_COLORS[row.category];
        return (
          <Badge variant="secondary" className={`${color.bg} ${color.text} ${color.darkBg}`}>
            {row.category}
          </Badge>
        );
      },
    },
    {
      key: 'tool',
      header: '도구',
      sortable: true,
      cell: (row) => row.tool ?? '-',
    },
    {
      key: 'default_assignees',
      header: '기본 담당자',
      cell: (row) =>
        row.default_assignees?.length
          ? row.default_assignees.join(', ')
          : '-',
    },
    {
      key: 'scope',
      header: '범위',
      sortable: true,
      cell: (row) => (
        <Badge
          variant="secondary"
          className={
            row.scope === 'global'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30'
          }
        >
          {row.scope === 'global' ? '전역' : '캠페인'}
        </Badge>
      ),
    },
    {
      key: 'frequency',
      header: '주기',
      sortable: true,
      cell: (row) => {
        const config = FREQUENCY_CONFIG[row.frequency];
        return (
          <Badge variant="secondary" className={config.className}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => openEditDialog(row)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-red-500 hover:text-red-700"
            onClick={() => {
              if (confirm(`"${row.task_name}" 업무를 삭제하시겠습니까?`)) {
                deleteMutation.mutate(row.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

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
      className="space-y-6"
    >
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">행위 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">
            전체 {tasks.length}개 업무 항목을 관리합니다.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="rounded-lg">
          <Plus className="h-4 w-4 mr-2" />
          새 업무
        </Button>
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
          <DataTable
            columns={columns}
            data={tasks}
            searchKey="task_name"
            searchPlaceholder="업무명 검색..."
          />
        </motion.div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? '업무 수정' : '새 업무 추가'}</DialogTitle>
            <DialogDescription>
              {editingTask ? '업무 항목의 정보를 수정합니다.' : '새로운 업무 항목을 추가합니다.'}
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
              <Label htmlFor="description">설명</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
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
