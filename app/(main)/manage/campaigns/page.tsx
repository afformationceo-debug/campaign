'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useRealtimeCampaigns } from '@/hooks/use-realtime-campaigns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type {
  Campaign,
  CampaignStatus,
  CampaignPhase,
} from '@/lib/types/database';

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  paused: { label: 'Paused', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400' },
};

const PHASE_CONFIG: Record<CampaignPhase, { label: string; className: string }> = {
  onboarding: { label: 'Onboarding', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' },
  running: { label: 'Running', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30' },
  scaling: { label: 'Scaling', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' },
};

interface CampaignFormData {
  campaign_name: string;
  client_name: string;
  target_country: string;
  status: CampaignStatus;
  phase: CampaignPhase;
  budget: string;
  start_date: string;
  homepage_url: string;
}

const defaultFormData: CampaignFormData = {
  campaign_name: '',
  client_name: '',
  target_country: '',
  status: 'active',
  phase: 'onboarding',
  budget: '',
  start_date: '',
  homepage_url: '',
};

export default function CampaignsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(defaultFormData);

  useRealtimeCampaigns();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('campaign_name');
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const { error } = await supabase.from('campaigns').insert({
        campaign_name: data.campaign_name,
        client_name: data.client_name,
        target_country: data.target_country || null,
        status: data.status,
        phase: data.phase,
        budget: data.budget ? Number(data.budget) : null,
        start_date: data.start_date || null,
        homepage_url: data.homepage_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CampaignFormData }) => {
      const { error } = await supabase
        .from('campaigns')
        .update({
          campaign_name: data.campaign_name,
          client_name: data.client_name,
          target_country: data.target_country || null,
          status: data.status,
          phase: data.phase,
          budget: data.budget ? Number(data.budget) : null,
          start_date: data.start_date || null,
          homepage_url: data.homepage_url || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      setIsDeleteDialogOpen(false);
      setDeletingCampaign(null);
    },
  });

  const openCreateDialog = () => {
    setEditingCampaign(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      campaign_name: campaign.campaign_name,
      client_name: campaign.client_name,
      target_country: campaign.target_country ?? '',
      status: campaign.status,
      phase: campaign.phase,
      budget: campaign.budget?.toString() ?? '',
      start_date: campaign.start_date ?? '',
      homepage_url: campaign.homepage_url ?? '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCampaign(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: ColumnDef<Campaign>[] = [
    {
      key: 'campaign_name',
      header: '캠페인명',
      sortable: true,
      cell: (row) => <span className="font-medium">{row.campaign_name}</span>,
    },
    {
      key: 'client_name',
      header: '클라이언트',
      sortable: true,
      cell: (row) => row.client_name,
    },
    {
      key: 'target_country',
      header: '대상 국가',
      sortable: true,
      cell: (row) => row.target_country ?? '-',
    },
    {
      key: 'status',
      header: '상태',
      sortable: true,
      cell: (row) => {
        const config = STATUS_CONFIG[row.status];
        return (
          <Badge variant="secondary" className={config.className}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: 'phase',
      header: '단계',
      sortable: true,
      cell: (row) => {
        const config = PHASE_CONFIG[row.phase];
        return (
          <Badge variant="secondary" className={config.className}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: 'budget',
      header: '예산',
      sortable: true,
      sortValue: (row) => row.budget ?? 0,
      cell: (row) =>
        row.budget != null
          ? `${row.budget.toLocaleString()}원`
          : '-',
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              openEditDialog(row);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingCampaign(row);
              setIsDeleteDialogOpen(true);
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
          <h1 className="text-xl font-bold tracking-tight">캠페인 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">
            캠페인을 추가, 수정, 삭제합니다.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="rounded-lg">
          <Plus className="h-4 w-4" />
          새 캠페인
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
            data={campaigns}
            searchKey="campaign_name"
            searchPlaceholder="캠페인명 검색..."
          />
        </motion.div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? '캠페인 수정' : '새 캠페인'}
            </DialogTitle>
            <DialogDescription>
              {editingCampaign
                ? '캠페인 정보를 수정합니다.'
                : '새로운 캠페인을 등록합니다.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaign_name">캠페인명 *</Label>
                <Input
                  id="campaign_name"
                  required
                  value={formData.campaign_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, campaign_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_name">클라이언트 *</Label>
                <Input
                  id="client_name"
                  required
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, client_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_country">대상 국가</Label>
                <Input
                  id="target_country"
                  value={formData.target_country}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, target_country: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">예산</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, budget: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>상태</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, status: v as CampaignStatus }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>단계</Label>
                <Select
                  value={formData.phase}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, phase: v as CampaignPhase }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="scaling">Scaling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">시작일</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homepage_url">홈페이지 URL</Label>
                <Input
                  id="homepage_url"
                  type="url"
                  value={formData.homepage_url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, homepage_url: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                취소
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? '저장 중...'
                  : editingCampaign
                  ? '수정'
                  : '등록'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>캠페인 삭제</DialogTitle>
            <DialogDescription>
              &ldquo;{deletingCampaign?.campaign_name}&rdquo; 캠페인을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingCampaign(null);
              }}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingCampaign) {
                  deleteMutation.mutate(deletingCampaign.id);
                }
              }}
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
