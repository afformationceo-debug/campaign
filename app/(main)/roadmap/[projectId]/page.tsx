'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useRealtimeProjects } from '@/hooks/use-realtime-projects';
import {
  useUpdateProject,
  useCreateProjectTask,
  useUpdateProjectTask,
  useDeleteProjectTask,
} from '@/hooks/use-project-mutations';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Project, ProjectTask, ProjectState, User as UserType } from '@/lib/types/database';

const STATE_CONFIG: Record<ProjectState, { label: string; color: string; icon: React.ElementType; badgeBg: string }> = {
  '진행중': { label: '진행중', color: 'text-blue-600', icon: Clock, badgeBg: 'bg-blue-50 dark:bg-blue-950' },
  '완료': { label: '완료', color: 'text-emerald-600', icon: CheckCircle2, badgeBg: 'bg-emerald-50 dark:bg-emerald-950' },
};

const STATES: ProjectState[] = ['진행중', '완료'];

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const supabase = createClient();
  useRealtimeProjects();

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [taskForm, setTaskForm] = useState<Partial<ProjectTask>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<Partial<Project>>({});

  const { mutate: updateProject } = useUpdateProject();
  const { mutate: createTask, isPending: creatingTask } = useCreateProjectTask();
  const { mutate: updateTask, isPending: updatingTask } = useUpdateProjectTask();
  const { mutate: deleteTask } = useDeleteProjectTask();

  // Fetch project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!projectId,
  });

  // Fetch tasks for this project
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: queryKeys.projectTasks.byProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as ProjectTask[];
    },
    enabled: !!projectId,
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (error) throw error;
      return data as UserType[];
    },
  });

  const assignee = users.find((u) => u.id === project?.assignee_id);
  const completedCount = tasks.filter((t) => t.state === '완료').length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ state: '진행중', sort_order: tasks.length });
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: ProjectTask) => {
    setEditingTask(task);
    setTaskForm(task);
    setTaskDialogOpen(true);
  };

  const handleTaskSubmit = () => {
    if (!taskForm.title?.trim()) return;
    if (editingTask) {
      updateTask({
        id: editingTask.id,
        project_id: projectId,
        title: taskForm.title,
        state: taskForm.state as ProjectState,
        assignee_id: taskForm.assignee_id,
        due_date: taskForm.due_date,
        memo: taskForm.memo,
        sort_order: taskForm.sort_order,
      });
    } else {
      createTask({
        project_id: projectId,
        title: taskForm.title!,
        state: (taskForm.state as ProjectState) ?? '진행중',
        assignee_id: taskForm.assignee_id,
        due_date: taskForm.due_date,
        sort_order: taskForm.sort_order,
        memo: taskForm.memo,
      });
    }
    setTaskDialogOpen(false);
  };

  const handleDeleteTask = () => {
    if (deletingTaskId) {
      deleteTask({ id: deletingTaskId, project_id: projectId });
    }
    setDeleteDialogOpen(false);
    setDeletingTaskId(null);
  };

  const handleStateChange = (taskId: string, newState: ProjectState) => {
    updateTask({ id: taskId, project_id: projectId, state: newState });
  };

  const openEditProject = () => {
    if (project) {
      setProjectForm(project);
      setEditProjectOpen(true);
    }
  };

  const handleProjectSubmit = () => {
    if (!project || !projectForm.project_name?.trim()) return;
    updateProject({
      id: project.id,
      project_name: projectForm.project_name,
      url: projectForm.url,
      assignee_id: projectForm.assignee_id,
      start_date: projectForm.start_date,
      due_date: projectForm.due_date,
      state: projectForm.state as ProjectState,
      memo: projectForm.memo,
    });
    setEditProjectOpen(false);
  };

  if (projectLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
          <span className="text-sm">로딩 중...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted-foreground">프로젝트를 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => router.push('/roadmap')}>
          <ArrowLeft className="size-4 mr-1" />
          로드맵으로 돌아가기
        </Button>
      </div>
    );
  }

  // Defensive: STATE_CONFIG only knows '진행중'/'완료'. Any legacy/dirty value falls back to '진행중'
  // to prevent client-side exception (root cause of past crash with stale '진행전' rows).
  const projectStateConfig = STATE_CONFIG[project.state] ?? STATE_CONFIG['진행중'];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground"
          onClick={() => router.push('/roadmap')}
        >
          <ArrowLeft className="size-4 mr-1" />
          로드맵
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className={cn('text-xs', projectStateConfig.color, projectStateConfig.badgeBg)}>
                {projectStateConfig.label}
              </Badge>
              {project.url && (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1 text-xs"
                >
                  <ExternalLink className="size-3" />
                  링크
                </a>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{project.project_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {assignee && (
                <span className="flex items-center gap-1">
                  <User className="size-3.5" />
                  {assignee.name}
                </span>
              )}
              {project.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {project.start_date}
                </span>
              )}
              {project.due_date && (
                <span className="flex items-center gap-1">
                  ~ {project.due_date}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={openEditProject}>
            <Pencil className="size-3.5 mr-1" />
            수정
          </Button>
        </div>

        {project.memo && (
          <div className="mt-4 p-3 rounded-lg bg-muted/30 border text-sm text-muted-foreground whitespace-pre-line">
            {project.memo}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">전체 진행률</span>
          <span className="text-sm text-muted-foreground">{completedCount}/{tasks.length} ({progressPct}%)</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-gray-300'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">하위 업무 ({tasks.length})</h2>
          <Button size="sm" onClick={openCreateTask} className="gap-1.5">
            <Plus className="size-4" />
            업무 추가
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 border rounded-xl bg-muted/10">
            <p className="text-sm">아직 하위 업무가 없습니다.</p>
            <Button variant="outline" size="sm" onClick={openCreateTask}>
              <Plus className="size-4 mr-1" />
              첫 업무 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {tasks.map((task, idx) => {
                const config = STATE_CONFIG[task.state] ?? STATE_CONFIG['진행중'];
                const StateIcon = config.icon;
                const taskAssignee = users.find((u) => u.id === task.assignee_id);

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-primary/20 transition-all"
                  >
                    <GripVertical className="size-4 text-muted-foreground/30 shrink-0" />
                    <span className="text-xs text-muted-foreground/50 w-5 shrink-0">{idx + 1}</span>

                    {/* Quick state toggle */}
                    <Select
                      value={task.state}
                      onValueChange={(v) => handleStateChange(task.id, v as ProjectState)}
                    >
                      <SelectTrigger className={cn('w-[90px] h-7 text-[11px] border-0 bg-transparent px-1.5', config.color)}>
                        <div className="flex items-center gap-1">
                          <StateIcon className="size-3" />
                          <span>{config.label}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent position="popper" className="min-w-[100px]">
                        {STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            <div className="flex items-center gap-1.5">
                              {(() => { const C = STATE_CONFIG[s]; const I = C.icon; return <I className={cn('size-3', C.color)} />; })()}
                              {STATE_CONFIG[s].label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium truncate',
                        task.state === '완료' && 'line-through text-muted-foreground'
                      )}>
                        {task.title}
                      </p>
                      {task.memo && (
                        <p className="text-[11px] text-muted-foreground/60 truncate">{task.memo}</p>
                      )}
                    </div>

                    {taskAssignee && (
                      <span className="text-[11px] text-muted-foreground shrink-0">{taskAssignee.name}</span>
                    )}
                    {task.due_date && (
                      <span className="text-[11px] text-muted-foreground shrink-0">{task.due_date}</span>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditTask(task)}>
                          <Pencil className="size-3.5 mr-2" />
                          수정
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { setDeletingTaskId(task.id); setDeleteDialogOpen(true); }}
                          className="text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Task Create/Edit Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? '업무 수정' : '새 업무 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task_title">업무 내용 *</Label>
              <Input
                id="task_title"
                value={taskForm.title ?? ''}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="업무 내용을 입력하세요"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>상태</Label>
                <Select
                  value={taskForm.state ?? '진행중'}
                  onValueChange={(v) => setTaskForm({ ...taskForm, state: v as ProjectState })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s} value={s}>{STATE_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>담당자</Label>
                <Select
                  value={taskForm.assignee_id ?? 'none'}
                  onValueChange={(v) => setTaskForm({ ...taskForm, assignee_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="task_due">마감일</Label>
              <Input
                id="task_due"
                type="date"
                value={taskForm.due_date ?? ''}
                onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value || null })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="task_memo">메모</Label>
              <Textarea
                id="task_memo"
                value={taskForm.memo ?? ''}
                onChange={(e) => setTaskForm({ ...taskForm, memo: e.target.value })}
                placeholder="메모..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTaskDialogOpen(false)}>취소</Button>
            <Button
              onClick={handleTaskSubmit}
              disabled={!taskForm.title?.trim() || creatingTask || updatingTask}
            >
              {editingTask ? '저장' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>업무 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">이 업무를 삭제하시겠습니까?</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={handleDeleteTask}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>프로젝트 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>프로젝트 이름</Label>
              <Input
                value={projectForm.project_name ?? ''}
                onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={projectForm.url ?? ''}
                onChange={(e) => setProjectForm({ ...projectForm, url: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>담당자</Label>
                <Select
                  value={projectForm.assignee_id ?? 'none'}
                  onValueChange={(v) => setProjectForm({ ...projectForm, assignee_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>상태</Label>
                <Select
                  value={projectForm.state ?? '진행중'}
                  onValueChange={(v) => setProjectForm({ ...projectForm, state: v as ProjectState })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s} value={s}>{STATE_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>시작일</Label>
                <Input
                  type="date"
                  value={projectForm.start_date ?? ''}
                  onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value || null })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>마감일</Label>
                <Input
                  type="date"
                  value={projectForm.due_date ?? ''}
                  onChange={(e) => setProjectForm({ ...projectForm, due_date: e.target.value || null })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>메모</Label>
              <Textarea
                value={projectForm.memo ?? ''}
                onChange={(e) => setProjectForm({ ...projectForm, memo: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditProjectOpen(false)}>취소</Button>
            <Button onClick={handleProjectSubmit}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
