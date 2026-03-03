'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  MessageSquareWarning,
  AlertCircle,
  CheckCircle2,
  Filter,
  Trash2,
  Check,
  ChevronsUpDown,
  Bot,
  Users,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Campaign,
  CampaignQa,
  User,
  QaType,
  QaStatus,
  QaPriority,
} from '@/lib/types/database';

/* ── Constants ──────────────────────── */

const QA_TYPES: QaType[] = ['요청사항', '불만사항', '개선사항', '버그', '기타'];
const QA_STATUSES: QaStatus[] = ['미해결', '진행중', '해결완료'];
const QA_PRIORITIES: QaPriority[] = ['긴급', '높음', '보통', '낮음'];

const QA_TYPE_CONFIG: Record<QaType, { icon: React.ElementType; color: string; bg: string }> = {
  '요청사항': { icon: MessageSquareWarning, color: 'text-orange-600', bg: 'bg-orange-50' },
  '불만사항': { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  '개선사항': { icon: CheckCircle2, color: 'text-amber-600', bg: 'bg-amber-50' },
  '버그': { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  '기타': { icon: MessageSquareWarning, color: 'text-stone-500', bg: 'bg-stone-50' },
};

const QA_STATUS_CONFIG: Record<QaStatus, { color: string; bg: string; border: string }> = {
  '미해결': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  '진행중': { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  '해결완료': { color: 'text-stone-400', bg: 'bg-stone-50', border: 'border-stone-200' },
};

const QA_PRIORITY_CONFIG: Record<QaPriority, { color: string; bg: string }> = {
  '긴급': { color: 'text-rose-600', bg: 'bg-rose-50' },
  '높음': { color: 'text-orange-600', bg: 'bg-orange-50' },
  '보통': { color: 'text-stone-500', bg: 'bg-stone-50' },
  '낮음': { color: 'text-stone-400', bg: 'bg-stone-50/50' },
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
  assigned_to: string;
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
  assigned_to: '',
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
      color = 'text-destructive font-semibold';
      bgColor = 'bg-destructive/10';
    } else if (daysLeft <= 3) {
      color = 'text-foreground font-medium';
      bgColor = 'bg-secondary';
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

/* ── Inline Edit Cells ──────────────────── */

function InlineTextCell({
  value,
  qaId,
  field,
  placeholder,
  textColor,
  onUpdate,
}: {
  value: string | null;
  qaId: string;
  field: string;
  placeholder?: string;
  textColor?: string;
  onUpdate: (id: string, field: string, val: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleStart = () => {
    setText(value || '');
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleSave = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed !== (value || '')) {
      onUpdate(qaId, field, trimmed || null);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSave(); }
        }}
        className="w-full text-[11px] bg-secondary/50 border border-border rounded px-1.5 py-1 outline-none resize-none min-h-[32px] focus:ring-1 focus:ring-foreground/20"
        rows={2}
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleStart}
          className={cn(
            'w-full text-left text-[11px] truncate cursor-text rounded px-0.5 hover:bg-orange-50 transition-colors min-h-[20px]',
            value ? (textColor || 'text-foreground') : 'text-muted-foreground/40'
          )}
        >
          {value || (placeholder || '클릭하여 입력')}
        </button>
      </TooltipTrigger>
      {value && (
        <TooltipContent side="bottom" className="max-w-[400px]">
          <p className="text-xs whitespace-pre-wrap">{value}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

function InlineDateCell({
  value,
  qaId,
  status,
  onUpdate,
}: {
  value: string | null;
  qaId: string;
  status: QaStatus;
  onUpdate: (id: string, field: string, val: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleStart = () => {
    setEditing(true);
    setTimeout(() => ref.current?.showPicker?.(), 50);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setEditing(false);
    if (newVal !== (value || '')) {
      onUpdate(qaId, 'due_date', newVal || null);
    }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="date"
        defaultValue={value || ''}
        onChange={handleChange}
        onBlur={() => setEditing(false)}
        className="text-[10px] bg-secondary/50 border border-border rounded px-1 py-0.5 outline-none w-full focus:ring-1 focus:ring-foreground/20"
      />
    );
  }

  return (
    <button type="button" onClick={handleStart} className="cursor-pointer hover:bg-orange-50 rounded px-0.5 transition-colors">
      <DueDateBadge dueDate={value} status={status} />
    </button>
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
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'campaign' | 'assignee'>('campaign');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQa, setEditingQa] = useState<CampaignQa | null>(null);
  const [formData, setFormData] = useState<QaFormData>(defaultFormData);
  const [campaignSearchOpen, setCampaignSearchOpen] = useState(false);

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

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as User[];
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
        assigned_to: data.assigned_to || null,
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
      if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to || null;

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

  const inlineFieldMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase
        .from('campaign_qa')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.qa.all });
      const previous = queryClient.getQueryData<CampaignQa[]>(queryKeys.qa.all);
      queryClient.setQueryData(queryKeys.qa.all, (old: CampaignQa[] | undefined) =>
        (old || []).map((item) => (item.id === id ? { ...item, [field]: value } : item))
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

  const handleInlineUpdate = useCallback((id: string, field: string, value: unknown) => {
    inlineFieldMutation.mutate({ id, field, value });
  }, [inlineFieldMutation]);

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
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        result = result.filter((q) => !q.assigned_to);
      } else {
        result = result.filter((q) => q.assigned_to === assigneeFilter);
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.content.toLowerCase().includes(q) ||
          (item.resolution && item.resolution.toLowerCase().includes(q)) ||
          (item.created_by && item.created_by.toLowerCase().includes(q)) ||
          (item.assigned_to && item.assigned_to.toLowerCase().includes(q))
      );
    }
    return result;
  }, [qaItems, campaignFilter, statusFilter, typeFilter, priorityFilter, assigneeFilter, searchQuery]);

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

  const groupedByAssignee = useMemo(() => {
    const map = new Map<string, CampaignQa[]>();
    for (const qa of filteredQa) {
      const key = qa.assigned_to || '미배정';
      const list = map.get(key) || [];
      list.push(qa);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([assignee, items]) => ({
      assignee,
      items,
      unresolvedCount: items.filter((q) => q.status !== '해결완료').length,
    })).sort((a, b) => {
      if (a.assignee === '미배정') return 1;
      if (b.assignee === '미배정') return -1;
      return b.unresolvedCount - a.unresolvedCount;
    });
  }, [filteredQa]);

  return (
    <TooltipProvider>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {/* Header */}
        <motion.div variants={fadeUpItem} className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-50">
            <MessageSquareWarning className="size-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">QA 이슈, 놓치지 않게 관리해줄게.</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              요청사항부터 버그까지, 우선순위별로 깔끔하게 정리하고 함께 해결해요.
            </p>
          </div>
        </motion.div>

        {/* AI Agent Guide Banner */}
        <motion.div variants={fadeUpItem}>
          <div className="relative rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3.5 overflow-hidden">
            <div className="flex gap-3 items-start relative">
              <div className="relative shrink-0 mt-0.5">
                <div className="size-9 rounded-full bg-orange-500 flex items-center justify-center">
                  <Bot className="size-4 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-amber-400 border-2 border-white" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold text-stone-800">bkit AI Agent</p>
                  <span className="text-[9px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">QA 관리 가이드</span>
                </div>
                <div className="text-[11px] text-stone-500 leading-[1.7] space-y-1">
                  <p>안녕하세요! QA 관리 페이지에 오신 걸 환영해요.</p>
                  <div className="bg-white/70 rounded-xl px-3 py-2 space-y-0.5 border border-orange-100">
                    <p>캠페인 진행 중 발생하는 <strong className="text-stone-700">요청사항, 불만사항, 개선사항, 버그</strong> 등을 이곳에 등록해 주세요.</p>
                    <p><strong className="text-stone-700">우선순위</strong>를 정확히 설정하면 긴급한 이슈부터 빠르게 처리할 수 있어요.</p>
                  </div>
                  <p className="text-[10px] text-stone-400">QA를 꼼꼼하게 관리하면 고객 만족도가 크게 향상돼요!</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={fadeUpItem} className="grid grid-cols-5 gap-3">
          {[
            { label: '전체', value: stats.total, color: 'text-stone-700', bg: 'bg-white' },
            { label: '미해결', value: stats.unresolved, color: 'text-rose-600', bg: 'bg-rose-50' },
            { label: '진행중', value: stats.inProgress, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: '해결완료', value: stats.resolved, color: 'text-stone-400', bg: 'bg-stone-50' },
            { label: '기한초과', value: stats.overdue, color: 'text-rose-600', bg: 'bg-rose-50' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-2xl border border-stone-100 p-3 shadow-sm', s.bg)}>
              <p className="text-[10px] text-stone-500 font-medium">{s.label}</p>
              <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Filters & Actions */}
        <motion.div variants={fadeUpItem}>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-100 bg-white p-3 shadow-sm">
            <Filter className="size-4 text-stone-400 shrink-0" />
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
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="실행자" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 실행자</SelectItem>
                <SelectItem value="unassigned">미배정</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center border border-stone-200 rounded-full h-8 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setGroupBy('campaign')}
                className={cn(
                  'px-2.5 h-full text-[10px] font-medium transition-colors',
                  groupBy === 'campaign' ? 'bg-orange-500 text-white' : 'hover:bg-orange-50 text-stone-500'
                )}
              >
                캠페인별
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('assignee')}
                className={cn(
                  'px-2.5 h-full text-[10px] font-medium transition-colors',
                  groupBy === 'assignee' ? 'bg-orange-500 text-white' : 'hover:bg-orange-50 text-stone-500'
                )}
              >
                실행자별
              </button>
            </div>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="내용 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Badge variant="secondary" className="text-[11px] rounded-full shrink-0">
              {filteredQa.length}건
            </Badge>
            <Button size="sm" className="gap-1.5 ml-auto shrink-0 bg-orange-500 text-white hover:bg-orange-600 rounded-full" onClick={handleOpenCreate}>
              <Plus className="size-3.5" />
              QA 등록
            </Button>
          </div>
        </motion.div>

        {/* QA Table - Grouped by Campaign */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-stone-400">
              <div className="size-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
              <span className="text-sm">데이터를 불러오는 중이에요...</span>
            </div>
          </div>
        ) : filteredQa.length === 0 ? (
          <motion.div variants={fadeUpItem}>
            <div className="flex flex-col items-center justify-center py-16 text-stone-400 gap-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-50">
                <MessageSquareWarning className="size-6 text-orange-400" />
              </div>
              <span className="text-sm text-stone-500">아직 등록된 QA가 없어요. 첫 번째 이슈를 등록해 볼까요?</span>
              <Button variant="outline" size="sm" className="mt-2 gap-1.5 rounded-full border-orange-200 text-orange-600 hover:bg-orange-50" onClick={handleOpenCreate}>
                <Plus className="size-3.5" />
                첫 QA 등록하기
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={fadeUpItem} className="space-y-3">
            {(groupBy === 'campaign' ? groupedByCampaign : groupedByAssignee).map((group) => {
              const groupKey = groupBy === 'campaign'
                ? (group as (typeof groupedByCampaign)[number]).campaignId
                : (group as (typeof groupedByAssignee)[number]).assignee;
              const items = group.items;
              const unresolvedCount = group.unresolvedCount;
              const campaign = groupBy === 'campaign'
                ? (group as (typeof groupedByCampaign)[number]).campaign
                : undefined;
              const assigneeName = groupBy === 'assignee'
                ? (group as (typeof groupedByAssignee)[number]).assignee
                : undefined;

              return (
              <div key={groupKey} className="rounded-2xl border border-stone-100 bg-white overflow-hidden shadow-sm">
                {/* Group Header */}
                <div className="px-3 py-2 border-b border-stone-100 bg-stone-50/50 flex items-center gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {groupBy === 'assignee' && <Users className="size-3.5 text-muted-foreground shrink-0" />}
                    <span className="text-[12px] font-semibold truncate">
                      {groupBy === 'campaign'
                        ? (campaign ? `${campaign.client_name} - ${campaign.campaign_name}` : groupKey)
                        : assigneeName}
                    </span>
                    {groupBy === 'campaign' && campaign?.target_country && (
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 rounded-full">
                        {campaign.target_country}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unresolvedCount > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0 rounded-full">
                        미해결 {unresolvedCount}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
                      총 {items.length}건
                    </Badge>
                  </div>
                </div>

                {/* QA Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-left min-w-[800px]">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50">
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[11%]">캠페인</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[6%]">유형</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[6%]">우선순위</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[20%]">내용</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[14%]">해결 상세내용</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[7%]">작성자</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[7%]">실행자</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[6%]">기한</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[7%]">상태</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[6%]">등록일</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-stone-500 w-[10%] text-right">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((qa) => {
                        const typeCfg = QA_TYPE_CONFIG[qa.qa_type];
                        const statusCfg = QA_STATUS_CONFIG[qa.status];
                        const priorityCfg = QA_PRIORITY_CONFIG[qa.priority];

                        return (
                          <tr
                            key={qa.id}
                            className={cn(
                              'border-b border-stone-50 hover:bg-orange-50/40 transition-colors',
                              qa.status === '해결완료' && 'opacity-60'
                            )}
                          >
                            {/* Campaign - inline select */}
                            <td className="px-2 py-1">
                              <Select
                                value={qa.campaign_id}
                                onValueChange={(v) => handleInlineUpdate(qa.id, 'campaign_id', v)}
                              >
                                <SelectTrigger className="h-6 border-0 shadow-none px-1 py-0 text-[10px] hover:bg-orange-50 [&>svg]:size-3 [&>svg]:opacity-0 hover:[&>svg]:opacity-50 gap-0 max-w-full">
                                  <span className="text-[10px] truncate">
                                    {(() => {
                                      const c = campaignMap.get(qa.campaign_id);
                                      return c ? `${c.client_name}` : '-';
                                    })()}
                                  </span>
                                </SelectTrigger>
                                <SelectContent position="popper" className="max-h-60">
                                  {campaigns.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                      {c.client_name} - {c.campaign_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            {/* Type - inline select */}
                            <td className="px-2 py-1">
                              <Select
                                value={qa.qa_type}
                                onValueChange={(v) => handleInlineUpdate(qa.id, 'qa_type', v)}
                              >
                                <SelectTrigger className="h-6 border-0 shadow-none px-1 py-0 text-[9px] font-medium hover:bg-orange-50 [&>svg]:size-3 [&>svg]:opacity-0 hover:[&>svg]:opacity-50 gap-0">
                                  <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 gap-0.5 whitespace-nowrap pointer-events-none rounded-full', typeCfg.color, typeCfg.bg)}>
                                    {qa.qa_type}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent position="popper" className="max-h-60">
                                  {QA_TYPES.map((t) => (
                                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            {/* Priority - inline select */}
                            <td className="px-2 py-1">
                              <Select
                                value={qa.priority}
                                onValueChange={(v) => handleInlineUpdate(qa.id, 'priority', v)}
                              >
                                <SelectTrigger className="h-6 border-0 shadow-none px-1 py-0 text-[9px] hover:bg-orange-50 [&>svg]:size-3 [&>svg]:opacity-0 hover:[&>svg]:opacity-50 gap-0">
                                  <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 whitespace-nowrap pointer-events-none rounded-full', priorityCfg.color, priorityCfg.bg)}>
                                    {qa.priority}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent position="popper" className="max-h-60">
                                  {QA_PRIORITIES.map((p) => (
                                    <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            {/* Content - inline text edit */}
                            <td className="px-2 py-1 max-w-0">
                              <InlineTextCell
                                value={qa.content}
                                qaId={qa.id}
                                field="content"
                                placeholder="내용 입력..."
                                onUpdate={handleInlineUpdate}
                              />
                            </td>
                            {/* Resolution - inline text edit */}
                            <td className="px-2 py-1 max-w-0">
                              <InlineTextCell
                                value={qa.resolution}
                                qaId={qa.id}
                                field="resolution"
                                placeholder="해결내용 입력..."
                                textColor="text-muted-foreground"
                                onUpdate={handleInlineUpdate}
                              />
                            </td>
                            {/* Created By - inline select */}
                            <td className="px-2 py-1">
                              <Select
                                value={qa.created_by || '__none__'}
                                onValueChange={(v) => handleInlineUpdate(qa.id, 'created_by', v === '__none__' ? null : v)}
                              >
                                <SelectTrigger className="h-6 border-0 shadow-none px-0.5 py-0 text-[10px] hover:bg-orange-50 [&>svg]:size-3 [&>svg]:opacity-0 hover:[&>svg]:opacity-50 gap-0 whitespace-nowrap">
                                  <span className={cn('text-[11px] truncate', qa.created_by ? 'text-foreground' : 'text-muted-foreground')}>{qa.created_by || '-'}</span>
                                </SelectTrigger>
                                <SelectContent position="popper" className="max-h-60">
                                  <SelectItem value="__none__" className="text-xs text-muted-foreground">미지정</SelectItem>
                                  {users.map((u) => (
                                    <SelectItem key={u.id} value={u.name} className="text-xs">
                                      {u.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            {/* Assigned To - inline select */}
                            <td className="px-2 py-1">
                              <Select
                                value={qa.assigned_to || '__none__'}
                                onValueChange={(v) => handleInlineUpdate(qa.id, 'assigned_to', v === '__none__' ? null : v)}
                              >
                                <SelectTrigger className="h-6 border-0 shadow-none px-0.5 py-0 text-[10px] hover:bg-orange-50 [&>svg]:size-3 [&>svg]:opacity-0 hover:[&>svg]:opacity-50 gap-0 whitespace-nowrap">
                                  <span className={cn('text-[11px] truncate', qa.assigned_to ? 'text-foreground' : 'text-muted-foreground')}>{qa.assigned_to || '-'}</span>
                                </SelectTrigger>
                                <SelectContent position="popper" className="max-h-60">
                                  <SelectItem value="__none__" className="text-xs text-muted-foreground">미배정</SelectItem>
                                  {users.map((u) => (
                                    <SelectItem key={u.id} value={u.name} className="text-xs">
                                      {u.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            {/* Due Date - inline date edit */}
                            <td className="px-2 py-1 whitespace-nowrap">
                              <InlineDateCell
                                value={qa.due_date}
                                qaId={qa.id}
                                status={qa.status}
                                onUpdate={handleInlineUpdate}
                              />
                            </td>
                            {/* Status - click to cycle */}
                            <td className="px-2 py-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusCycle(qa)}
                                    className={cn(
                                      'text-[10px] font-medium px-2 py-0.5 rounded-full border cursor-pointer transition-all hover:scale-105 whitespace-nowrap',
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
                            <td className="px-2 py-1 whitespace-nowrap">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {format(parseISO(qa.created_at), 'MM/dd')}
                              </span>
                            </td>
                            {/* Actions */}
                            <td className="px-2 py-1">
                              <div className="flex items-center justify-end gap-0.5">
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
              );
            })}
          </motion.div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[560px] bg-white border-stone-100 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingQa ? 'QA 수정' : 'QA 등록'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Campaign Select (Searchable) */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">캠페인 *</label>
                <Popover open={campaignSearchOpen} onOpenChange={setCampaignSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={campaignSearchOpen}
                      className="w-full h-9 justify-between text-sm font-normal bg-secondary/50 border-border"
                    >
                      {formData.campaign_id
                        ? (() => {
                            const c = campaignMap.get(formData.campaign_id);
                            return c ? `${c.client_name} - ${c.campaign_name}` : '캠페인을 선택하세요';
                          })()
                        : '캠페인을 선택하세요'}
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="캠페인 검색..." className="h-9 text-sm" />
                      <CommandList>
                        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                        <CommandGroup>
                          {campaigns.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.client_name} ${c.campaign_name}`}
                              onSelect={() => {
                                setFormData((prev) => ({ ...prev, campaign_id: c.id }));
                                setCampaignSearchOpen(false);
                              }}
                              className="text-sm"
                            >
                              <Check className={cn('mr-2 h-3.5 w-3.5', formData.campaign_id === c.id ? 'opacity-100' : 'opacity-0')} />
                              {c.client_name} - {c.campaign_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Type + Priority Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">유형 *</label>
                  <Select
                    value={formData.qa_type}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, qa_type: v as QaType }))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-secondary/50 border-border">
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
                    <SelectTrigger className="h-9 text-sm bg-secondary/50 border-border">
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
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 resize-none"
                />
              </div>

              {/* Due Date + Status + Created By + Assigned To Row */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">기한</label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                    className="h-9 text-sm bg-secondary/50 border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">상태</label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as QaStatus }))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-secondary/50 border-border">
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
                  <Select
                    value={formData.created_by}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, created_by: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-secondary/50 border-border">
                      <SelectValue placeholder="작성자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.name}>
                          {u.name}{u.position ? ` (${u.position})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">실행자</label>
                  <Select
                    value={formData.assigned_to}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, assigned_to: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-secondary/50 border-border">
                      <SelectValue placeholder="실행자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.name}>
                          {u.name}{u.position ? ` (${u.position})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-full border-stone-200 hover:bg-stone-50">
                  취소
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.campaign_id || !formData.content.trim() || createMutation.isPending || updateMutation.isPending}
                  className="bg-orange-500 text-white hover:bg-orange-600 rounded-full"
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
