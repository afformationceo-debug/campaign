'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Save, X, ExternalLink, FileText, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useCreateWorkflowTask, useUpdateWorkflowTask, useDeleteWorkflowTask } from '@/hooks/use-workflow-mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { WorkflowTask, WorkflowSection } from '@/lib/types/database';

const supabase = createClient();

const SECTIONS: WorkflowSection[] = ['cms세팅', '온보딩', '인플루언서', '일반고객 CS 대행'];
const SECTION_STYLES: Record<WorkflowSection, { text: string; bg: string; border: string }> = {
  'cms세팅': { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  '온보딩': { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  '인플루언서': { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  '일반고객 CS 대행': { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

interface EditingTask {
  id: string;
  task_name: string;
  manual_text: string;
  manual_url: string;
}

export function WorkflowTaskManager() {
  const isAdmin = useIsAdmin();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newSection, setNewSection] = useState<WorkflowSection>('cms세팅');
  const [newManualText, setNewManualText] = useState('');
  const [newManualUrl, setNewManualUrl] = useState('');
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [expandedManuals, setExpandedManuals] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const createTask = useCreateWorkflowTask();
  const updateTask = useUpdateWorkflowTask();
  const deleteTask = useDeleteWorkflowTask();

  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.workflowTasks.all,
    queryFn: async () => {
      const { data } = await supabase.from('workflow_tasks').select('*').order('sort_order');
      return (data || []) as WorkflowTask[];
    },
  });

  const sections = useMemo(() => {
    return SECTIONS.map((sec) => ({
      section: sec,
      tasks: tasks.filter((t) => t.section === sec),
    }));
  }, [tasks]);

  const handleAdd = () => {
    if (!newTaskName.trim()) return;
    const maxNumber = Math.max(0, ...tasks.map((t) => t.task_number));
    const sectionTasks = tasks.filter((t) => t.section === newSection);
    const maxSort = sectionTasks.length > 0 ? Math.max(...sectionTasks.map((t) => t.sort_order)) + 1 : 0;
    createTask.mutate({
      task_number: maxNumber + 1,
      section: newSection,
      task_name: newTaskName.trim(),
      sort_order: maxSort,
      manual_text: newManualText.trim() || undefined,
      manual_url: newManualUrl.trim() || undefined,
    }, {
      onSuccess: () => {
        setShowAddDialog(false);
        setNewTaskName('');
        setNewManualText('');
        setNewManualUrl('');
      },
    });
  };

  const startEdit = (task: WorkflowTask) => {
    setEditingTask({
      id: task.id,
      task_name: task.task_name,
      manual_text: task.manual_text ?? '',
      manual_url: task.manual_url ?? '',
    });
  };

  const saveEdit = () => {
    if (!editingTask) return;
    updateTask.mutate({
      id: editingTask.id,
      task_name: editingTask.task_name.trim(),
      manual_text: editingTask.manual_text.trim() || null,
      manual_url: editingTask.manual_url.trim() || null,
    });
    setEditingTask(null);
  };

  const toggleManual = (id: string) => {
    setExpandedManuals((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(sec) ? next.delete(sec) : next.add(sec);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">워크플로우 TASK 목록 관리, 상세 매뉴얼 편집</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="size-4 mr-1" /> Task 추가
          </Button>
        )}
      </div>

      {/* Section Groups */}
      <div className="space-y-3">
        {sections.map(({ section, tasks: sectionTasks }) => {
          const style = SECTION_STYLES[section];
          const isCollapsed = collapsedSections.has(section);
          const activeCount = sectionTasks.filter((t) => t.is_active).length;

          return (
            <div key={section} className={cn('rounded-xl border overflow-hidden', style.border)}>
              {/* Section Header */}
              <div
                className={cn('flex items-center justify-between px-4 py-2.5 cursor-pointer', style.bg)}
                onClick={() => toggleSection(section)}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                  <span className={cn('text-sm font-bold', style.text)}>{section}</span>
                  <Badge variant="outline" className="text-[10px]">{activeCount}/{sectionTasks.length}</Badge>
                </div>
              </div>

              {/* Task List */}
              {!isCollapsed && (
                <div className="divide-y divide-stone-100 bg-white">
                  {sectionTasks.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-stone-400">이 섹션에 Task가 없습니다</div>
                  )}
                  {sectionTasks.map((task) => {
                    const isEditing = editingTask?.id === task.id;
                    const hasManual = !!(task.manual_text || task.manual_url);
                    const isManualOpen = expandedManuals.has(task.id);

                    return (
                      <div key={task.id} className={cn('transition-colors', !task.is_active && 'opacity-40')}>
                        {/* Task Row */}
                        <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-stone-50/50">
                          <span className="text-[11px] font-mono text-stone-400 w-6 text-right shrink-0">{task.task_number}.</span>

                          {isEditing ? (
                            <div className="flex-1 space-y-2">
                              <Input
                                value={editingTask.task_name}
                                onChange={(e) => setEditingTask({ ...editingTask, task_name: e.target.value })}
                                className="h-8 text-sm"
                                placeholder="Task 이름"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px] text-stone-400">매뉴얼 URL</Label>
                                  <Input
                                    value={editingTask.manual_url}
                                    onChange={(e) => setEditingTask({ ...editingTask, manual_url: e.target.value })}
                                    className="h-7 text-xs mt-0.5"
                                    placeholder="https://..."
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-stone-400">매뉴얼 설명</Label>
                                  <textarea
                                    value={editingTask.manual_text}
                                    onChange={(e) => setEditingTask({ ...editingTask, manual_text: e.target.value })}
                                    className="w-full h-16 text-xs border border-stone-200 rounded-md p-1.5 mt-0.5 resize-none outline-none focus:border-orange-400"
                                    placeholder="상세 매뉴얼 내용..."
                                  />
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" className="h-6 text-[10px]" onClick={saveEdit}>
                                  <Save className="size-3 mr-0.5" /> 저장
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingTask(null)}>
                                  취소
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-stone-800 font-medium truncate">{task.task_name}</span>

                              {/* Manual indicators */}
                              <div className="flex items-center gap-1 shrink-0">
                                {hasManual && (
                                  <button
                                    type="button"
                                    onClick={() => toggleManual(task.id)}
                                    className={cn(
                                      'flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors',
                                      isManualOpen
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                    )}
                                  >
                                    <FileText className="size-3" />
                                    매뉴얼
                                  </button>
                                )}
                                {task.manual_url && (
                                  <a
                                    href={task.manual_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-blue-50 text-blue-500"
                                    onClick={(e) => e.stopPropagation()}
                                    title={task.manual_url}
                                  >
                                    <ExternalLink className="size-3" />
                                  </a>
                                )}
                              </div>

                              {/* Admin actions */}
                              {isAdmin && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="size-7" onClick={() => startEdit(task)}>
                                    <Pencil className="size-3.5 text-stone-400" />
                                  </Button>
                                  <Switch
                                    checked={task.is_active}
                                    onCheckedChange={(v) => updateTask.mutate({ id: task.id, is_active: v })}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => { if (confirm(`"${task.task_name}" Task를 삭제하시겠습니까?\n연결된 디폴트 맵핑과 체크 데이터도 함께 삭제됩니다.`)) deleteTask.mutate(task.id); }}
                                  >
                                    <Trash2 className="size-3.5 text-rose-400" />
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Expanded Manual */}
                        {isManualOpen && hasManual && !isEditing && (
                          <div className="px-4 pb-3 pl-12">
                            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100 space-y-2">
                              {task.manual_text && (
                                <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">{task.manual_text}</p>
                              )}
                              {task.manual_url && (
                                <a
                                  href={task.manual_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="size-3" />
                                  {task.manual_url}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>워크플로우 Task 추가</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">섹션 *</Label>
              <Select value={newSection} onValueChange={(v) => setNewSection(v as WorkflowSection)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Task 이름 *</Label>
              <Input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="예: SNS 채널 세팅" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">매뉴얼 URL (선택)</Label>
              <Input value={newManualUrl} onChange={(e) => setNewManualUrl(e.target.value)} placeholder="https://notion.so/..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">매뉴얼 설명 (선택)</Label>
              <textarea
                value={newManualText}
                onChange={(e) => setNewManualText(e.target.value)}
                className="w-full border border-stone-200 rounded-md p-2 text-sm mt-1 resize-none outline-none focus:border-orange-400"
                rows={3}
                placeholder="상세 매뉴얼 내용을 입력하세요..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowAddDialog(false)}>취소</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newTaskName.trim()}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
