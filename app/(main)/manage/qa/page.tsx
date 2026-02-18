'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  MessageSquareWarning,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { logActivity } from '@/lib/utils/log-activity';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Campaign,
  CampaignQa,
  QaType,
  QaStatus,
  QaPriority,
} from '@/lib/types/database';

/* ── Constants ──────────────────────── */

const QA_TYPES: QaType[] = ['요청사항', '불만사항', '개선사항', '버그', '기타'];
const QA_STATUSES: QaStatus[] = ['미해결', '진행중', '해결완료'];
const QA_PRIORITIES: QaPriority[] = ['긴급', '높음', '보통', '낮음'];

const QA_TYPE_CONFIG: Record<QaType, { icon: React.ElementType; color: string; bg: string }> = {
  '요청사항': { icon: MessageSquareWarning, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  '불만사항': { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  '개선사항': { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  '버그': { icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  '기타': { icon: MessageSquareWarning, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-950/30' },
};

const QA_STATUS_CONFIG: Record<QaStatus, { color: string; bg: string; border: string }> = {
  '미해결': { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
  '진행중': { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
  '해결완료': { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
};

const QA_PRIORITY_CONFIG: Record<QaPriority, { color: string; bg: string }> = {
  '긴급': { color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-950/40' },
  '높음': { color: 'text-orange-700', bg: 'bg-orange-100 dark:bg-orange-950/40' },
  '보통': { color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-950/40' },
  '낮음': { color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-950/40' },
};

/* ── Form Data ──────────────────────── */

interface QaFormData {
  campaign_id: string;
  qa_type: QaType;
  content: string;
  due_date: string;
  status: QaStatus;
  resolution: string;
  priority: QaPriority;
  created_by: string;
}

const defaultFormData: QaFormData = {
  campaign_id: '',
  qa_type: '요청사항',
  content: '',
  due_date: '',
  status: '미해결',
  resolution: '',
  priority: '보통',
  created_by: '',
};

/* ── Due Date Helper ──────────────────── */

function DueDateBadge({ dueDate, status }: { dueDate: string | null; status: QaStatus }) {
  if (!dueDate) return <span className="text-[10px] text-muted-foreground">-</span>;

  const parsed = parseISO(dueDate);
  const daysLeft = differenceInDays(parsed, new Date());
  const overdue = isPast(parsed) && !isToday(parsed);
  const isResolved = status === '해결완료';

  let color = 'text-muted-foreground';
  let bgColor = '';
  if (!isResolved) {
    if (overdue) {
      color = 'text-red-600 font-semibold';
      bgColor = 'bg-red-50 dark:bg-red-950/30';
    } else if (daysLeft <= 3) {
      color = 'text-amber-600 font-medium';
      bgColor = 'bg-amber-50 dark:bg-amber-950/30';
    }
  }

  return (
    <span className={cn('text-[11px] tabular-nums px-1.5 py-0.5 rounded', color, bgColor)}>
      {format(parsed, 'MM/dd')}
      {!isResolved && overdue && ' (지남)'}
      {!isResolved && !overdue && daysLeft <= 3 && ` (D-${daysLeft})`}
    </span>
  );
}

/* ── Main Page ──────────────────────── */

export default function CampaignQaPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQa, setEditingQa] = useState<CampaignQa | null>(null);
  const [formData, setFormData] = useState<QaFormData>(defaultFormData);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ── Data Fetching ──

  const { data: campaigns = [] } = useQuery({
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

  const campaignMap = useMemo(() => {
    const map = new Map<string, Campaign>();
    campaigns.forEach((c) => map.set(c.id, c));
    return map;
  }, [campaigns]);

  const { data: qaItems = [], isLoading } = useQuery({
    queryKey: queryKeys.qa.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_qa')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CampaignQa[];
    },
  });

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async (data: QaFormData) => {
      const insertData: Record<string, unknown> = {
        campaign_id: data.campaign_id,
        qa_type: data.qa_type,
        content: data.content,
        status: data.status,
        priority: data.priority,
        created_by: data.created_by || null,
      };
      if (data.due_date) insertData.due_date = data.due_date;
      if (data.resolution) insertData.resolution = data.resolution;

      const { data: result, error } = await supabase
        .from('campaign_qa')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return result as CampaignQa;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qa.all });
      logActivity({
        userId: profile?.id,
        actionType: 'insert',
        targetTable: 'campaign_qa',
        targetId: data.id,
        newValue: { qa_type: data.qa_type, campaign_id: data.campaign_id, status: data.status },
      });
      setDialogOpen(false);
      setFormData(defaultFormData);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QaFormData> }) => {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.campaign_id !== undefined) updateData.campaign_id = data.campaign_id;
      if (data.qa_type !== undefined) updateData.qa_type = data.qa_type;
      if (data.content !== undefined) updateData.content = data.content;
      if (data.due_date !== undefined) updateData.due_date = data.due_date || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.resolution !== undefined) updateData.resolution = data.resolution || null;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.created_by !== undefined) updateData.created_by = data.created_by || null;

      const { data: result, error } = await supabase
        .from('campaign_qa')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as CampaignQa;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qa.all });
      logActivity({
        userId: profile?.id,
        actionType: 'update',
        targetTable: 'campaign_qa',
        targetId: data.id,
        newValue: { qa_type: data.qa_type, status: data.status },
      });
      setDialogOpen(false);
      setEditingQa(null);
      setFormData(defaultFormData);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_qa').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qa.all });
      logActivity({
        userId: profile?.id,
        actionType: 'delete',
        targetTable: 'campaign_qa',
        targetId: id,
      });
    },
  });

  const inlineStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QaStatus }) => {
      const { error } = await supabase
        .from('campaign_qa')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.qa.all });
      const previous = queryClient.getQueryData<CampaignQa[]>(queryKeys.qa.all);
      queryClient.setQueryData(queryKeys.qa.all, (old: CampaignQa[] | undefined) =>
        (old || []).map((item) => (item.id === id ? { ...item, status } : item))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.qa.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qa.all });
    },
  });

  // ── Filtered data ──

  const filteredQa = useMemo(() => {
    let result = qaItems;
    if (campaignFilter !== 'all') {
      result = result.filter((q) => q.campaign_id === campaignFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((q) => q.status === statusFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter((q) => q.qa_type === typeFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter((q) => q.priority === priorityFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.content.toLowerCase().includes(q) ||
          (item.resolution && item.resolution.toLowerCase().includes(q)) ||
          (item.created_by && item.created_by.toLowerCase().includes(q))
      );
    }
    return result;
  }, [qaItems, campaignFilter, statusFilter, typeFilter, priorityFilter, searchQuery]);

  // ── Stats ──

  const stats = useMemo(() => {
    const total = qaItems.length;
    const unresolved = qaItems.filter((q) => q.status === '미해결').length;
    const inProgress = qaItems.filter((q) => q.status === '진행중').length;
    const resolved = qaItems.filter((q) => q.status === '해결완료').length;
    const overdue = qaItems.filter((q) => {
      if (q.status === '해결완료' || !q.due_date) return false;
      return isPast(parseISO(q.due_date)) && !isToday(parseISO(q.due_date));
    }).length;
    return { total, unresolved, inProgress, resolved, overdue };
  }, [qaItems]);

  // ── Handlers ──

  const handleOpenCreate = useCallback(() => {
    setEditingQa(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((qa: CampaignQa) => {
    setEditingQa(qa);
    setFormData({
      campaign_id: qa.campaign_id,
      qa_type: qa.qa_type,
      content: qa.content,
      due_date: qa.due_date ?? '',
      status: qa.status,
      resolution: qa.resolution ?? '',
      priority: qa.priority,
      created_by: qa.created_by ?? '',
    });
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!formData.campaign_id || !formData.content.trim()) return;
    if (editingQa) {
      updateMutation.mutate({ id: editingQa.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [formData, editingQa, createMutation, updateMutation]);

  const handleDelete = useCallback((id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleStatusCycle = useCallback((qa: CampaignQa) => {
    const cycle: QaStatus[] = ['미해결', '진행중', '해결완료'];
    const idx = cycle.indexOf(qa.status);
    const next = cycle[(idx + 1) % cycle.length];
    inlineStatusMutation.mutate({ id: qa.id, status: next });
  }, [inlineStatusMutation]);

  // ── Group by campaign ──

  const groupedByCampaign = useMemo(() => {
    const map = new Map<string, CampaignQa[]>();
    for (const qa of filteredQa) {
      const list = map.get(qa.campaign_id) || [];
      list.push(qa);
      map.set(qa.campaign_id, list);
    }
    return Array.from(map.entries()).map(([cId, items]) => ({
      campaign: campaignMap.get(cId),
      campaignId: cId,
      items,
      unresolvedCount: items.filter((q) => q.status !== '해결완료').length,
    })).sort((a, b) => b.unresolvedCount - a.unresolvedCount);
  }, [filteredQa, campaignMap]);

  return (
    <TooltipProvider>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {/* Header */}
        <motion.div variants={fadeUpItem}>
          <h1 className="text-xl font-bold tracking-tight">캠페인 QA 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            캠페인별 요청사항, 불만사항 등 QA 이슈를 체계적으로 관리합니다.
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={fadeUpItem} className="grid grid-cols-5 gap-3">
          {[
            { label: '전체', value: stats.total, color: 'text-foreground', bg: 'bg-card' },
            { label: '미해결', value: stats.unresolved, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
            { label: '진행중', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
            { label: '해결완료', value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
            { label: '기한초과', value: stats.overdue, color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/30' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl border p-3', s.bg)}>
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
              <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Filters & Actions */}
        <motion.div variants={fadeUpItem}>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
            <Filter className="size-4 text-muted-foreground shrink-0" />
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="캠페인 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 캠페인</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.client_name} - {c.campaign_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                {QA_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                {QA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="우선순위" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 우선순위</SelectItem>
                {QA_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="내용 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {filteredQa.length}건
            </Badge>
            <Button size="sm" className="gap-1.5 ml-auto shrink-0" onClick={handleOpenCreate}>
              <Plus className="size-3.5" />
              QA 등록
            </Button>
          </div>
        </motion.div>

        {/* QA Table - Grouped by Campaign */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
              <span className="text-sm">데이터를 불러오는 중...</span>
            </div>
          </div>
        ) : filteredQa.length === 0 ? (
          <motion.div variants={fadeUpItem}>
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <MessageSquareWarning className="size-8 opacity-30" />
              <span className="text-sm">등록된 QA가 없습니다.</span>
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={handleOpenCreate}>
                <Plus className="size-3.5" />
                첫 QA 등록하기
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={fadeUpItem} className="space-y-3">
            {groupedByCampaign.map(({ campaign, campaignId, items, unresolvedCount }) => (
              <div key={campaignId} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {/* Campaign Group Header */}
                <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold truncate">
                      {campaign ? `${campaign.client_name} - ${campaign.campaign_name}` : campaignId}
                    </span>
                    {campaign?.target_country && (
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-2">
                        {campaign.target_country}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unresolvedCount > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                        미해결 {unresolvedCount}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      총 {items.length}건
                    </Badge>
                  </div>
                </div>

                {/* QA Items Table */}
                <div className="overflow-hidden">
                  <table className="w-full table-fixed text-left">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[4%]"></th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[8%]">유형</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[8%]">우선순위</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[32%]">내용</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[8%]">작성자</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[9%]">기한</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[10%]">상태</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[8%]">등록일</th>
                        <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[13%] text-right">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((qa) => {
                        const typeCfg = QA_TYPE_CONFIG[qa.qa_type];
                        const statusCfg = QA_STATUS_CONFIG[qa.status];
                        const priorityCfg = QA_PRIORITY_CONFIG[qa.priority];
                        const TypeIcon = typeCfg.icon;
                        const isExpanded = expandedRows.has(qa.id);

                        return (
                          <tr
                            key={qa.id}
                            className={cn(
                              'border-b border-border/30 hover:bg-muted/20 transition-colors',
                              qa.status === '해결완료' && 'opacity-60'
                            )}
                          >
                            {/* Expand */}
                            <td className="px-3 py-1.5">
                              {qa.resolution && (
                                <button type="button" onClick={() => toggleRow(qa.id)} className="text-muted-foreground hover:text-foreground">
                                  {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                </button>
                              )}
                            </td>
                            {/* Type */}
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 gap-0.5', typeCfg.color, typeCfg.bg)}>
                                <TypeIcon className="size-2.5" />
                                {qa.qa_type}
                              </Badge>
                            </td>
                            {/* Priority */}
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', priorityCfg.color, priorityCfg.bg)}>
                                {qa.priority}
                              </Badge>
                            </td>
                            {/* Content */}
                            <td className="px-3 py-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-[11px] text-foreground truncate cursor-default">{qa.content}</p>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[400px]">
                                  <p className="text-xs whitespace-pre-wrap">{qa.content}</p>
                                </TooltipContent>
                              </Tooltip>
                              {isExpanded && qa.resolution && (
                                <div className="mt-1 p-2 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                                  <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 mb-0.5">해결 내용:</p>
                                  <p className="text-[11px] text-foreground/80 whitespace-pre-wrap">{qa.resolution}</p>
                                </div>
                              )}
                            </td>
                            {/* Created By */}
                            <td className="px-3 py-1.5">
                              <span className="text-[11px] text-muted-foreground truncate block">{qa.created_by || '-'}</span>
                            </td>
                            {/* Due Date */}
                            <td className="px-3 py-1.5">
                              <DueDateBadge dueDate={qa.due_date} status={qa.status} />
                            </td>
                            {/* Status */}
                            <td className="px-3 py-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusCycle(qa)}
                                    className={cn(
                                      'text-[10px] font-medium px-2 py-0.5 rounded-full border cursor-pointer transition-all hover:scale-105',
                                      statusCfg.color,
                                      statusCfg.bg,
                                      statusCfg.border
                                    )}
                                  >
                                    {qa.status}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">클릭하여 상태 변경</p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            {/* Created At */}
                            <td className="px-3 py-1.5">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {format(parseISO(qa.created_at), 'MM/dd')}
                              </span>
                            </td>
                            {/* Actions */}
                            <td className="px-3 py-1.5">
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => handleOpenEdit(qa)}
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>수정</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDelete(qa.id)}
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>삭제</TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingQa ? 'QA 수정' : 'QA 등록'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Campaign Select */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">캠페인 *</label>
                <Select
                  value={formData.campaign_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, campaign_id: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="캠페인을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.client_name} - {c.campaign_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type + Priority Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">유형 *</label>
                  <Select
                    value={formData.qa_type}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, qa_type: v as QaType }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QA_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">우선순위</label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, priority: v as QaPriority }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QA_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">QA 내용 *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="QA 내용을 입력하세요..."
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              {/* Due Date + Status + Created By Row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">기한</label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">상태</label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as QaStatus }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QA_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">작성자</label>
                  <Input
                    value={formData.created_by}
                    onChange={(e) => setFormData((prev) => ({ ...prev, created_by: e.target.value }))}
                    placeholder="이름"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">해결 상세내용</label>
                <textarea
                  value={formData.resolution}
                  onChange={(e) => setFormData((prev) => ({ ...prev, resolution: e.target.value }))}
                  placeholder="해결 내용을 입력하세요 (해결 후 작성)..."
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  취소
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.campaign_id || !formData.content.trim() || createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? '저장 중...' : editingQa ? '수정' : '등록'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </TooltipProvider>
  );
}
