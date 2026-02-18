'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  LayoutGrid,
  Kanban,
  Table2,
  Search,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  User,
  FolderOpen,
  CheckCircle2,
  Clock,
  CircleDashed,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useRealtimeProjects } from '@/hooks/use-realtime-projects';
import {
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useUpdateProjectTask,
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

type ViewMode = 'cards' | 'kanban' | 'table';

const STATE_CONFIG: Record<ProjectState, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  '진행전': { label: '진행전', color: 'text-gray-500', icon: CircleDashed, bg: 'bg-gray-100 dark:bg-gray-800' },
  '진행중': { label: '진행중', color: 'text-blue-600', icon: Clock, bg: 'bg-blue-50 dark:bg-blue-950' },
  '완료': { label: '완료', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950' },
};

const KANBAN_COLUMNS: ProjectState[] = ['진행전', '진행중', '완료'];

function ProjectCard({
  project,
  tasks,
  users,
  onEdit,
  onDelete,
}: {
  project: Project;
  tasks: ProjectTask[];
  users: UserType[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const assignee = users.find((u) => u.id === project.assignee_id);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.state === '완료').length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const stateConfig = STATE_CONFIG[project.state];
  const StateIcon = stateConfig.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'group relative rounded-xl border bg-card p-4 transition-all duration-200',
        'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 shrink-0', stateConfig.color, stateConfig.bg)}>
              <StateIcon className="size-3 mr-0.5" />
              {stateConfig.label}
            </Badge>
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/50 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <h3 className="font-semibold text-sm truncate">{project.project_name}</h3>
        </div>

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
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-3.5 mr-2" />
              수정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="size-3.5 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress */}
      {totalTasks > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>{completedTasks}/{totalTasks} 업무</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progressPct === 100
                  ? 'bg-emerald-500'
                  : progressPct > 0
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        {assignee && (
          <span className="flex items-center gap-1">
            <User className="size-3" />
            {assignee.name}
          </span>
        )}
        {project.due_date && (
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {project.due_date}
          </span>
        )}
      </div>

      {/* Memo preview */}
      {project.memo && (
        <p className="mt-2 text-[11px] text-muted-foreground/70 line-clamp-2">
          {project.memo}
        </p>
      )}

      {/* Link to detail */}
      <a
        href={`/roadmap/${project.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`${project.project_name} 상세보기`}
      />
    </motion.div>
  );
}

function EmptyProjectForm({
  formData,
  setFormData,
  users,
}: {
  formData: Partial<Project>;
  setFormData: (data: Partial<Project>) => void;
  users: UserType[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="project_name">프로젝트 이름 *</Label>
        <Input
          id="project_name"
          value={formData.project_name ?? ''}
          onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
          placeholder="프로젝트 이름"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          value={formData.url ?? ''}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="https://..."
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="assignee">담당자</Label>
          <Select
            value={formData.assignee_id ?? 'none'}
            onValueChange={(v) => setFormData({ ...formData, assignee_id: v === 'none' ? null : v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">미지정</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="state">상태</Label>
          <Select
            value={formData.state ?? '진행전'}
            onValueChange={(v) => setFormData({ ...formData, state: v as ProjectState })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_COLUMNS.map((s) => (
                <SelectItem key={s} value={s}>{STATE_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start_date">시작일</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date ?? ''}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value || null })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="due_date">마감일</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date ?? ''}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="memo">메모</Label>
        <Textarea
          id="memo"
          value={formData.memo ?? ''}
          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
          placeholder="프로젝트에 대한 메모..."
          rows={3}
          className="mt-1"
        />
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  useRealtimeProjects();

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Project>>({});

  const { mutate: createProject, isPending: creating } = useCreateProject();
  const { mutate: updateProject, isPending: updating } = useUpdateProject();
  const { mutate: deleteProject } = useDeleteProject();
  const { mutate: updateTask } = useUpdateProjectTask();

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Project[];
    },
  });

  // Fetch all project tasks
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['projectTasks', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as ProjectTask[];
    },
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

  // Task map by project
  const tasksByProject = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();
    allTasks.forEach((t) => {
      const existing = map.get(t.project_id) || [];
      existing.push(t);
      map.set(t.project_id, existing);
    });
    return map;
  }, [allTasks]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (stateFilter) {
      filtered = filtered.filter((p) => p.state === stateFilter);
    }
    if (assigneeFilter) {
      filtered = filtered.filter((p) => p.assignee_id === assigneeFilter);
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.project_name.toLowerCase().includes(lower) ||
          (p.memo?.toLowerCase().includes(lower) ?? false)
      );
    }
    return filtered;
  }, [projects, stateFilter, assigneeFilter, searchText]);

  // Stats
  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.state === '진행중').length;
    const completed = projects.filter((p) => p.state === '완료').length;
    const notStarted = projects.filter((p) => p.state === '진행전').length;
    return { total, inProgress, completed, notStarted };
  }, [projects]);

  const openCreateDialog = () => {
    setEditingProject(null);
    setFormData({ state: '진행전' });
    setDialogOpen(true);
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setFormData(project);
    setDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.project_name?.trim()) return;
    if (editingProject) {
      updateProject({ id: editingProject.id, ...formData } as Parameters<typeof updateProject>[0]);
    } else {
      createProject(formData as Parameters<typeof createProject>[0]);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteProject(deletingId);
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const toggleExpand = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProjects(new Set(filteredProjects.map((p) => p.id)));
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
  };

  const handleTaskStateChange = (taskId: string, projectId: string, newState: ProjectState) => {
    updateTask({ id: taskId, project_id: projectId, state: newState });
  };

  const isLoading = projectsLoading || tasksLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">프로젝트 로드맵</h1>
          <p className="text-sm text-muted-foreground mt-1">
            진행중인 프로젝트와 하위 업무를 관리합니다.
          </p>
        </div>
        <Button onClick={openCreateDialog} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          새 프로젝트
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '전체', value: stats.total, color: 'text-foreground' },
          { label: '진행전', value: stats.notStarted, color: 'text-gray-500' },
          { label: '진행중', value: stats.inProgress, color: 'text-blue-600' },
          { label: '완료', value: stats.completed, color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="프로젝트 검색..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={stateFilter || 'all'} onValueChange={(v) => setStateFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {KANBAN_COLUMNS.map((s) => (
              <SelectItem key={s} value={s}>{STATE_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter || 'all'} onValueChange={(v) => setAssigneeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="담당자" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 담당자</SelectItem>
            {users.filter((u) => u.is_active).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {([
            { mode: 'cards' as ViewMode, icon: LayoutGrid, label: '카드' },
            { mode: 'kanban' as ViewMode, icon: Kanban, label: '칸반' },
            { mode: 'table' as ViewMode, icon: Table2, label: '테이블' },
          ]).map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-7 px-2.5 text-xs gap-1', viewMode === mode && 'shadow-sm')}
              onClick={() => setViewMode(mode)}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-sm">프로젝트를 불러오는 중...</span>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FolderOpen className="size-10 text-muted-foreground/30" />
          <p className="text-sm">프로젝트가 없습니다.</p>
          <Button variant="outline" size="sm" onClick={openCreateDialog}>
            <Plus className="size-4 mr-1" />
            첫 프로젝트 만들기
          </Button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={tasksByProject.get(project.id) || []}
                users={users}
                onEdit={() => openEditDialog(project)}
                onDelete={() => openDeleteDialog(project.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.map((state) => {
            const stateProjects = filteredProjects.filter((p) => p.state === state);
            const config = STATE_CONFIG[state];
            const StateIcon = config.icon;
            return (
              <div key={state} className="rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <StateIcon className={cn('size-4', config.color)} />
                  <h3 className={cn('text-sm font-semibold', config.color)}>{config.label}</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
                    {stateProjects.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {stateProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        tasks={tasksByProject.get(project.id) || []}
                        users={users}
                        onEdit={() => openEditDialog(project)}
                        onDelete={() => openDeleteDialog(project.id)}
                      />
                    ))}
                  </AnimatePresence>
                  {stateProjects.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 text-center py-6">
                      프로젝트 없음
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-xl border bg-card overflow-auto">
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-muted/20">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={expandAll}>
              전체 펼치기
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={collapseAll}>
              전체 접기
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[40px]"></th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">프로젝트</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">상태</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">담당자</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">진행률</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">마감일</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">메모</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const tasks = tasksByProject.get(project.id) || [];
                const completed = tasks.filter((t) => t.state === '완료').length;
                const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
                const assignee = users.find((u) => u.id === project.assignee_id);
                const config = STATE_CONFIG[project.state];
                const StateIcon = config.icon;
                const isExpanded = expandedProjects.has(project.id);

                return (
                  <React.Fragment key={project.id}>
                    <tr
                      className={cn(
                        'border-b hover:bg-muted/20 transition-colors cursor-pointer',
                        isExpanded && 'bg-muted/10'
                      )}
                      onClick={() => toggleExpand(project.id)}
                    >
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="size-6" onClick={(e) => { e.stopPropagation(); toggleExpand(project.id); }}>
                          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{project.project_name}</span>
                          {tasks.length > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                              {tasks.length}
                            </Badge>
                          )}
                          {project.url && (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground/40 hover:text-primary"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={cn('text-[10px]', config.color, config.bg)}>
                          <StateIcon className="size-3 mr-0.5" />
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{assignee?.name ?? '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground">{completed}/{tasks.length}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{project.due_date ?? '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{project.memo ?? '-'}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(project)}>
                              <Pencil className="size-3.5 mr-2" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteDialog(project.id)} className="text-destructive">
                              <Trash2 className="size-3.5 mr-2" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                    {isExpanded && tasks.length > 0 && tasks.map((task, idx) => {
                      const taskConfig = STATE_CONFIG[task.state];
                      const TaskIcon = taskConfig.icon;
                      const taskAssignee = users.find((u) => u.id === task.assignee_id);
                      return (
                        <tr key={task.id} className="border-b last:border-b-0 bg-muted/5 hover:bg-muted/15 transition-colors">
                          <td className="px-4 py-2"></td>
                          <td className="px-4 py-2 pl-10">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground/50 w-4 shrink-0">{idx + 1}</span>
                              <span className={cn('text-[13px]', task.state === '완료' && 'line-through text-muted-foreground')}>
                                {task.title}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={task.state}
                              onValueChange={(v) => handleTaskStateChange(task.id, project.id, v as ProjectState)}
                            >
                              <SelectTrigger className={cn('w-[85px] h-7 text-[11px] border-0 bg-transparent px-1.5', taskConfig.color)}>
                                <div className="flex items-center gap-1">
                                  <TaskIcon className="size-3" />
                                  <span>{taskConfig.label}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent position="popper" className="min-w-[100px]">
                                {KANBAN_COLUMNS.map((s) => {
                                  const sc = STATE_CONFIG[s];
                                  const SI = sc.icon;
                                  return (
                                    <SelectItem key={s} value={s}>
                                      <div className="flex items-center gap-1.5">
                                        <SI className={cn('size-3', sc.color)} />
                                        {sc.label}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{taskAssignee?.name ?? '-'}</td>
                          <td className="px-4 py-2"></td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{task.due_date ?? '-'}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs max-w-[200px] truncate">{task.memo ?? '-'}</td>
                          <td className="px-4 py-2"></td>
                        </tr>
                      );
                    })}
                    {isExpanded && tasks.length === 0 && (
                      <tr className="border-b bg-muted/5">
                        <td className="px-4 py-2"></td>
                        <td colSpan={7} className="px-4 py-3 pl-10 text-xs text-muted-foreground/50">
                          하위 업무가 없습니다.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProject ? '프로젝트 수정' : '새 프로젝트'}</DialogTitle>
          </DialogHeader>
          <EmptyProjectForm formData={formData} setFormData={setFormData} users={users} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.project_name?.trim() || creating || updating}
            >
              {editingProject ? '저장' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>프로젝트 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            이 프로젝트와 모든 하위 업무가 삭제됩니다. 계속하시겠습니까?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
