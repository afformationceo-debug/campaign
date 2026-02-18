'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, MoreHorizontal, ExternalLink } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useRealtimeCampaigns } from '@/hooks/use-realtime-campaigns';
import { logActivity } from '@/lib/utils/log-activity';
import { useAuth } from '@/hooks/use-auth';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Campaign,
  CampaignStatus,
  CampaignPhase,
  InterpreterStatus,
} from '@/lib/types/database';

// ─── Config ─────────────────────────────────────────────
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

const INTERPRETER_OPTIONS: { value: InterpreterStatus; label: string; className: string }[] = [
  { value: '통역 필요 없음', label: '필요 없음', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400' },
  { value: '돈받고 지원 (상시)', label: '유료(상시)', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: '돈받고 지원 (요청시)', label: '유료(요청)', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  { value: '무료로 지원(요청시)', label: '무료(요청)', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: '무료로 지원(상시)', label: '무료(상시)', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
];

const INTERPRETER_MAP = new Map(INTERPRETER_OPTIONS.map((o) => [o.value, o]));

// ─── Helpers ────────────────────────────────────────────
function formatCompactNumber(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}만`;
  return `${sign}${abs.toLocaleString()}`;
}

// ─── Inline Editable Cells ──────────────────────────────

interface EditingCell {
  id: string;
  field: string;
}

function InlineTextCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
  className,
  placeholder,
  type = 'text',
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'date' | 'url';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value]);

  if (!isEditing) {
    const isNum = type === 'number' && value;
    const displayValue = isNum
      ? formatCompactNumber(Number(value))
      : value || placeholder || '-';
    const exactValue = isNum ? `${Number(value).toLocaleString()}원` : null;

    const cell = (
      <div
        onClick={onStartEdit}
        className={cn(
          'cursor-pointer px-2 py-1 rounded hover:bg-muted/60 transition-colors min-h-[28px] flex items-center whitespace-nowrap',
          !value && 'text-muted-foreground/40',
          isNum && 'tabular-nums text-[11px]',
          className
        )}
      >
        {displayValue}
      </div>
    );

    if (exactValue) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{cell}</TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs tabular-nums">{exactValue}</p></TooltipContent>
        </Tooltip>
      );
    }
    return cell;
  }

  return (
    <Input
      ref={inputRef}
      type={type === 'number' ? 'number' : type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
        else onSave(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          onSave(value);
        }
      }}
      className="h-7 text-xs px-2"
      placeholder={placeholder}
    />
  );
}

function InlineDateCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.showPicker?.(), 50);
    }
  }, [isEditing, value]);

  if (!isEditing) {
    return (
      <div
        onClick={onStartEdit}
        className={cn(
          'cursor-pointer px-2 py-1 rounded hover:bg-muted/60 transition-colors min-h-[28px] flex items-center text-xs',
          !value && 'text-muted-foreground/40'
        )}
      >
        {value || '-'}
      </div>
    );
  }

  return (
    <Input
      ref={inputRef}
      type="date"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onSave(e.target.value);
      }}
      onBlur={() => onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setDraft(value);
          onSave(value);
        }
      }}
      className="h-7 text-xs px-2"
    />
  );
}

// ─── Create Campaign Form Data ──────────────────────────
interface CampaignFormData {
  campaign_name: string;
  client_name: string;
  target_country: string;
  status: CampaignStatus;
  phase: CampaignPhase;
  budget: string;
  monthly_fixed_cost: string;
  cost_per_influencer: string;
  influencer_fee_budget: string;
  interpreter_status: InterpreterStatus;
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
  monthly_fixed_cost: '',
  cost_per_influencer: '',
  influencer_fee_budget: '',
  interpreter_status: '통역 필요 없음',
  start_date: '',
  homepage_url: '',
};

// ─── Main Page ──────────────────────────────────────────

export default function CampaignsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(defaultFormData);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [search, setSearch] = useState('');

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

  // Inline update mutation with optimistic updates
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Campaign> }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.campaigns.all });
      const previous = queryClient.getQueryData<Campaign[]>(queryKeys.campaigns.all);
      queryClient.setQueryData(queryKeys.campaigns.all, (old: Campaign[] | undefined) =>
        (old || []).map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.campaigns.all, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      logActivity({
        userId: profile?.id,
        actionType: 'update',
        targetTable: 'campaigns',
        targetId: data.id,
        newValue: { campaign_name: data.campaign_name, status: data.status },
      });
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
        monthly_fixed_cost: data.monthly_fixed_cost ? Number(data.monthly_fixed_cost) : null,
        cost_per_influencer: data.cost_per_influencer ? Number(data.cost_per_influencer) : null,
        influencer_fee_budget: data.influencer_fee_budget ? Number(data.influencer_fee_budget) : null,
        interpreter_status: data.interpreter_status,
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

  const closeDialog = () => {
    setIsDialogOpen(false);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleInlineUpdate = useCallback(
    (id: string, field: keyof Campaign, value: unknown) => {
      setEditingCell(null);
      const campaign = campaigns.find((c) => c.id === id);
      if (!campaign) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((campaign as any)[field] === value) return;
      updateMutation.mutate({ id, updates: { [field]: value } as Partial<Campaign> });
    },
    [campaigns, updateMutation]
  );

  const isEditingCell = (id: string, field: string) =>
    editingCell?.id === id && editingCell?.field === field;

  const startEdit = (id: string, field: string) =>
    setEditingCell({ id, field });

  // Filter
  const filtered = campaigns.filter(
    (c) =>
      c.campaign_name.toLowerCase().includes(search.toLowerCase()) ||
      c.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.target_country ?? '').toLowerCase().includes(search.toLowerCase())
  );

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
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">캠페인 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">
            캠페인을 추가, 수정, 삭제합니다. 셀을 클릭하여 직접 수정할 수 있습니다.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="rounded-lg">
          <Plus className="h-4 w-4" />
          새 캠페인
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div variants={fadeUpItem}>
        <Input
          placeholder="캠페인명, 클라이언트, 국가로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm h-9 text-sm"
        />
      </motion.div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>
        </div>
      ) : (
        <motion.div variants={fadeUpItem} className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">캠페인명</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">클라이언트</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">대상 국가</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">상태</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">단계</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">시작일</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">예산</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">월 고정비용</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">섭외당 비용</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">원고료 예산</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">통역사배치</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground whitespace-nowrap">홈페이지</th>
                  <th className="py-2.5 px-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* 캠페인명 */}
                    <td className="py-1 px-2 min-w-[140px]">
                      <InlineTextCell
                        value={campaign.campaign_name}
                        isEditing={isEditingCell(campaign.id, 'campaign_name')}
                        onStartEdit={() => startEdit(campaign.id, 'campaign_name')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'campaign_name', v)}
                        className="font-medium"
                      />
                    </td>

                    {/* 클라이언트 */}
                    <td className="py-1 px-2 min-w-[100px]">
                      <InlineTextCell
                        value={campaign.client_name}
                        isEditing={isEditingCell(campaign.id, 'client_name')}
                        onStartEdit={() => startEdit(campaign.id, 'client_name')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'client_name', v)}
                      />
                    </td>

                    {/* 대상 국가 */}
                    <td className="py-1 px-2 min-w-[80px]">
                      <InlineTextCell
                        value={campaign.target_country ?? ''}
                        isEditing={isEditingCell(campaign.id, 'target_country')}
                        onStartEdit={() => startEdit(campaign.id, 'target_country')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'target_country', v || null)}
                        placeholder="-"
                      />
                    </td>

                    {/* 상태 - inline Select */}
                    <td className="py-1 px-2 min-w-[100px]">
                      <Select
                        value={campaign.status}
                        onValueChange={(v) => handleInlineUpdate(campaign.id, 'status', v)}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/60 px-2 gap-1 w-[100px]">
                          <Badge
                            variant="secondary"
                            className={cn('text-[10px] px-1.5 py-0', STATUS_CONFIG[campaign.status].className)}
                          >
                            {STATUS_CONFIG[campaign.status].label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {(Object.keys(STATUS_CONFIG) as CampaignStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              <Badge variant="secondary" className={cn('text-[10px]', STATUS_CONFIG[s].className)}>
                                {STATUS_CONFIG[s].label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* 단계 - inline Select */}
                    <td className="py-1 px-2 min-w-[110px]">
                      <Select
                        value={campaign.phase}
                        onValueChange={(v) => handleInlineUpdate(campaign.id, 'phase', v)}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/60 px-2 gap-1 w-[110px]">
                          <Badge
                            variant="secondary"
                            className={cn('text-[10px] px-1.5 py-0', PHASE_CONFIG[campaign.phase].className)}
                          >
                            {PHASE_CONFIG[campaign.phase].label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {(Object.keys(PHASE_CONFIG) as CampaignPhase[]).map((p) => (
                            <SelectItem key={p} value={p}>
                              <Badge variant="secondary" className={cn('text-[10px]', PHASE_CONFIG[p].className)}>
                                {PHASE_CONFIG[p].label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* 시작일 */}
                    <td className="py-1 px-2 min-w-[110px]">
                      <InlineDateCell
                        value={campaign.start_date ?? ''}
                        isEditing={isEditingCell(campaign.id, 'start_date')}
                        onStartEdit={() => startEdit(campaign.id, 'start_date')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'start_date', v || null)}
                      />
                    </td>

                    {/* 예산 */}
                    <td className="py-1 px-2 min-w-[100px]">
                      <InlineTextCell
                        value={campaign.budget?.toString() ?? ''}
                        isEditing={isEditingCell(campaign.id, 'budget')}
                        onStartEdit={() => startEdit(campaign.id, 'budget')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'budget', v ? Number(v) : null)}
                        type="number"
                        placeholder="-"
                        className="text-right"
                      />
                    </td>

                    {/* 월 고정비용 */}
                    <td className="py-1 px-2 min-w-[100px]">
                      <InlineTextCell
                        value={campaign.monthly_fixed_cost?.toString() ?? ''}
                        isEditing={isEditingCell(campaign.id, 'monthly_fixed_cost')}
                        onStartEdit={() => startEdit(campaign.id, 'monthly_fixed_cost')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'monthly_fixed_cost', v ? Number(v) : null)}
                        type="number"
                        placeholder="-"
                        className="text-right"
                      />
                    </td>

                    {/* 섭외당 비용 */}
                    <td className="py-1 px-2 min-w-[100px]">
                      <InlineTextCell
                        value={campaign.cost_per_influencer?.toString() ?? ''}
                        isEditing={isEditingCell(campaign.id, 'cost_per_influencer')}
                        onStartEdit={() => startEdit(campaign.id, 'cost_per_influencer')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'cost_per_influencer', v ? Number(v) : null)}
                        type="number"
                        placeholder="-"
                        className="text-right"
                      />
                    </td>

                    {/* 원고료 예산 */}
                    <td className="py-1 px-2 min-w-[100px]">
                      <InlineTextCell
                        value={campaign.influencer_fee_budget?.toString() ?? ''}
                        isEditing={isEditingCell(campaign.id, 'influencer_fee_budget')}
                        onStartEdit={() => startEdit(campaign.id, 'influencer_fee_budget')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'influencer_fee_budget', v ? Number(v) : null)}
                        type="number"
                        placeholder="-"
                        className="text-right"
                      />
                    </td>

                    {/* 통역사배치여부 */}
                    <td className="py-1 px-2 min-w-[120px]">
                      <Select
                        value={campaign.interpreter_status ?? '통역 필요 없음'}
                        onValueChange={(v) => handleInlineUpdate(campaign.id, 'interpreter_status', v)}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/60 px-2 gap-1 w-[120px]">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              INTERPRETER_MAP.get((campaign.interpreter_status ?? '통역 필요 없음') as InterpreterStatus)?.className
                            )}
                          >
                            {INTERPRETER_MAP.get((campaign.interpreter_status ?? '통역 필요 없음') as InterpreterStatus)?.label ?? '필요 없음'}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {INTERPRETER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <Badge variant="secondary" className={cn('text-[10px]', opt.className)}>
                                {opt.label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* 홈페이지 */}
                    <td className="py-1 px-2 min-w-[120px]">
                      {isEditingCell(campaign.id, 'homepage_url') ? (
                        <InlineTextCell
                          value={campaign.homepage_url ?? ''}
                          isEditing={true}
                          onStartEdit={() => {}}
                          onSave={(v) => handleInlineUpdate(campaign.id, 'homepage_url', v || null)}
                          type="url"
                          placeholder="URL 입력..."
                        />
                      ) : (
                        <div
                          onClick={() => startEdit(campaign.id, 'homepage_url')}
                          className="cursor-pointer px-2 py-1 rounded hover:bg-muted/60 transition-colors min-h-[28px] flex items-center gap-1"
                        >
                          {campaign.homepage_url ? (
                            <>
                              <a
                                href={campaign.homepage_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline truncate max-w-[100px]"
                              >
                                {new URL(campaign.homepage_url).hostname}
                              </a>
                              <ExternalLink className="size-3 text-muted-foreground shrink-0" />
                            </>
                          ) : (
                            <span className="text-muted-foreground/40">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-1 px-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeletingCampaign(campaign);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-muted-foreground text-sm">
                      {search ? '검색 결과가 없습니다.' : '캠페인이 없습니다. 새 캠페인을 추가해주세요.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 캠페인</DialogTitle>
            <DialogDescription>새로운 캠페인을 등록합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaign_name">캠페인명 *</Label>
                <Input
                  id="campaign_name"
                  required
                  value={formData.campaign_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, campaign_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_name">클라이언트 *</Label>
                <Input
                  id="client_name"
                  required
                  value={formData.client_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, client_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_country">대상 국가</Label>
                <Input
                  id="target_country"
                  value={formData.target_country}
                  onChange={(e) => setFormData((prev) => ({ ...prev, target_country: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">예산</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData((prev) => ({ ...prev, budget: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_fixed_cost">월 고정비용</Label>
                <Input
                  id="monthly_fixed_cost"
                  type="number"
                  value={formData.monthly_fixed_cost}
                  onChange={(e) => setFormData((prev) => ({ ...prev, monthly_fixed_cost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost_per_influencer">섭외당 비용</Label>
                <Input
                  id="cost_per_influencer"
                  type="number"
                  value={formData.cost_per_influencer}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cost_per_influencer: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="influencer_fee_budget">원고료 예산</Label>
                <Input
                  id="influencer_fee_budget"
                  type="number"
                  value={formData.influencer_fee_budget}
                  onChange={(e) => setFormData((prev) => ({ ...prev, influencer_fee_budget: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>통역사배치여부</Label>
              <Select
                value={formData.interpreter_status}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, interpreter_status: v as InterpreterStatus }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERPRETER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>상태</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as CampaignStatus }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, phase: v as CampaignPhase }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homepage_url">홈페이지 URL</Label>
                <Input
                  id="homepage_url"
                  type="url"
                  value={formData.homepage_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, homepage_url: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>취소</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '저장 중...' : '등록'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
                if (deletingCampaign) deleteMutation.mutate(deletingCampaign.id);
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
