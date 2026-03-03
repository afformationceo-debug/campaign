'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Pencil, UserPlus, Bot } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { inviteUser } from '@/app/actions/invite-user';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import type { User, UserRole } from '@/lib/types/database';

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  admin: {
    label: '관리자',
    className: 'bg-orange-50 text-orange-600',
  },
  member: {
    label: '멤버',
    className: 'bg-stone-100 text-stone-500',
  },
};

interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  position: string;
  is_active: boolean;
}

export default function UsersPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'member',
    position: '',
    is_active: true,
  });
  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    role: 'member' as UserRole,
    position: '',
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as User[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserFormData }) => {
      const { error } = await supabase
        .from('users')
        .update({
          name: data.name,
          role: data.role,
          position: data.position || null,
          is_active: data.is_active,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      closeDialog();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string; position: string }) => {
      const result = await inviteUser(data.email, data.name, data.role, data.position);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setIsInviteDialogOpen(false);
      setInviteError(null);
      setInviteData({ name: '', email: '', role: 'member', position: '' });
    },
    onError: (err: Error) => {
      setInviteError(err.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.all });
      const previous = queryClient.getQueryData<User[]>(queryKeys.users.all);
      queryClient.setQueryData(queryKeys.users.all, (old: User[] | undefined) =>
        (old || []).map((u) => (u.id === id ? { ...u, is_active } : u))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.users.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      position: user.position ?? '',
      is_active: user.is_active,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    }
  };

  const columns: ColumnDef<User>[] = [
    {
      key: 'name',
      header: '이름',
      sortable: true,
      cell: (row) => <span className="font-medium text-[12px]">{row.name}</span>,
    },
    {
      key: 'email',
      header: '이메일',
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground text-[12px]">{row.email}</span>
      ),
    },
    {
      key: 'role',
      header: '역할',
      sortable: true,
      cell: (row) => {
        const config = ROLE_CONFIG[row.role];
        return (
          <Badge variant="secondary" className={`${config.className} rounded-full text-[11px]`}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: 'position',
      header: '직책',
      sortable: true,
      cell: (row) => <span className="text-[12px]">{row.position ?? '-'}</span>,
    },
    {
      key: 'is_active',
      header: '활성',
      sortable: true,
      sortValue: (row) => (row.is_active ? 1 : 0),
      cell: (row) => (
        <Switch
          size="sm"
          checked={row.is_active}
          onCheckedChange={(checked) =>
            toggleActiveMutation.mutate({ id: row.id, is_active: checked })
          }
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => openEditDialog(row)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      ),
    },
  ];

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto">
            <span className="text-lg">🔒</span>
          </div>
          <p className="text-stone-500">관리자 권한이 필요해요.</p>
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
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-50">
            <UserPlus className="size-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">우리 팀을 관리할 수 있어요</h1>
            <p className="text-sm text-stone-500 mt-1">
              팀원 초대, 역할 설정, 활성 상태 관리까지 편하게 해 보세요.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)} className="rounded-2xl bg-orange-500 text-white hover:bg-orange-600 shadow-sm">
          <UserPlus className="h-4 w-4 mr-2" />
          새 담당자 초대
        </Button>
      </motion.div>

      {/* AI Agent Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3.5 overflow-hidden">
          <div className="flex gap-3 items-start relative">
            <div className="relative shrink-0 mt-0.5">
              <div className="size-9 rounded-full bg-orange-500 flex items-center justify-center">
                <Bot className="size-4 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-orange-500 border-2 border-white" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-stone-800">bkit AI Agent</p>
                <span className="text-[9px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">담당자 관리 가이드</span>
              </div>
              <div className="text-[11px] text-stone-600 leading-[1.7] space-y-1">
                <p>안녕하세요! 담당자 관리 페이지를 안내해 드릴게요.</p>
                <div className="bg-white/70 rounded-xl px-3 py-2 space-y-0.5 border border-orange-100">
                  <p>이 페이지에서 <strong className="text-orange-700">팀 구성원을 초대하고 역할(관리자/멤버)을 설정</strong>할 수 있어요.</p>
                  <p><strong className="text-orange-700">비활성화</strong>하면 해당 담당자가 시스템에서 숨겨지고, 업무 배정에서 제외돼요.</p>
                </div>
                <p className="text-[10px] text-stone-400">정확한 담당자 정보가 업무 배정과 일일 체크의 기반이 돼요!</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-stone-400">
            <div className="size-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
            <span className="text-sm">데이터를 불러오는 중이에요...</span>
          </div>
        </div>
      ) : (
        <motion.div variants={fadeUpItem}>
          <DataTable
            columns={columns}
            data={users}
            searchKey="name"
            searchPlaceholder="이름 검색..."
          />
        </motion.div>
      )}

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-stone-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold">새 담당자를 초대해 보세요</DialogTitle>
            <DialogDescription className="text-stone-500">새 팀 구성원의 이메일과 정보를 입력해 주세요.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate(inviteData);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="invite_name">이름 *</Label>
              <Input
                id="invite_name"
                required
                value={inviteData.name}
                onChange={(e) => setInviteData((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite_email">이메일 *</Label>
              <Input
                id="invite_email"
                type="email"
                required
                value={inviteData.email}
                onChange={(e) => setInviteData((prev) => ({ ...prev, email: e.target.value }))}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>역할</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(v) => setInviteData((prev) => ({ ...prev, role: v as UserRole }))}
                >
                  <SelectTrigger className="w-full bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="member">멤버</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite_position">직책</Label>
                <Input
                  id="invite_position"
                  value={inviteData.position}
                  onChange={(e) => setInviteData((prev) => ({ ...prev, position: e.target.value }))}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              초기 비밀번호: temp1234! (로그인 후 변경 필요)
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)} className="rounded-xl border-stone-200">
                취소
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending} className="bg-orange-500 text-white hover:bg-orange-600 rounded-xl">
                {inviteMutation.isPending ? '초대 중...' : '초대'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-stone-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold">담당자 정보 수정</DialogTitle>
            <DialogDescription className="text-stone-500">담당자 정보를 수정해 주세요.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user_name">이름 *</Label>
              <Input
                id="user_name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_email">이메일</Label>
              <Input
                id="user_email"
                type="email"
                disabled
                value={formData.email}
                className="opacity-60 bg-secondary/50 border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>역할</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, role: v as UserRole }))
                  }
                >
                  <SelectTrigger className="w-full bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="member">멤버</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_position">직책</Label>
                <Input
                  id="user_position"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, position: e.target.value }))
                  }
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label>{formData.is_active ? '활성' : '비활성'}</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-stone-200">
                취소
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="bg-orange-500 text-white hover:bg-orange-600 rounded-xl">
                {updateMutation.isPending ? '저장 중...' : '수정'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
