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
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  member: {
    label: '멤버',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
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
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'email',
      header: '이메일',
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground">{row.email}</span>
      ),
    },
    {
      key: 'role',
      header: '역할',
      sortable: true,
      cell: (row) => {
        const config = ROLE_CONFIG[row.role];
        return (
          <Badge variant="secondary" className={config.className}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: 'position',
      header: '직책',
      sortable: true,
      cell: (row) => row.position ?? '-',
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
          <h1 className="text-xl font-bold tracking-tight">담당자 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">
            팀 구성원을 관리합니다. 총 {users.length}명
          </p>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)} className="rounded-lg">
          <UserPlus className="h-4 w-4 mr-2" />
          새 담당자 초대
        </Button>
      </motion.div>

      {/* AI Agent Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-r from-emerald-50/80 via-green-50/50 to-transparent dark:from-emerald-950/30 dark:via-green-950/20 dark:to-transparent px-4 py-3.5 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-100/30 to-transparent dark:from-emerald-900/15 rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-green-100/20 to-transparent dark:from-green-900/10 rounded-tr-full" />
          <div className="flex gap-3 items-start relative">
            <div className="relative shrink-0 mt-0.5">
              <div className="size-9 rounded-full bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/30 ring-2 ring-white/80 dark:ring-white/10">
                <Bot className="size-4 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-emerald-900 dark:text-emerald-200">어포메이션 본질 AI Agent</p>
                <span className="text-[9px] font-medium text-emerald-500/60 dark:text-emerald-400/50 bg-emerald-100/60 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">담당자 관리 가이드</span>
              </div>
              <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/70 leading-[1.7] space-y-1">
                <p>안녕하세요, 어포메이션 임직원 여러분! 담당자 관리 페이지를 안내해 드립니다.</p>
                <div className="bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2 space-y-0.5 border border-emerald-100/50 dark:border-emerald-800/20">
                  <p>이 페이지에서 <strong className="text-emerald-700 dark:text-emerald-300">팀 구성원을 초대하고 역할(관리자/멤버)을 설정</strong>합니다.</p>
                  <p><strong className="text-green-700 dark:text-green-300">비활성화</strong>하면 해당 담당자가 시스템에서 숨겨지며, 업무 배정에서 제외됩니다.</p>
                </div>
                <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/40">정확한 담당자 정보가 업무 배정과 일일 체크의 기반이 됩니다!</p>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>새 담당자 초대</DialogTitle>
            <DialogDescription>새 팀 구성원의 이메일과 정보를 입력하세요.</DialogDescription>
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>역할</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(v) => setInviteData((prev) => ({ ...prev, role: v as UserRole }))}
                >
                  <SelectTrigger className="w-full">
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
                />
              </div>
            </div>
            {inviteError && (
              <p className="text-sm text-red-500">{inviteError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              초기 비밀번호: temp1234! (로그인 후 변경 필요)
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? '초대 중...' : '초대'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>담당자 수정</DialogTitle>
            <DialogDescription>담당자 정보를 수정합니다.</DialogDescription>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_email">이메일</Label>
              <Input
                id="user_email"
                type="email"
                disabled
                value={formData.email}
                className="opacity-60"
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
                  <SelectTrigger className="w-full">
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
              <Button type="button" variant="outline" onClick={closeDialog}>
                취소
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '저장 중...' : '수정'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
