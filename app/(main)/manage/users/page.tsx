'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, UserPlus } from 'lucide-react';
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
        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">담당자 관리</h1>
          <p className="text-muted-foreground text-sm">
            팀 구성원을 관리합니다. 총 {users.length}명
          </p>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          새 담당자 초대
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          로딩 중...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchKey="name"
          searchPlaceholder="이름 검색..."
        />
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
    </div>
  );
}
