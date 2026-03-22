'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, MoreHorizontal, ExternalLink, Bot } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useLinkCampaignProducts } from '@/hooks/use-workflow-mutations';
import type {
  Campaign,
  CampaignStatus,
  CampaignPhase,
  CampaignType,
  ChatdocStatus,
  InterpreterStatus,
  BrandPhase,
  VatType,
  CollaborationProduct,
  CampaignProductWithProduct,
} from '@/lib/types/database';

// ─── Config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-orange-50 text-orange-600 text-[11px]' },
  paused: { label: 'Paused', className: 'bg-stone-100 text-stone-500 text-[11px]' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-600 text-[11px]' },
};

const PHASE_CONFIG: Record<CampaignPhase, { label: string; className: string }> = {
  onboarding: { label: 'Onboarding', className: 'bg-amber-50 text-amber-600' },
  running: { label: 'Running', className: 'bg-orange-50 text-orange-600' },
  scaling: { label: 'Scaling', className: 'bg-stone-100 text-stone-500' },
};

const INTERPRETER_OPTIONS: { value: InterpreterStatus; label: string; className: string }[] = [
  { value: '통역 필요 없음', label: '필요 없음', className: 'bg-stone-100 text-stone-500' },
  { value: '돈받고 지원 (상시)', label: '유료(상시)', className: 'bg-orange-50 text-orange-600' },
  { value: '돈받고 지원 (요청시)', label: '유료(요청)', className: 'bg-amber-50 text-amber-600' },
  { value: '무료로 지원(요청시)', label: '무료(요청)', className: 'bg-emerald-50 text-emerald-600' },
  { value: '무료로 지원(상시)', label: '무료(상시)', className: 'bg-emerald-50 text-emerald-600' },
];

const INTERPRETER_MAP = new Map(INTERPRETER_OPTIONS.map((o) => [o.value, o]));

const CAMPAIGN_TYPE_CONFIG: Record<CampaignType, { label: string; className: string }> = {
  '해외마케팅': { label: '해외마케팅', className: 'bg-orange-50 text-orange-600' },
  '국내챗닥': { label: '국내챗닥', className: 'bg-amber-50 text-amber-700' },
  '제품브랜드': { label: '제품브랜드', className: 'bg-stone-100 text-stone-600' },
};

const BRAND_PHASE_CONFIG: Record<BrandPhase, { label: string; className: string }> = {
  '기획': { className: 'bg-stone-100 text-stone-500' },
  '플랫폼세팅': { className: 'bg-amber-50 text-amber-600' },
  '인플루언서기획': { className: 'bg-amber-50 text-amber-600' },
  '운영': { className: 'bg-orange-50 text-orange-600' },
  '스케일링': { className: 'bg-emerald-50 text-emerald-600' },
} as Record<BrandPhase, { label: string; className: string }>;
// Add labels
Object.entries(BRAND_PHASE_CONFIG).forEach(([key, val]) => { val.label = key; });

const PRODUCT_CATEGORIES = ['뷰티', '식품', '패션', '전자', '생활용품', '기타'];

const TARGET_COUNTRY_OPTIONS = [
  '일본', '대만', '싱가포르', '말레이시아', '인도네시아',
  '태국', '필리핀', '베트남', '미국', '영국', '독일', '캐나다', '멕시코', '브라질',
];

const CHATDOC_STATUS_CONFIG: Record<ChatdocStatus, { label: string; className: string }> = {
  '대기': { label: '대기', className: 'bg-stone-100 text-stone-500' },
  '온보딩중': { label: '온보딩중', className: 'bg-amber-50 text-amber-600' },
  '운영중': { label: '운영중', className: 'bg-orange-50 text-orange-600' },
  '종료': { label: '종료', className: 'bg-stone-100 text-stone-400' },
};

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
          'cursor-pointer px-2 py-1 rounded hover:bg-orange-50/60 transition-colors min-h-[28px] flex items-center whitespace-nowrap',
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
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
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
          'cursor-pointer px-2 py-1 rounded hover:bg-orange-50/60 transition-colors min-h-[28px] flex items-center text-xs',
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
  campaign_type: CampaignType;
  campaign_name: string;
  client_name: string;
  target_country: string;
  status: CampaignStatus;
  phase: CampaignPhase;
  monthly_fixed_cost: string;
  cost_per_influencer: string;
  influencer_fee_budget: string;
  commission_rate: string;
  vat_type: VatType;
  interpreter_status: InterpreterStatus;
  start_date: string;
  homepage_url: string;
  // 국내챗닥 전용
  chatdoc_onboarding_done: boolean;
  chatdoc_roas_target: string;
  chatdoc_status: ChatdocStatus;
  // 제품브랜드 전용
  target_countries: string[];
  product_category: string;
  brand_budget: string;
}

const defaultFormData: CampaignFormData = {
  campaign_type: '해외마케팅',
  campaign_name: '',
  client_name: '',
  target_country: '',
  status: 'active',
  phase: 'onboarding',
  monthly_fixed_cost: '',
  cost_per_influencer: '',
  influencer_fee_budget: '',
  commission_rate: '',
  vat_type: 'VAT별도',
  interpreter_status: '통역 필요 없음',
  start_date: '',
  homepage_url: '',
  chatdoc_onboarding_done: false,
  chatdoc_roas_target: '',
  chatdoc_status: '대기',
  target_countries: [],
  product_category: '',
  brand_budget: '',
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
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const linkProducts = useLinkCampaignProducts();

  useRealtimeCampaigns();

  const { data: collabProducts = [] } = useQuery({
    queryKey: queryKeys.collabProducts.all,
    queryFn: async () => {
      const { data } = await supabase.from('collaboration_products').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as CollaborationProduct[];
    },
  });

  const { data: allCampaignProducts = [] } = useQuery({
    queryKey: queryKeys.campaignProducts.all,
    queryFn: async () => {
      const { data } = await supabase.from('campaign_products').select('*, collaboration_products(*)').order('created_at');
      return (data || []) as CampaignProductWithProduct[];
    },
  });

  // 캠페인ID → 협업상품명 배열 맵
  const campaignProductMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allCampaignProducts.forEach((cp) => {
      const names = map.get(cp.campaign_id) || [];
      names.push(cp.collaboration_products.product_name);
      map.set(cp.campaign_id, names);
    });
    return map;
  }, [allCampaignProducts]);

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
      const insertData: Record<string, unknown> = {
        campaign_type: data.campaign_type,
        campaign_name: data.campaign_name,
        client_name: data.client_name,
        status: data.status,
        start_date: data.start_date || null,
        homepage_url: data.homepage_url || null,
      };
      if (data.campaign_type === '해외마케팅') {
        insertData.target_country = data.target_country || null;
        insertData.phase = data.phase;
        insertData.monthly_fixed_cost = data.monthly_fixed_cost ? Number(data.monthly_fixed_cost) : null;
        insertData.cost_per_influencer = data.cost_per_influencer ? Number(data.cost_per_influencer) : null;
        insertData.influencer_fee_budget = data.influencer_fee_budget ? Number(data.influencer_fee_budget) : null;
        insertData.commission_rate = data.commission_rate ? Number(data.commission_rate) : null;
        insertData.vat_type = data.vat_type;
        insertData.interpreter_status = data.interpreter_status;
      } else if (data.campaign_type === '제품브랜드') {
        insertData.target_countries = data.target_countries.length > 0 ? data.target_countries : [];
        insertData.product_category = data.product_category || null;
        insertData.brand_budget = data.brand_budget ? Number(data.brand_budget) : null;
        insertData.brand_phase = '기획';
      } else {
        insertData.chatdoc_onboarding_done = data.chatdoc_onboarding_done;
        insertData.chatdoc_roas_target = data.chatdoc_roas_target ? Number(data.chatdoc_roas_target) : null;
        insertData.chatdoc_status = data.chatdoc_status;
      }
      const { data: created, error } = await supabase.from('campaigns').insert(insertData).select('id, campaign_type').single();
      if (error) throw error;

      // 자동으로 기본 설정(campaign_configs) 생성
      const DEFAULT_CONFIGS = [
        { config_type: '세팅 관련', config_key: '인스타그램 URL', value_type: 'url' },
        { config_type: '세팅 관련', config_key: '페이스북 URL', value_type: 'url' },
        { config_type: '세팅 관련', config_key: '트위터 URL', value_type: 'url' },
        { config_type: '세팅 관련', config_key: '틱톡 URL', value_type: 'url' },
        { config_type: '세팅 관련', config_key: '플랫폼별 ID/PW', value_type: 'credentials' },
        { config_type: '세팅 관련', config_key: '고객전용 라인', value_type: 'url' },
        { config_type: '세팅 관련', config_key: '고객전용 왓츠앱 링크', value_type: 'url' },
        { config_type: '세팅 관련', config_key: '홈페이지 링크', value_type: 'url' },
        { config_type: '세팅 관련', config_key: '구글맵 세팅여부', value_type: 'status' },
        { config_type: '세팅 관련', config_key: '리틀리 세팅여부', value_type: 'status' },
        { config_type: '세팅 관련', config_key: '리틀리 링크', value_type: 'url' },
        { config_type: '인플루언서 관련', config_key: '인플루언서 전용 라인 세팅', value_type: 'url' },
        { config_type: '인플루언서 관련', config_key: '인플루언서 전용 왓츠앱 세팅', value_type: 'url' },
        { config_type: '인플루언서 관련', config_key: '스카웃매니저 라인 메신저 연동', value_type: 'status' },
        { config_type: '인플루언서 관련', config_key: '스카웃매니저 왓츠앱 메신저 연동', value_type: 'status' },
        { config_type: '인플루언서 관련', config_key: '스카웃매니저 캠페인 등록', value_type: 'status' },
        { config_type: '지식베이스', config_key: '고객전용 지식베이스 세팅여부', value_type: 'status' },
        { config_type: '지식베이스', config_key: '인플전용 지식베이스 세팅여부', value_type: 'status' },
        { config_type: 'CS어드민', config_key: '메신저 채널 연동 여부', value_type: 'status' },
        { config_type: 'CS어드민', config_key: 'CRM 연동설정 여부', value_type: 'status' },
        { config_type: 'CRM', config_key: 'CRM 등록여부', value_type: 'status' },
      ];
      const BRAND_CONFIGS = [
        { config_type: '이커머스 세팅', config_key: '플랫폼 계정 생성', value_type: 'status' },
        { config_type: '이커머스 세팅', config_key: '상품 등록', value_type: 'status' },
        { config_type: '이커머스 세팅', config_key: '결제 시스템 연동', value_type: 'status' },
        { config_type: '이커머스 세팅', config_key: '배송 설정', value_type: 'status' },
        { config_type: '인플루언서 기획', config_key: '타겟 인플루언서 리스트업', value_type: 'status' },
        { config_type: '인플루언서 기획', config_key: '원고비 예산 배분', value_type: 'text' },
        { config_type: '인플루언서 기획', config_key: '스카웃매니저 캠페인 세팅', value_type: 'status' },
        { config_type: '브랜드 마케팅', config_key: 'SNS 채널 세팅', value_type: 'status' },
        { config_type: '브랜드 마케팅', config_key: '광고 소재 제작', value_type: 'status' },
        { config_type: '브랜드 마케팅', config_key: '현지 마케팅 채널 연동', value_type: 'status' },
      ];

      const templates = created.campaign_type === '제품브랜드'
        ? [...DEFAULT_CONFIGS, ...BRAND_CONFIGS]
        : DEFAULT_CONFIGS;

      const configInserts = templates.map((t) => ({
        campaign_id: created.id,
        config_type: t.config_type,
        config_key: t.config_key,
        config_value: '',
        value_type: t.value_type,
        status: '미완료',
      }));

      await supabase.from('campaign_configs').insert(configInserts);

      // 협업상품 연결 + 워크플로우 체크 자동 생성
      if (selectedProductIds.length > 0) {
        await linkProducts.mutateAsync({
          campaignId: created.id,
          productIds: selectedProductIds,
          userId: profile?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all });
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
    setSelectedProductIds([]);
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
  const filtered = campaigns.filter((c) => {
    if (typeFilter && c.campaign_type !== typeFilter) return false;
    const lower = search.toLowerCase();
    return (
      c.campaign_name.toLowerCase().includes(lower) ||
      c.client_name.toLowerCase().includes(lower) ||
      (c.target_country ?? '').toLowerCase().includes(lower)
    );
  });

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
      {/* Header */}
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-50">
            <Bot className="size-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">캠페인을 만들고 관리할 수 있어요</h1>
            <p className="text-sm text-stone-500 mt-1">
              캠페인 추가, 수정, 상태 변경까지 한 곳에서 편하게 관리해 보세요.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="rounded-2xl bg-orange-500 text-white hover:bg-orange-600 shadow-sm">
          <Plus className="size-4 mr-1" /> 캠페인 추가
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
                <p className="text-[12px] font-bold text-stone-800">어포메이션 본질 AI Agent</p>
                <span className="text-[9px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">캠페인 관리 가이드</span>
              </div>
              <div className="text-[11px] text-stone-600 leading-[1.7] space-y-1">
                <p>안녕하세요! 캠페인 관리 페이지를 안내해 드릴게요.</p>
                <div className="bg-white/70 rounded-xl px-3 py-2 space-y-0.5 border border-orange-100">
                  <p>이 페이지에서는 <strong className="text-orange-700">캠페인의 등록, 수정, 삭제</strong>를 관리해요.</p>
                  <p>셀을 <strong className="text-orange-700">직접 클릭</strong>하면 해당 항목을 바로 수정할 수 있어요.</p>
                </div>
                <p className="text-[10px] text-stone-400">캠페인 정보가 정확해야 모든 업무 체크와 리포트가 올바르게 작동해요!</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search & Filter */}
      <motion.div variants={fadeUpItem} className="flex items-center gap-2">
        <Input
          placeholder="캠페인명, 클라이언트, 국가로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm h-9 text-[13px] bg-secondary/50 border-border"
        />
        <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[130px] h-9 text-xs border-border"><SelectValue placeholder="유형" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            <SelectItem value="해외마케팅">해외마케팅</SelectItem>
            <SelectItem value="국내챗닥">국내챗닥</SelectItem>
            <SelectItem value="제품브랜드">제품브랜드</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-stone-400">
            <div className="size-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
            <span className="text-sm">데이터를 불러오는 중이에요...</span>
          </div>
        </div>
      ) : (
        <motion.div variants={fadeUpItem} className="border border-stone-100 rounded-2xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">유형</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">캠페인명</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">클라이언트</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">협업상품</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">상태</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">시작일</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">국가/단계</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">비용/예산</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">섭외당/카테고리</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">원고료 예산</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">수수료</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">통역/상태</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">홈페이지</th>
                  <th className="py-1.5 px-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((campaign) => {
                  const cType = campaign.campaign_type ?? '해외마케팅';
                  const typeConf = CAMPAIGN_TYPE_CONFIG[cType];
                  return (
                  <tr
                    key={campaign.id}
                    className="border-b border-stone-100 last:border-b-0 hover:bg-orange-50/40 transition-colors"
                  >
                    {/* 유형 */}
                    <td className="py-0.5 px-2 min-w-[90px]">
                      <Select
                        value={cType}
                        onValueChange={(v) => handleInlineUpdate(campaign.id, 'campaign_type', v)}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-orange-50/60 px-1 gap-1 w-[90px]">
                          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 rounded-full', typeConf.className)}>
                            {typeConf.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {(Object.keys(CAMPAIGN_TYPE_CONFIG) as CampaignType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              <Badge variant="secondary" className={cn('text-[10px] rounded-full', CAMPAIGN_TYPE_CONFIG[t].className)}>
                                {CAMPAIGN_TYPE_CONFIG[t].label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* 캠페인명 */}
                    <td className="py-0.5 px-2 min-w-[140px]">
                      <InlineTextCell
                        value={campaign.campaign_name}
                        isEditing={isEditingCell(campaign.id, 'campaign_name')}
                        onStartEdit={() => startEdit(campaign.id, 'campaign_name')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'campaign_name', v)}
                        className="font-medium text-[13px]"
                      />
                    </td>

                    {/* 클라이언트 */}
                    <td className="py-0.5 px-2 min-w-[100px]">
                      <InlineTextCell
                        value={campaign.client_name}
                        isEditing={isEditingCell(campaign.id, 'client_name')}
                        onStartEdit={() => startEdit(campaign.id, 'client_name')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'client_name', v)}
                      />
                    </td>

                    {/* 협업상품 */}
                    <td className="py-0.5 px-2 min-w-[100px]">
                      <div className="flex flex-wrap gap-0.5">
                        {(campaignProductMap.get(campaign.id) || []).map((name) => (
                          <Badge
                            key={name}
                            variant="secondary"
                            className={cn(
                              'text-[10px] px-1.5 py-0 rounded-full',
                              name === '계약종료' ? 'bg-red-50 text-red-500' :
                              name === '인플루언서 마케팅' ? 'bg-purple-50 text-purple-600' :
                              name === '해외환자유치상품' ? 'bg-blue-50 text-blue-600' :
                              'bg-stone-100 text-stone-500'
                            )}
                          >
                            {name}
                          </Badge>
                        ))}
                        {!(campaignProductMap.get(campaign.id) || []).length && (
                          <span className="text-[10px] text-stone-300">-</span>
                        )}
                      </div>
                    </td>

                    {/* 상태 */}
                    <td className="py-0.5 px-2 min-w-[100px]">
                      <Select
                        value={campaign.status}
                        onValueChange={(v) => handleInlineUpdate(campaign.id, 'status', v)}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-orange-50/60 px-2 gap-1 w-[100px]">
                          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 rounded-full', STATUS_CONFIG[campaign.status].className)}>
                            {STATUS_CONFIG[campaign.status].label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {(Object.keys(STATUS_CONFIG) as CampaignStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              <Badge variant="secondary" className={cn('text-[10px] rounded-full', STATUS_CONFIG[s].className)}>
                                {STATUS_CONFIG[s].label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* 시작일 */}
                    <td className="py-0.5 px-2 min-w-[110px]">
                      <InlineDateCell
                        value={campaign.start_date ?? ''}
                        isEditing={isEditingCell(campaign.id, 'start_date')}
                        onStartEdit={() => startEdit(campaign.id, 'start_date')}
                        onSave={(v) => handleInlineUpdate(campaign.id, 'start_date', v || null)}
                      />
                    </td>

                    {/* 국가/단계 — 유형별 분기 */}
                    <td className="py-0.5 px-2 min-w-[130px]">
                      {cType === '해외마케팅' ? (
                        <div className="flex items-center gap-1">
                          <InlineTextCell
                            value={campaign.target_country ?? ''}
                            isEditing={isEditingCell(campaign.id, 'target_country')}
                            onStartEdit={() => startEdit(campaign.id, 'target_country')}
                            onSave={(v) => handleInlineUpdate(campaign.id, 'target_country', v || null)}
                            placeholder="-"
                          />
                          <Select value={campaign.phase} onValueChange={(v) => handleInlineUpdate(campaign.id, 'phase', v)}>
                            <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent px-1 gap-0.5 w-[80px]">
                              <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 rounded-full', PHASE_CONFIG[campaign.phase]?.className)}>
                                {PHASE_CONFIG[campaign.phase]?.label ?? '-'}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {(Object.keys(PHASE_CONFIG) as CampaignPhase[]).map((p) => (
                                <SelectItem key={p} value={p}><Badge variant="secondary" className={cn('text-[10px] rounded-full', PHASE_CONFIG[p].className)}>{PHASE_CONFIG[p].label}</Badge></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : cType === '제품브랜드' ? (
                        <div className="flex items-center gap-1">
                          <div className="flex flex-wrap gap-0.5 px-1 py-0.5 min-w-[60px]">
                            {(campaign.target_countries ?? []).length > 0 ? (
                              (campaign.target_countries ?? []).map((c) => (
                                <Badge key={c} variant="outline" className="text-[8px] px-1 py-0 rounded-full border-border">{c}</Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground/40 text-[10px]">국가 없음</span>
                            )}
                          </div>
                          <Select value={campaign.brand_phase ?? '기획'} onValueChange={(v) => handleInlineUpdate(campaign.id, 'brand_phase', v)}>
                            <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent px-1 gap-0.5 w-[90px]">
                              <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 rounded-full', BRAND_PHASE_CONFIG[campaign.brand_phase ?? '기획']?.className)}>
                                {BRAND_PHASE_CONFIG[campaign.brand_phase ?? '기획']?.label ?? '기획'}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {(Object.keys(BRAND_PHASE_CONFIG) as BrandPhase[]).map((p) => (
                                <SelectItem key={p} value={p}><Badge variant="secondary" className={cn('text-[10px] rounded-full', BRAND_PHASE_CONFIG[p].className)}>{BRAND_PHASE_CONFIG[p].label}</Badge></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span className="text-[10px] text-muted-foreground">ROAS</span>
                          <InlineTextCell
                            value={campaign.chatdoc_roas_target?.toString() ?? ''}
                            isEditing={isEditingCell(campaign.id, 'chatdoc_roas_target')}
                            onStartEdit={() => startEdit(campaign.id, 'chatdoc_roas_target')}
                            onSave={(v) => handleInlineUpdate(campaign.id, 'chatdoc_roas_target', v ? Number(v) : null)}
                            type="number"
                            placeholder="-"
                          />
                          <span className="text-[10px] text-muted-foreground">x</span>
                        </div>
                      )}
                    </td>

                    {/* 비용/예산 — 해외: 월고정비용, 제품브랜드: 브랜드예산, 챗닥: 온보딩 */}
                    <td className="py-0.5 px-2 min-w-[100px]">
                      {cType === '해외마케팅' ? (
                        <InlineTextCell
                          value={campaign.monthly_fixed_cost?.toString() ?? ''}
                          isEditing={isEditingCell(campaign.id, 'monthly_fixed_cost')}
                          onStartEdit={() => startEdit(campaign.id, 'monthly_fixed_cost')}
                          onSave={(v) => handleInlineUpdate(campaign.id, 'monthly_fixed_cost', v ? Number(v) : null)}
                          type="number"
                          placeholder="-"
                          className="text-right"
                        />
                      ) : cType === '제품브랜드' ? (
                        <InlineTextCell
                          value={campaign.brand_budget?.toString() ?? ''}
                          isEditing={isEditingCell(campaign.id, 'brand_budget')}
                          onStartEdit={() => startEdit(campaign.id, 'brand_budget')}
                          onSave={(v) => handleInlineUpdate(campaign.id, 'brand_budget', v ? Number(v) : null)}
                          type="number"
                          placeholder="-"
                          className="text-right"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span className="text-[10px] text-muted-foreground">온보딩</span>
                          <Switch
                            checked={campaign.chatdoc_onboarding_done ?? false}
                            onCheckedChange={(v) => handleInlineUpdate(campaign.id, 'chatdoc_onboarding_done', v)}
                            className="scale-75"
                          />
                          <span className={cn('text-[10px]', campaign.chatdoc_onboarding_done ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                            {campaign.chatdoc_onboarding_done ? '완료' : '미완료'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* 섭외당/카테고리 — 해외: 섭외당비용, 제품브랜드: 카테고리, 챗닥: - */}
                    <td className="py-0.5 px-2 min-w-[100px]">
                      {cType === '해외마케팅' ? (
                        <InlineTextCell
                          value={campaign.cost_per_influencer?.toString() ?? ''}
                          isEditing={isEditingCell(campaign.id, 'cost_per_influencer')}
                          onStartEdit={() => startEdit(campaign.id, 'cost_per_influencer')}
                          onSave={(v) => handleInlineUpdate(campaign.id, 'cost_per_influencer', v ? Number(v) : null)}
                          type="number"
                          placeholder="-"
                          className="text-right"
                        />
                      ) : cType === '제품브랜드' ? (
                        <Select value={campaign.product_category ?? ''} onValueChange={(v) => handleInlineUpdate(campaign.id, 'product_category', v || null)}>
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-orange-50/60 px-2 gap-1 w-[100px]">
                            <span className="text-[10px]">{campaign.product_category || <span className="text-muted-foreground/40">카테고리</span>}</span>
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {PRODUCT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground/30 px-2">-</span>
                      )}
                    </td>

                    {/* 원고료 예산 */}
                    <td className="py-0.5 px-2 min-w-[100px]">
                      {cType === '해외마케팅' ? (
                        <InlineTextCell
                          value={campaign.influencer_fee_budget?.toString() ?? ''}
                          isEditing={isEditingCell(campaign.id, 'influencer_fee_budget')}
                          onStartEdit={() => startEdit(campaign.id, 'influencer_fee_budget')}
                          onSave={(v) => handleInlineUpdate(campaign.id, 'influencer_fee_budget', v ? Number(v) : null)}
                          type="number"
                          placeholder="-"
                          className="text-right"
                        />
                      ) : (
                        <span className="text-muted-foreground/30 px-2">-</span>
                      )}
                    </td>

                    {/* 수수료 */}
                    <td className="py-0.5 px-2 min-w-[140px]">
                      {cType === '해외마케팅' ? (
                        <div className="flex items-center gap-1">
                          <InlineTextCell
                            value={campaign.commission_rate?.toString() ?? ''}
                            isEditing={isEditingCell(campaign.id, 'commission_rate')}
                            onStartEdit={() => startEdit(campaign.id, 'commission_rate')}
                            onSave={(v) => handleInlineUpdate(campaign.id, 'commission_rate', v ? Number(v) : null)}
                            type="number"
                            placeholder="-"
                            className="text-right min-w-[50px]"
                          />
                          <span className="text-[10px] text-muted-foreground shrink-0">%</span>
                          <Select
                            value={campaign.vat_type ?? 'VAT별도'}
                            onValueChange={(v) => handleInlineUpdate(campaign.id, 'vat_type', v)}
                          >
                            <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent hover:bg-orange-50/60 px-1 gap-0.5 w-[80px] shrink-0">
                              <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 rounded-full', campaign.vat_type === 'VAT포함' ? 'bg-orange-50 text-orange-600' : 'bg-stone-100 text-stone-500')}>
                                {campaign.vat_type ?? 'VAT별도'}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="VAT별도">
                                <Badge variant="secondary" className="text-[10px] bg-stone-100 text-stone-500 rounded-full">VAT별도</Badge>
                              </SelectItem>
                              <SelectItem value="VAT포함">
                                <Badge variant="secondary" className="text-[10px] bg-orange-50 text-orange-600 rounded-full">VAT포함</Badge>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 px-2">-</span>
                      )}
                    </td>

                    {/* 통역/상태 — 해외: 통역, 챗닥: 챗닥상태, 제품브랜드: - */}
                    <td className="py-0.5 px-2 min-w-[120px]">
                      {cType === '해외마케팅' ? (
                        <Select
                          value={campaign.interpreter_status ?? '통역 필요 없음'}
                          onValueChange={(v) => handleInlineUpdate(campaign.id, 'interpreter_status', v)}
                        >
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-orange-50/60 px-2 gap-1 w-[120px]">
                            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 rounded-full', INTERPRETER_MAP.get((campaign.interpreter_status ?? '통역 필요 없음') as InterpreterStatus)?.className)}>
                              {INTERPRETER_MAP.get((campaign.interpreter_status ?? '통역 필요 없음') as InterpreterStatus)?.label ?? '필요 없음'}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {INTERPRETER_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <Badge variant="secondary" className={cn('text-[10px] rounded-full', opt.className)}>{opt.label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : cType === '국내챗닥' ? (
                        <Select
                          value={campaign.chatdoc_status ?? '대기'}
                          onValueChange={(v) => handleInlineUpdate(campaign.id, 'chatdoc_status', v)}
                        >
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-orange-50/60 px-2 gap-1 w-[100px]">
                            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 rounded-full', CHATDOC_STATUS_CONFIG[(campaign.chatdoc_status ?? '대기') as ChatdocStatus].className)}>
                              {CHATDOC_STATUS_CONFIG[(campaign.chatdoc_status ?? '대기') as ChatdocStatus].label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {(Object.keys(CHATDOC_STATUS_CONFIG) as ChatdocStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                <Badge variant="secondary" className={cn('text-[10px] rounded-full', CHATDOC_STATUS_CONFIG[s].className)}>{CHATDOC_STATUS_CONFIG[s].label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground/30 px-2">-</span>
                      )}
                    </td>

                    {/* 홈페이지 */}
                    <td className="py-0.5 px-2 min-w-[120px]">
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
                          className="cursor-pointer px-2 py-1 rounded hover:bg-orange-50/60 transition-colors min-h-[28px] flex items-center gap-1"
                        >
                          {campaign.homepage_url ? (
                            <>
                              <a href={campaign.homepage_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-foreground hover:underline truncate max-w-[100px]">
                                {(() => { try { return new URL(campaign.homepage_url).hostname; } catch { return campaign.homepage_url; } })()}
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
                    <td className="py-0.5 px-2">
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
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-stone-400 text-sm">
                      {search ? '검색 결과가 없어요. 다른 키워드로 찾아볼까요?' : '아직 캠페인이 없어요. 첫 캠페인을 추가해 보세요!'}
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
        <DialogContent className="sm:max-w-lg bg-card border-stone-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">새 캠페인 만들기</DialogTitle>
            <DialogDescription className="text-[13px] text-stone-500">새로운 캠페인 정보를 입력해 주세요.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 캠페인 유형 선택 */}
            <div className="flex gap-2 p-1 bg-stone-100 rounded-xl">
              {(Object.keys(CAMPAIGN_TYPE_CONFIG) as CampaignType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, campaign_type: type }))}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-[13px] font-medium transition-all',
                    formData.campaign_type === type
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  )}
                >
                  {CAMPAIGN_TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>

            {/* 공통 필드 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaign_name" className="text-[13px] font-medium">캠페인명 *</Label>
                <Input
                  id="campaign_name"
                  required
                  value={formData.campaign_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, campaign_name: e.target.value }))}
                  placeholder={formData.campaign_type === '국내챗닥' ? '예: 밝은눈안과 강남점' : formData.campaign_type === '제품브랜드' ? '예: 브랜드명 동남아 진출' : '예: 태국 마케팅'}
                  className="h-9 bg-secondary/50 border-border text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_name" className="text-[13px] font-medium">클라이언트 *</Label>
                <Input
                  id="client_name"
                  required
                  value={formData.client_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, client_name: e.target.value }))}
                  placeholder={formData.campaign_type === '국내챗닥' ? '예: 밝은눈안과' : formData.campaign_type === '제품브랜드' ? '예: 뷰티브랜드' : '예: ABC Corp'}
                  className="h-9 bg-secondary/50 border-border text-[13px]"
                />
              </div>
            </div>

            {/* 타입별 전용 필드 */}
            {formData.campaign_type === '해외마케팅' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="target_country" className="text-[13px] font-medium">대상 국가</Label>
                    <Input
                      id="target_country"
                      value={formData.target_country}
                      onChange={(e) => setFormData((prev) => ({ ...prev, target_country: e.target.value }))}
                      className="h-9 bg-secondary/50 border-border text-[13px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium">단계</Label>
                    <Select value={formData.phase} onValueChange={(v) => setFormData((prev) => ({ ...prev, phase: v as CampaignPhase }))}>
                      <SelectTrigger className="w-full h-9 bg-secondary/50 border-border text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="scaling">Scaling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_fixed_cost" className="text-[13px] font-medium">월 고정비용</Label>
                    <Input id="monthly_fixed_cost" type="number" value={formData.monthly_fixed_cost} onChange={(e) => setFormData((prev) => ({ ...prev, monthly_fixed_cost: e.target.value }))} className="h-9 bg-secondary/50 border-border text-[13px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_per_influencer" className="text-[13px] font-medium">섭외당 비용</Label>
                    <Input id="cost_per_influencer" type="number" value={formData.cost_per_influencer} onChange={(e) => setFormData((prev) => ({ ...prev, cost_per_influencer: e.target.value }))} className="h-9 bg-secondary/50 border-border text-[13px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="influencer_fee_budget" className="text-[13px] font-medium">원고료 예산</Label>
                    <Input id="influencer_fee_budget" type="number" value={formData.influencer_fee_budget} onChange={(e) => setFormData((prev) => ({ ...prev, influencer_fee_budget: e.target.value }))} className="h-9 bg-secondary/50 border-border text-[13px]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commission_rate" className="text-[13px] font-medium">수수료 (%)</Label>
                    <Input id="commission_rate" type="number" step="0.1" value={formData.commission_rate} onChange={(e) => setFormData((prev) => ({ ...prev, commission_rate: e.target.value }))} placeholder="예: 10" className="h-9 bg-secondary/50 border-border text-[13px]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium">VAT 구분</Label>
                    <Select value={formData.vat_type} onValueChange={(v) => setFormData((prev) => ({ ...prev, vat_type: v as VatType }))}>
                      <SelectTrigger className="w-full h-9 bg-secondary/50 border-border text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VAT별도">VAT별도</SelectItem>
                        <SelectItem value="VAT포함">VAT포함</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px] font-medium">통역사배치여부</Label>
                  <Select value={formData.interpreter_status} onValueChange={(v) => setFormData((prev) => ({ ...prev, interpreter_status: v as InterpreterStatus }))}>
                    <SelectTrigger className="w-full h-9 bg-secondary/50 border-border text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERPRETER_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.value}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : formData.campaign_type === '제품브랜드' ? (
              /* 제품브랜드 전용 필드 */
              <>
                <div className="space-y-2">
                  <Label className="text-[13px] font-medium">타겟 국가 (복수 선택)</Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-lg min-h-[40px]">
                    {TARGET_COUNTRY_OPTIONS.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          target_countries: prev.target_countries.includes(country)
                            ? prev.target_countries.filter((c) => c !== country)
                            : [...prev.target_countries, country],
                        }))}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                          formData.target_countries.includes(country)
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-stone-100 text-stone-500 border-transparent hover:bg-stone-200'
                        )}
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium">제품 카테고리</Label>
                    <Select value={formData.product_category} onValueChange={(v) => setFormData((prev) => ({ ...prev, product_category: v }))}>
                      <SelectTrigger className="w-full h-9 bg-secondary/50 border-border text-[13px]"><SelectValue placeholder="카테고리 선택" /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand_budget" className="text-[13px] font-medium">브랜드 예산</Label>
                    <Input
                      id="brand_budget"
                      type="number"
                      value={formData.brand_budget}
                      onChange={(e) => setFormData((prev) => ({ ...prev, brand_budget: e.target.value }))}
                      placeholder="예: 50000000"
                      className="h-9 bg-secondary/50 border-border text-[13px]"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* 국내챗닥 전용 필드 */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium">챗닥 상태</Label>
                    <Select value={formData.chatdoc_status} onValueChange={(v) => setFormData((prev) => ({ ...prev, chatdoc_status: v as ChatdocStatus }))}>
                      <SelectTrigger className="w-full h-9 bg-secondary/50 border-border text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CHATDOC_STATUS_CONFIG) as ChatdocStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chatdoc_roas_target" className="text-[13px] font-medium">ROAS 목표 (배수)</Label>
                    <Input
                      id="chatdoc_roas_target"
                      type="number"
                      step="0.1"
                      value={formData.chatdoc_roas_target}
                      onChange={(e) => setFormData((prev) => ({ ...prev, chatdoc_roas_target: e.target.value }))}
                      placeholder="예: 3.5"
                      className="h-9 bg-secondary/50 border-border text-[13px]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                  <Switch
                    checked={formData.chatdoc_onboarding_done}
                    onCheckedChange={(v) => setFormData((prev) => ({ ...prev, chatdoc_onboarding_done: v }))}
                  />
                  <div>
                    <Label className="cursor-pointer text-[13px] font-medium">온보딩 완료 여부</Label>
                    <p className="text-[11px] text-muted-foreground">챗닥 온보딩이 완료되었는지 체크합니다</p>
                  </div>
                </div>
              </>
            )}

            {/* 공통 하단 필드 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">상태</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as CampaignStatus }))}>
                  <SelectTrigger className="w-full h-9 bg-secondary/50 border-border text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-[13px] font-medium">시작일</Label>
                <Input id="start_date" type="date" value={formData.start_date} onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))} className="h-9 bg-secondary/50 border-border text-[13px]" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="homepage_url" className="text-[13px] font-medium">홈페이지 URL</Label>
              <Input id="homepage_url" type="url" value={formData.homepage_url} onChange={(e) => setFormData((prev) => ({ ...prev, homepage_url: e.target.value }))} className="h-9 bg-secondary/50 border-border text-[13px]" />
            </div>

            {/* 협업상품 선택 */}
            {collabProducts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">협업상품 (복수 선택 가능)</Label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
                  {collabProducts.map((product) => (
                    <label key={product.id} className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 rounded px-2 py-1.5 transition-colors">
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProductIds((prev) =>
                            checked
                              ? [...prev, product.id]
                              : prev.filter((id) => id !== product.id)
                          );
                        }}
                      />
                      <span className="text-[12px] text-stone-700">{product.product_name}</span>
                    </label>
                  ))}
                </div>
                {selectedProductIds.length > 0 && (
                  <p className="text-[11px] text-stone-500">{selectedProductIds.length}개 상품 선택됨 — 캠페인 등록 시 워크플로우가 자동 생성됩니다</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-stone-200">취소</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-orange-500 text-white hover:bg-orange-600 rounded-xl">
                {createMutation.isPending ? '저장 중...' : '등록'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-stone-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">캠페인을 삭제할까요?</DialogTitle>
            <DialogDescription className="text-[13px] text-stone-500">
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
              className="rounded-xl border-stone-200"
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
