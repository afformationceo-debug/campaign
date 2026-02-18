'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  X,
  Users,
  CalendarDays,
  Check,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useRealtimeProjects } from '@/hooks/use-realtime-projects';
import {
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useCreateProjectTask,
  useUpdateProjectTask,
  useDeleteProjectTask,
  useReorderProjects,
  useReorderTasks,
} from '@/hooks/use-project-mutations';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Project, ProjectTask, ProjectState, User as UserType } from '@/lib/types/database';

type ViewMode = 'cards' | 'kanban' | 'table';

const STATE_CONFIG: Record<ProjectState, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  '진행전': { label: '진행전', color: 'text-gray-500', icon: CircleDashed, bg: 'bg-gray-100 dark:bg-gray-800' },
  '진행중': { label: '진행중', color: 'text-blue-600', icon: Clock, bg: 'bg-blue-50 dark:bg-blue-950' },
  '완료': { label: '완료', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950' },
};

const KANBAN_COLUMNS: ProjectState[] = ['진행전', '진행중', '완료'];

// ─── Inline Editable Cell ─────────────────────────────────
interface EditingCell {
  id: string;
  field: string;
  type: 'project' | 'task';
  projectId?: string;
}

function InlineTextCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isEditing, value]);

  if (!isEditing) {
    return (
      <span
        className={cn(
          'cursor-text rounded px-1 -mx-1 hover:bg-accent/50 transition-colors truncate block min-h-[20px]',
          !value && 'text-muted-foreground/30',
          className,
        )}
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      >
        {value || placeholder || '-'}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className={cn(
        'w-full bg-background border border-primary/40 rounded px-1.5 py-0.5 text-sm outline-none ring-1 ring-primary/20 -mx-1',
        className,
      )}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(draft); }
        if (e.key === 'Escape') { onSave(value); }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function InlineDateCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
}: {
  value: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing]);

  if (!isEditing) {
    return (
      <span
        className="cursor-text rounded px-1 -mx-1 hover:bg-accent/50 transition-colors text-xs min-h-[20px] block"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      >
        {value || '-'}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      className="w-full bg-background border border-primary/40 rounded px-1 py-0.5 text-xs outline-none ring-1 ring-primary/20 -mx-1"
      value={value ?? ''}
      onChange={(e) => onSave(e.target.value || null)}
      onBlur={() => onSave(value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function InlineMemoCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
}: {
  value: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (isEditing) {
      setDraft(value ?? '');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isEditing, value]);

  if (!isEditing) {
    return (
      <span
        className="cursor-text rounded px-1 -mx-1 hover:bg-accent/50 transition-colors text-xs truncate block min-h-[20px]"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
        title={value ?? ''}
      >
        {value || '-'}
      </span>
    );
  }

  return (
    <textarea
      ref={inputRef}
      className="w-[200px] bg-background border border-primary/40 rounded px-1.5 py-1 text-xs outline-none ring-1 ring-primary/20 -mx-1 resize-none"
      rows={3}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft || null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onSave(value);
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ─── Card View Component ──────────────────────────────────
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
              <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <h3 className="font-semibold text-sm truncate">{project.project_name}</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="size-3.5 mr-2" />수정</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="size-3.5 mr-2" />삭제</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {totalTasks > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>{completedTasks}/{totalTasks} 업무</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-gray-300')}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        {assignee && (<span className="flex items-center gap-1"><User className="size-3" />{assignee.name}</span>)}
        {project.due_date && (<span className="flex items-center gap-1"><Calendar className="size-3" />{project.due_date}</span>)}
      </div>
      {project.memo && (<p className="mt-2 text-[11px] text-muted-foreground/70 line-clamp-2">{project.memo}</p>)}
      <a href={`/roadmap/${project.id}`} className="absolute inset-0 rounded-xl" aria-label={`${project.project_name} 상세보기`} />
    </motion.div>
  );
}

// ─── Create/Edit Form ─────────────────────────────────────
function EmptyProjectForm({ formData, setFormData, users }: { formData: Partial<Project>; setFormData: (data: Partial<Project>) => void; users: UserType[] }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="project_name">프로젝트 이름 *</Label>
        <Input id="project_name" value={formData.project_name ?? ''} onChange={(e) => setFormData({ ...formData, project_name: e.target.value })} placeholder="프로젝트 이름" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="url">URL</Label>
        <Input id="url" value={formData.url ?? ''} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://..." className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="assignee">담당자</Label>
          <Select value={formData.assignee_id ?? 'none'} onValueChange={(v) => setFormData({ ...formData, assignee_id: v === 'none' ? null : v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">미지정</SelectItem>
              {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="state">상태</Label>
          <Select value={formData.state ?? '진행전'} onValueChange={(v) => setFormData({ ...formData, state: v as ProjectState })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{KANBAN_COLUMNS.map((s) => (<SelectItem key={s} value={s}>{STATE_CONFIG[s].label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start_date">시작일</Label>
          <Input id="start_date" type="date" value={formData.start_date ?? ''} onChange={(e) => setFormData({ ...formData, start_date: e.target.value || null })} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="due_date">마감일</Label>
          <Input id="due_date" type="date" value={formData.due_date ?? ''} onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })} className="mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="memo">메모</Label>
        <Textarea id="memo" value={formData.memo ?? ''} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} placeholder="프로젝트에 대한 메모..." rows={3} className="mt-1" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
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

  // Inline editing state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  // Selection state for bulk actions
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkAssigneeOpen, setBulkAssigneeOpen] = useState(false);
  const [bulkDateOpen, setBulkDateOpen] = useState(false);
  const [bulkStartDateOpen, setBulkStartDateOpen] = useState(false);

  const { mutate: createProject, isPending: creating } = useCreateProject();
  const { mutate: updateProject, isPending: updating } = useUpdateProject();
  const { mutate: deleteProject } = useDeleteProject();
  const { mutate: updateTask } = useUpdateProjectTask();
  const { mutate: createTask } = useCreateProjectTask();
  const { mutate: deleteTask } = useDeleteProjectTask();
  const { mutate: reorderProjects } = useReorderProjects();
  const { mutate: reorderTasks } = useReorderTasks();

  // ─── Drag and drop state ────────────────────────────────
  const [dragItem, setDragItem] = useState<{ type: 'project' | 'task'; id: string; projectId?: string } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'project' | 'task'; id: string; projectId?: string } | null>(null);

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Project[];
    },
  });

  // Fetch all project tasks
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['projectTasks', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_tasks').select('*').order('sort_order', { ascending: true });
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

  const tasksByProject = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();
    allTasks.forEach((t) => {
      const existing = map.get(t.project_id) || [];
      existing.push(t);
      map.set(t.project_id, existing);
    });
    return map;
  }, [allTasks]);

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (stateFilter) filtered = filtered.filter((p) => p.state === stateFilter);
    if (assigneeFilter) filtered = filtered.filter((p) => p.assignee_id === assigneeFilter);
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((p) => p.project_name.toLowerCase().includes(lower) || (p.memo?.toLowerCase().includes(lower) ?? false));
    }
    return filtered;
  }, [projects, stateFilter, assigneeFilter, searchText]);

  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.state === '진행중').length;
    const completed = projects.filter((p) => p.state === '완료').length;
    const notStarted = projects.filter((p) => p.state === '진행전').length;
    return { total, inProgress, completed, notStarted };
  }, [projects]);

  // ─── Dialog handlers ──────────────────────────────────
  const openCreateDialog = () => { setEditingProject(null); setFormData({ state: '진행전' }); setDialogOpen(true); };
  const openEditDialog = (project: Project) => { setEditingProject(project); setFormData(project); setDialogOpen(true); };
  const openDeleteDialog = (id: string) => { setDeletingId(id); setDeleteDialogOpen(true); };

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
    if (deletingId) deleteProject(deletingId);
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  // ─── Expand/Collapse ─────────────────────────────────
  const toggleExpand = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const expandAll = () => setExpandedProjects(new Set(filteredProjects.map((p) => p.id)));
  const collapseAll = () => setExpandedProjects(new Set());

  // ─── Inline editing handlers ──────────────────────────
  const startEdit = useCallback((id: string, field: string, type: 'project' | 'task', projectId?: string) => {
    setEditingCell({ id, field, type, projectId });
  }, []);

  const isEditing = useCallback((id: string, field: string) => {
    return editingCell?.id === id && editingCell?.field === field;
  }, [editingCell]);

  const saveProjectField = useCallback((projectId: string, field: string, value: unknown) => {
    setEditingCell(null);
    updateProject({ id: projectId, [field]: value } as Parameters<typeof updateProject>[0]);
  }, [updateProject]);

  const saveTaskField = useCallback((taskId: string, projectId: string, field: string, value: unknown) => {
    setEditingCell(null);
    updateTask({ id: taskId, project_id: projectId, [field]: value } as Parameters<typeof updateTask>[0]);
  }, [updateTask]);

  // ─── Selection handlers ───────────────────────────────
  const totalSelected = selectedProjects.size + selectedTasks.size;

  const toggleProjectSelection = (id: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      const isAdding = !next.has(id);
      if (isAdding) next.add(id); else next.delete(id);
      // Cascade to sub-tasks
      const tasks = tasksByProject.get(id) || [];
      setSelectedTasks((prevTasks) => {
        const nextTasks = new Set(prevTasks);
        tasks.forEach((t) => { if (isAdding) nextTasks.add(t.id); else nextTasks.delete(t.id); });
        return nextTasks;
      });
      return next;
    });
  };

  const toggleTaskSelection = (id: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allProjectIds = filteredProjects.map((p) => p.id);
    const allTaskIds: string[] = [];
    filteredProjects.forEach((p) => {
      if (expandedProjects.has(p.id)) {
        (tasksByProject.get(p.id) || []).forEach((t) => allTaskIds.push(t.id));
      }
    });
    setSelectedProjects(new Set(allProjectIds));
    setSelectedTasks(new Set(allTaskIds));
  };

  const clearSelection = () => {
    setSelectedProjects(new Set());
    setSelectedTasks(new Set());
  };

  const isAllSelected = filteredProjects.length > 0 && filteredProjects.every((p) => selectedProjects.has(p.id));

  // ─── Bulk actions ─────────────────────────────────────
  const bulkUpdateAssignee = (assigneeId: string | null) => {
    selectedProjects.forEach((id) => {
      updateProject({ id, assignee_id: assigneeId } as Parameters<typeof updateProject>[0]);
    });
    selectedTasks.forEach((taskId) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (task) updateTask({ id: taskId, project_id: task.project_id, assignee_id: assigneeId });
    });
    clearSelection();
    setBulkAssigneeOpen(false);
  };

  const bulkUpdateDueDate = (date: string | null) => {
    selectedProjects.forEach((id) => {
      updateProject({ id, due_date: date } as Parameters<typeof updateProject>[0]);
    });
    selectedTasks.forEach((taskId) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (task) updateTask({ id: taskId, project_id: task.project_id, due_date: date });
    });
    clearSelection();
    setBulkDateOpen(false);
  };

  const bulkUpdateStartDate = (date: string | null) => {
    selectedProjects.forEach((id) => {
      updateProject({ id, start_date: date } as Parameters<typeof updateProject>[0]);
    });
    // Note: project_tasks don't have start_date field, only projects do
    clearSelection();
    setBulkStartDateOpen(false);
  };

  const bulkUpdateState = (state: ProjectState) => {
    selectedProjects.forEach((id) => {
      updateProject({ id, state } as Parameters<typeof updateProject>[0]);
    });
    selectedTasks.forEach((taskId) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (task) updateTask({ id: taskId, project_id: task.project_id, state });
    });
    clearSelection();
  };

  // ─── Drag handlers ──────────────────────────────────────
  const handleProjectDragStart = useCallback((projectId: string) => {
    setDragItem({ type: 'project', id: projectId });
  }, []);

  const handleProjectDragOver = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    if (dragItem?.type === 'project' && dragItem.id !== projectId) {
      setDragOverItem({ type: 'project', id: projectId });
    }
  }, [dragItem]);

  const handleProjectDrop = useCallback(() => {
    if (!dragItem || !dragOverItem || dragItem.type !== 'project' || dragOverItem.type !== 'project') {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }
    const fromIdx = filteredProjects.findIndex((p) => p.id === dragItem.id);
    const toIdx = filteredProjects.findIndex((p) => p.id === dragOverItem.id);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }
    const reordered = [...filteredProjects];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updates = reordered.map((p, idx) => ({ id: p.id, sort_order: idx }));
    reorderProjects(updates);
    setDragItem(null);
    setDragOverItem(null);
  }, [dragItem, dragOverItem, filteredProjects, reorderProjects]);

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
    reorderTasks({ projectId, items: updates });
    setDragItem(null);
    setDragOverItem(null);
  }, [dragItem, dragOverItem, tasksByProject, reorderTasks]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDragOverItem(null);
  }, []);

  const isLoading = projectsLoading || tasksLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">프로젝트 로드맵</h1>
          <p className="text-xs text-muted-foreground mt-0.5">진행중인 프로젝트와 하위 업무를 관리합니다.</p>
        </div>
        <Button onClick={openCreateDialog} size="sm" className="gap-1.5 h-8 text-xs">
          <Plus className="size-3.5" />
          새 프로젝트
        </Button>
      </div>

      {/* Stats - more compact */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '전체', value: stats.total, color: 'text-foreground', border: 'border-border' },
          { label: '진행전', value: stats.notStarted, color: 'text-gray-500', border: 'border-gray-200 dark:border-gray-700' },
          { label: '진행중', value: stats.inProgress, color: 'text-blue-600', border: 'border-blue-200 dark:border-blue-800' },
          { label: '완료', value: stats.completed, color: 'text-emerald-600', border: 'border-emerald-200 dark:border-emerald-800' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-lg border bg-card px-3 py-2', s.border)}>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={cn('text-lg font-bold leading-tight', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="프로젝트 검색..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={stateFilter || 'all'} onValueChange={(v) => setStateFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>{[<SelectItem key="all" value="all">전체 상태</SelectItem>, ...KANBAN_COLUMNS.map((s) => <SelectItem key={s} value={s}>{STATE_CONFIG[s].label}</SelectItem>)]}</SelectContent>
        </Select>
        <Select value={assigneeFilter || 'all'} onValueChange={(v) => setAssigneeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="담당자" /></SelectTrigger>
          <SelectContent>{[<SelectItem key="all" value="all">전체 담당자</SelectItem>, ...users.filter((u) => u.is_active).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)]}</SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {([
            { mode: 'cards' as ViewMode, icon: LayoutGrid, label: '카드' },
            { mode: 'kanban' as ViewMode, icon: Kanban, label: '칸반' },
            { mode: 'table' as ViewMode, icon: Table2, label: '테이블' },
          ]).map(({ mode, icon: Icon, label }) => (
            <Button key={mode} variant={viewMode === mode ? 'secondary' : 'ghost'} size="sm" className={cn('h-7 px-2 text-[11px] gap-1', viewMode === mode && 'shadow-sm')} onClick={() => setViewMode(mode)}>
              <Icon className="size-3" /><span className="hidden sm:inline">{label}</span>
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
          <Button variant="outline" size="sm" onClick={openCreateDialog}><Plus className="size-4 mr-1" />첫 프로젝트 만들기</Button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} tasks={tasksByProject.get(project.id) || []} users={users} onEdit={() => openEditDialog(project)} onDelete={() => openDeleteDialog(project.id)} />
            ))}
          </AnimatePresence>
        </div>
      ) : viewMode === 'kanban' ? (
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
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">{stateProjects.length}</Badge>
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {stateProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} tasks={tasksByProject.get(project.id) || []} users={users} onEdit={() => openEditDialog(project)} onDelete={() => openDeleteDialog(project.id)} />
                    ))}
                  </AnimatePresence>
                  {stateProjects.length === 0 && <p className="text-xs text-muted-foreground/50 text-center py-6">프로젝트 없음</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ═══════════════ TABLE VIEW ═══════════════ */
        <div className="rounded-xl border bg-card overflow-auto">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/20">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{filteredProjects.length}개 프로젝트</span>
              <span className="text-muted-foreground/30">|</span>
              <span>{allTasks.length}개 하위업무</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={expandAll}>전체 펼치기</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={collapseAll}>전체 접기</Button>
            </div>
          </div>

          <table className="w-full table-fixed text-[12px] min-w-[860px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="w-[20px] px-1 py-1.5"></th>
                <th className="w-[32px] px-2 py-1.5">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => { if (checked) selectAll(); else clearSelection(); }}
                    className="size-3.5"
                  />
                </th>
                <th className="w-[24px] px-1 py-1.5"></th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">프로젝트</th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-[76px]">상태</th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-[76px]">담당자</th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-[68px]">진행률</th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-[86px]">시작일</th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-[86px]">마감일</th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-[120px]">메모</th>
                <th className="w-[32px] px-1 py-1.5"></th>
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
                const isSelected = selectedProjects.has(project.id);

                return (
                  <React.Fragment key={project.id}>
                    {/* ── Project Row ── */}
                    <tr
                      draggable
                      onDragStart={() => handleProjectDragStart(project.id)}
                      onDragOver={(e) => handleProjectDragOver(e, project.id)}
                      onDrop={handleProjectDrop}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'border-b hover:bg-accent/30 transition-colors group/row whitespace-nowrap',
                        isExpanded && 'bg-accent/10',
                        isSelected && 'bg-primary/5',
                        dragItem?.type === 'project' && dragItem.id === project.id && 'opacity-40',
                        dragOverItem?.type === 'project' && dragOverItem.id === project.id && 'border-t-2 border-t-primary',
                      )}
                    >
                      {/* Drag handle */}
                      <td className="px-1 py-1 cursor-grab active:cursor-grabbing">
                        <GripVertical className="size-3.5 text-muted-foreground/30 group-hover/row:text-muted-foreground/60 transition-colors" />
                      </td>
                      {/* Checkbox */}
                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleProjectSelection(project.id)}
                          className="size-3.5"
                        />
                      </td>
                      {/* Expand */}
                      <td className="px-1 py-1">
                        <button
                          className="size-5 flex items-center justify-center rounded hover:bg-accent"
                          onClick={() => toggleExpand(project.id)}
                        >
                          {isExpanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                        </button>
                      </td>
                      {/* Name */}
                      <td className="px-2 py-1 max-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="min-w-0 flex-1">
                                <InlineTextCell
                                  value={project.project_name}
                                  isEditing={isEditing(project.id, 'project_name')}
                                  onStartEdit={() => startEdit(project.id, 'project_name', 'project')}
                                  onSave={(v) => saveProjectField(project.id, 'project_name', v)}
                                  className="font-semibold text-[12px]"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[300px]">
                              <p className="text-xs font-medium">{project.project_name}</p>
                            </TooltipContent>
                          </Tooltip>
                          {tasks.length > 0 && (
                            <span className="text-[9px] text-muted-foreground/50 bg-muted rounded px-1 py-0 shrink-0">{tasks.length}</span>
                          )}
                          {project.url && (
                            <a href={project.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground/30 hover:text-primary shrink-0">
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      {/* State */}
                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <Select value={project.state} onValueChange={(v) => saveProjectField(project.id, 'state', v)}>
                          <SelectTrigger className={cn('h-6 w-[75px] text-[11px] border-0 bg-transparent px-1', config.color)}>
                            <div className="flex items-center gap-1">
                              <StateIcon className="size-3" />
                              <span>{config.label}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent position="popper" className="min-w-[100px]">
                            {KANBAN_COLUMNS.map((s) => {
                              const sc = STATE_CONFIG[s]; const SI = sc.icon;
                              return (<SelectItem key={s} value={s}><div className="flex items-center gap-1.5"><SI className={cn('size-3', sc.color)} />{sc.label}</div></SelectItem>);
                            })}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Assignee */}
                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <Select value={project.assignee_id ?? 'none'} onValueChange={(v) => saveProjectField(project.id, 'assignee_id', v === 'none' ? null : v)}>
                          <SelectTrigger className="h-6 w-[72px] text-[11px] border-0 bg-transparent px-1 text-muted-foreground">
                            <span className="truncate">{assignee?.name ?? '-'}</span>
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectItem value="none">미지정</SelectItem>
                            {users.filter((u) => u.is_active).map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Progress */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300')} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{completed}/{tasks.length}</span>
                        </div>
                      </td>
                      {/* Start Date */}
                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineDateCell
                          value={project.start_date}
                          isEditing={isEditing(project.id, 'start_date')}
                          onStartEdit={() => startEdit(project.id, 'start_date', 'project')}
                          onSave={(v) => saveProjectField(project.id, 'start_date', v)}
                        />
                      </td>
                      {/* Due Date */}
                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineDateCell
                          value={project.due_date}
                          isEditing={isEditing(project.id, 'due_date')}
                          onStartEdit={() => startEdit(project.id, 'due_date', 'project')}
                          onSave={(v) => saveProjectField(project.id, 'due_date', v)}
                        />
                      </td>
                      {/* Memo */}
                      <td className="px-2 py-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <InlineMemoCell
                          value={project.memo}
                          isEditing={isEditing(project.id, 'memo')}
                          onStartEdit={() => startEdit(project.id, 'memo', 'project')}
                          onSave={(v) => saveProjectField(project.id, 'memo', v)}
                        />
                      </td>
                      {/* Actions */}
                      <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="size-6 flex items-center justify-center rounded hover:bg-accent opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(project)}><Pencil className="size-3.5 mr-2" />수정</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteDialog(project.id)} className="text-destructive"><Trash2 className="size-3.5 mr-2" />삭제</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>

                    {/* ── Sub-task Rows ── */}
                    {isExpanded && tasks.length > 0 && tasks.map((task, idx) => {
                      const taskConfig = STATE_CONFIG[task.state];
                      const TaskIcon = taskConfig.icon;
                      const taskAssignee = users.find((u) => u.id === task.assignee_id);
                      const isTaskSelected = selectedTasks.has(task.id);

                      return (
                        <tr
                          key={task.id}
                          draggable
                          onDragStart={() => handleTaskDragStart(task.id, project.id)}
                          onDragOver={(e) => handleTaskDragOver(e, task.id, project.id)}
                          onDrop={() => handleTaskDrop(project.id)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            'border-b border-border/30 hover:bg-accent/20 transition-colors group/task whitespace-nowrap',
                            'bg-muted/5',
                            isTaskSelected && 'bg-primary/5',
                            dragItem?.type === 'task' && dragItem.id === task.id && 'opacity-40',
                            dragOverItem?.type === 'task' && dragOverItem.id === task.id && 'border-t-2 border-t-primary',
                          )}
                        >
                          {/* Drag handle */}
                          <td className="px-1 py-0.5 cursor-grab active:cursor-grabbing">
                            <GripVertical className="size-3 text-muted-foreground/20 group-hover/task:text-muted-foreground/50 transition-colors" />
                          </td>
                          {/* Checkbox */}
                          <td className="px-2 py-0.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isTaskSelected}
                              onCheckedChange={() => toggleTaskSelection(task.id)}
                              className="size-3"
                            />
                          </td>
                          {/* Spacer */}
                          <td className="px-1 py-0.5"></td>
                          {/* Title */}
                          <td className="px-2 py-0.5 pl-8 max-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[9px] text-muted-foreground/40 w-3.5 shrink-0 text-right">{idx + 1}</span>
                              <div className="w-px h-3 bg-border/60 shrink-0" />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="min-w-0 flex-1">
                                    <InlineTextCell
                                      value={task.title}
                                      isEditing={isEditing(task.id, 'title')}
                                      onStartEdit={() => startEdit(task.id, 'title', 'task', project.id)}
                                      onSave={(v) => saveTaskField(task.id, project.id, 'title', v)}
                                      className={cn('text-[11px]', task.state === '완료' && 'line-through text-muted-foreground/60')}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[300px]">
                                  <p className="text-xs">{task.title}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                          {/* State */}
                          <td className="px-2 py-0.5" onClick={(e) => e.stopPropagation()}>
                            <Select value={task.state} onValueChange={(v) => saveTaskField(task.id, project.id, 'state', v)}>
                              <SelectTrigger className={cn('h-5 w-[70px] text-[10px] border-0 bg-transparent px-1', taskConfig.color)}>
                                <div className="flex items-center gap-0.5">
                                  <TaskIcon className="size-2.5" />
                                  <span>{taskConfig.label}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent position="popper" className="min-w-[100px]">
                                {KANBAN_COLUMNS.map((s) => {
                                  const sc = STATE_CONFIG[s]; const SI = sc.icon;
                                  return (<SelectItem key={s} value={s}><div className="flex items-center gap-1.5"><SI className={cn('size-3', sc.color)} />{sc.label}</div></SelectItem>);
                                })}
                              </SelectContent>
                            </Select>
                          </td>
                          {/* Assignee */}
                          <td className="px-2 py-0.5" onClick={(e) => e.stopPropagation()}>
                            <Select value={task.assignee_id ?? 'none'} onValueChange={(v) => saveTaskField(task.id, project.id, 'assignee_id', v === 'none' ? null : v)}>
                              <SelectTrigger className="h-5 w-[68px] text-[10px] border-0 bg-transparent px-1 text-muted-foreground">
                                <span className="truncate">{taskAssignee?.name ?? '-'}</span>
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectItem value="none">미지정</SelectItem>
                                {users.filter((u) => u.is_active).map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </td>
                          {/* Progress - empty for tasks */}
                          <td className="px-2 py-0.5"></td>
                          {/* Start Date - empty for tasks */}
                          <td className="px-2 py-0.5"></td>
                          {/* Due Date */}
                          <td className="px-2 py-0.5" onClick={(e) => e.stopPropagation()}>
                            <InlineDateCell
                              value={task.due_date}
                              isEditing={isEditing(task.id, 'due_date')}
                              onStartEdit={() => startEdit(task.id, 'due_date', 'task', project.id)}
                              onSave={(v) => saveTaskField(task.id, project.id, 'due_date', v)}
                            />
                          </td>
                          {/* Memo */}
                          <td className="px-2 py-0.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <InlineMemoCell
                              value={task.memo}
                              isEditing={isEditing(task.id, 'memo')}
                              onStartEdit={() => startEdit(task.id, 'memo', 'task', project.id)}
                              onSave={(v) => saveTaskField(task.id, project.id, 'memo', v)}
                            />
                          </td>
                          {/* Delete */}
                          <td className="px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="size-5 flex items-center justify-center rounded hover:bg-destructive/10 opacity-0 group-hover/task:opacity-100 transition-opacity"
                              onClick={() => deleteTask({ id: task.id, project_id: project.id })}
                            >
                              <Trash2 className="size-3 text-muted-foreground/50 hover:text-destructive" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Empty state for no tasks */}
                    {isExpanded && tasks.length === 0 && (
                      <tr className="border-b border-border/30 bg-muted/5">
                        <td className="px-1 py-2"></td>
                        <td className="px-2 py-2"></td>
                        <td className="px-1 py-2"></td>
                        <td className="px-2 py-2 pl-8" colSpan={8}>
                          <span className="text-[11px] text-muted-foreground/40 italic">하위 업무가 없습니다. 아래에서 추가해보세요.</span>
                        </td>
                      </tr>
                    )}
                    {/* Add sub-task row */}
                    {isExpanded && (
                      <tr className="border-b border-border/30 bg-muted/5">
                        <td className="px-1 py-0.5"></td>
                        <td className="px-2 py-0.5"></td>
                        <td className="px-1 py-0.5"></td>
                        <td className="px-2 py-0.5 pl-8" colSpan={8}>
                          <div className="flex items-center gap-1.5">
                            <Plus className="size-3 text-muted-foreground/30 shrink-0" />
                            <input
                              className="w-full bg-transparent text-[11px] text-muted-foreground/60 placeholder:text-muted-foreground/30 outline-none py-0.5"
                              placeholder="새 하위업무 추가..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.currentTarget;
                                  const title = input.value.trim();
                                  if (title) {
                                    createTask({ project_id: project.id, title, state: '진행전' as ProjectState, sort_order: tasks.length });
                                    input.value = '';
                                  }
                                }
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {/* ── Inline Add Project Row ── */}
              <tr className="border-b border-border/30 hover:bg-accent/10">
                <td className="px-1 py-1.5"></td>
                <td className="px-2 py-1.5"></td>
                <td className="px-1 py-1.5">
                  <Plus className="size-3.5 text-muted-foreground/30" />
                </td>
                <td className="px-2 py-1.5" colSpan={8}>
                  <input
                    className="w-full bg-transparent text-[12px] text-muted-foreground/60 placeholder:text-muted-foreground/30 outline-none py-0.5 font-medium"
                    placeholder="새 프로젝트 추가... (Enter로 생성)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget;
                        const name = input.value.trim();
                        if (name) {
                          createProject({ project_name: name, state: '진행전' as ProjectState, sort_order: filteredProjects.length });
                          input.value = '';
                        }
                      }
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════ BULK ACTION BAR ═══════════════ */}
      <AnimatePresence>
        {totalSelected > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 rounded-xl border bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/20 px-4 py-2.5">
              <div className="flex items-center gap-2 pr-3 border-r">
                <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Check className="size-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">{totalSelected}개 선택됨</span>
              </div>

              {/* Bulk Assignee */}
              <div className="relative">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => { setBulkAssigneeOpen(!bulkAssigneeOpen); setBulkDateOpen(false); setBulkStartDateOpen(false); }}>
                  <Users className="size-3.5" />
                  담당자 변경
                </Button>
                {bulkAssigneeOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-[160px] rounded-lg border bg-popover shadow-lg p-1">
                    <button className="w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-accent" onClick={() => bulkUpdateAssignee(null)}>미지정</button>
                    {users.filter((u) => u.is_active).map((u) => (
                      <button key={u.id} className="w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-accent" onClick={() => bulkUpdateAssignee(u.id)}>{u.name}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk Start Date */}
              <div className="relative">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => { setBulkStartDateOpen(!bulkStartDateOpen); setBulkDateOpen(false); setBulkAssigneeOpen(false); }}>
                  <Calendar className="size-3.5" />
                  시작일 변경
                </Button>
                {bulkStartDateOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-[180px] rounded-lg border bg-popover shadow-lg p-2">
                    <input
                      type="date"
                      className="w-full border rounded px-2 py-1.5 text-xs bg-background"
                      onChange={(e) => bulkUpdateStartDate(e.target.value || null)}
                    />
                  </div>
                )}
              </div>

              {/* Bulk Due Date */}
              <div className="relative">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => { setBulkDateOpen(!bulkDateOpen); setBulkStartDateOpen(false); setBulkAssigneeOpen(false); }}>
                  <CalendarDays className="size-3.5" />
                  마감일 변경
                </Button>
                {bulkDateOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-[180px] rounded-lg border bg-popover shadow-lg p-2">
                    <input
                      type="date"
                      className="w-full border rounded px-2 py-1.5 text-xs bg-background"
                      onChange={(e) => bulkUpdateDueDate(e.target.value || null)}
                    />
                  </div>
                )}
              </div>

              {/* Bulk State */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                    <Clock className="size-3.5" />
                    상태 변경
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {KANBAN_COLUMNS.map((s) => {
                    const sc = STATE_CONFIG[s]; const SI = sc.icon;
                    return (
                      <DropdownMenuItem key={s} onClick={() => bulkUpdateState(s)}>
                        <SI className={cn('size-3.5 mr-2', sc.color)} />{sc.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Bulk Delete */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  if (window.confirm(`${totalSelected}개 항목을 삭제하시겠습니까?`)) {
                    selectedProjects.forEach((id) => deleteProject(id));
                    selectedTasks.forEach((taskId) => {
                      const task = allTasks.find((t) => t.id === taskId);
                      if (task) deleteTask({ id: taskId, project_id: task.project_id });
                    });
                    clearSelection();
                  }
                }}
              >
                <Trash2 className="size-3.5" />
                삭제
              </Button>

              <div className="pl-2 border-l">
                <Button variant="ghost" size="icon" className="size-7" onClick={clearSelection}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingProject ? '프로젝트 수정' : '새 프로젝트'}</DialogTitle></DialogHeader>
          <EmptyProjectForm formData={formData} setFormData={setFormData} users={users} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={!formData.project_name?.trim() || creating || updating}>{editingProject ? '저장' : '생성'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>프로젝트 삭제</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">이 프로젝트와 모든 하위 업무가 삭제됩니다. 계속하시겠습니까?</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
