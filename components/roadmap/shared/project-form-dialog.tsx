'use client';

import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Project, ProjectState, User as UserType } from '@/lib/types/database';

const STATE_CONFIG: Record<ProjectState, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  '진행중': { label: '진행중', color: 'text-orange-600', icon: Clock, bg: 'bg-orange-50' },
  '완료': { label: '완료', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600' },
};

const KANBAN_COLUMNS: ProjectState[] = ['진행중', '완료'];

export interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProject: Project | null;
  formData: Partial<Project>;
  setFormData: (data: Partial<Project>) => void;
  onSubmit: () => void;
  users: UserType[];
  isPending: boolean;
}

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
          <Select value={formData.state ?? '진행중'} onValueChange={(v) => setFormData({ ...formData, state: v as ProjectState })}>
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

export function ProjectFormDialog({
  open,
  onOpenChange,
  editingProject,
  formData,
  setFormData,
  onSubmit,
  users,
  isPending,
}: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingProject ? '프로젝트 수정' : '새 프로젝트'}</DialogTitle>
        </DialogHeader>
        <EmptyProjectForm formData={formData} setFormData={setFormData} users={users} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit} disabled={isPending || !formData.project_name?.trim()}>
            {isPending ? '처리중...' : editingProject ? '수정' : '생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
