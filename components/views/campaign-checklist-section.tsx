'use client';

// Plan Ref: campaign-checklist-dashboard §4 — 캠페인별 필수 체크리스트 섹션
// 자격 필터: collaboration_products.product_name='해외환자유치상품' AND target_country != '중화권(홍,말,싱)'

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Pencil, Copy, Search, X, Check,
  Flame, Trophy, Link as LinkIcon, Settings2, ChevronDown,
  CalendarRange, LayoutList, StickyNote, ListTodo,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  Campaign,
  ChecklistSection,
  ChecklistColumn,
  ChecklistCampaignRecord,
  ChecklistCampaignOverride,
  ChecklistCampaignAction,
  ChecklistColumnType,
  CampaignProductWithProduct,
} from '@/lib/types/database';

const supabase = createClient();

// Design Ref: §4.3 — 섹션별 색상 토큰 (헤더는 같은 섹션 내 동일, 섹션 간 상이)
const SECTION_THEME: Record<string, { header: string; col: string; text: string; ring: string; emoji: string }> = {
  purple: {
    header: 'bg-purple-600 text-white',
    col: 'bg-purple-50 text-purple-800 border-purple-200',
    text: 'text-purple-700',
    ring: 'ring-purple-300',
    emoji: '✨',
  },
  emerald: {
    header: 'bg-emerald-600 text-white',
    col: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700',
    ring: 'ring-emerald-300',
    emoji: '🙋',
  },
  amber: {
    header: 'bg-amber-600 text-white',
    col: 'bg-amber-50 text-amber-800 border-amber-200',
    text: 'text-amber-700',
    ring: 'ring-amber-300',
    emoji: '📢',
  },
  sky: {
    header: 'bg-sky-600 text-white',
    col: 'bg-sky-50 text-sky-800 border-sky-200',
    text: 'text-sky-700',
    ring: 'ring-sky-300',
    emoji: '📨',
  },
};

const DEFAULT_THEME = SECTION_THEME.purple;
const getTheme = (t: string) => SECTION_THEME[t] || DEFAULT_THEME;

// Design Ref: §3 — 제외 조건: 해외환자유치상품 연결 O, 중화권 캠페인 X, kicon 캠페인 X
const ELIGIBLE_PRODUCT_NAME = '해외환자유치상품';

function isExcludedCampaign(c: Campaign): boolean {
  const tc = (c.target_country || '').toLowerCase();
  const name = (c.campaign_name || '').toLowerCase();
  const client = (c.client_name || '').toLowerCase();
  // 중화권 (target_country='중화권' 또는 이름에 '중화권' 포함)
  if (tc.includes('중화권') || name.includes('중화권') || client.includes('중화권')) return true;
  // kicon (케이스 무관)
  if (name.includes('kicon') || client.includes('kicon')) return true;
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────
function parseNumber(s: string | null | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function truncate(s: string, max = 20): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── Main Component ──────────────────────────────────────────
export function CampaignChecklistSection({ selectedDate }: { selectedDate: Date }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const dateStr = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [actionCampaign, setActionCampaign] = useState<Campaign | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthStr = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = String(selectedMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [selectedMonth]);

  const monthRange = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth();
    const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const nextFirst = new Date(y, m + 1, 1);
    const nextStr = `${nextFirst.getFullYear()}-${String(nextFirst.getMonth() + 1).padStart(2, '0')}-01`;
    return { first, nextFirst: nextStr };
  }, [selectedMonth]);

  // ─── Queries ──────────────────────────────────────────────
  const { data: sections = [] } = useQuery({
    queryKey: queryKeys.campaignChecklist.sections,
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_sections')
        .select('*')
        .order('sort_order');
      return (data || []) as ChecklistSection[];
    },
  });

  const { data: columns = [] } = useQuery({
    queryKey: queryKeys.campaignChecklist.columns,
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_columns')
        .select('*')
        .order('sort_order');
      return (data || []) as ChecklistColumn[];
    },
  });

  // 자격 캠페인: campaign_products + collaboration_products 조인
  const { data: eligibleCampaigns = [] } = useQuery({
    queryKey: queryKeys.campaignChecklist.eligibleCampaigns,
    queryFn: async () => {
      // 1) 해외환자유치상품 id
      const { data: productRow } = await supabase
        .from('collaboration_products')
        .select('id')
        .eq('product_name', ELIGIBLE_PRODUCT_NAME)
        .maybeSingle();
      if (!productRow) return [];

      // 2) 해당 상품과 연결된 campaign_id 목록
      const { data: cps } = await supabase
        .from('campaign_products')
        .select('campaign_id')
        .eq('product_id', productRow.id);
      const ids = Array.from(new Set((cps || []).map((r: { campaign_id: string }) => r.campaign_id)));
      if (ids.length === 0) return [];

      // 3) campaigns 조회 후 클라이언트측 다중 조건 필터 (중화권·kicon 제외)
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .in('id', ids)
        .order('client_name', { ascending: true });
      return ((campaigns || []) as Campaign[]).filter((c) => !isExcludedCampaign(c));
    },
  });

  const { data: overrides = [] } = useQuery({
    queryKey: queryKeys.campaignChecklist.overrides,
    queryFn: async () => {
      const { data } = await supabase.from('checklist_campaign_overrides').select('*');
      return (data || []) as ChecklistCampaignOverride[];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: queryKeys.campaignChecklist.records(dateStr),
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_campaign_records')
        .select('*')
        .eq('record_date', dateStr);
      return (data || []) as ChecklistCampaignRecord[];
    },
  });

  // 캠페인별 액션아이템 (날짜 기반)
  const { data: actions = [] } = useQuery({
    queryKey: queryKeys.campaignChecklist.actions(dateStr),
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_campaign_actions')
        .select('*')
        .eq('action_date', dateStr)
        .order('sort_order');
      return (data || []) as ChecklistCampaignAction[];
    },
  });

  // 월간 집계용 — viewMode=monthly일 때만 활성
  const { data: monthlyRecords = [] } = useQuery({
    queryKey: queryKeys.campaignChecklist.monthlyRecords(monthStr),
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_campaign_records')
        .select('*')
        .gte('record_date', monthRange.first)
        .lt('record_date', monthRange.nextFirst);
      return (data || []) as ChecklistCampaignRecord[];
    },
    enabled: viewMode === 'monthly',
  });

  // ─── Realtime ─────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('campaign-checklist-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_sections' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.sections });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_columns' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.columns });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_campaign_records' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.records(dateStr) });
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.monthlyRecords(monthStr) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_campaign_overrides' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.overrides });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_campaign_actions' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.actions(dateStr) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_products' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.eligibleCampaigns });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.eligibleCampaigns });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, dateStr, monthStr]);

  // ─── Derived ──────────────────────────────────────────────
  const hiddenIds = useMemo(() => new Set(overrides.filter((o) => o.is_hidden).map((o) => o.campaign_id)), [overrides]);

  const visibleCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = eligibleCampaigns.filter((c) => !hiddenIds.has(c.id));
    if (q) {
      list = list.filter((c) =>
        (c.client_name || '').toLowerCase().includes(q) ||
        (c.campaign_name || '').toLowerCase().includes(q)
      );
    }
    if (selectedCampaignIds.size > 0) {
      list = list.filter((c) => selectedCampaignIds.has(c.id));
    }
    return list;
  }, [eligibleCampaigns, hiddenIds, searchQuery, selectedCampaignIds]);

  const columnsBySection = useMemo(() => {
    const m = new Map<string, ChecklistColumn[]>();
    for (const s of sections) m.set(s.id, []);
    for (const c of columns) {
      const arr = m.get(c.section_id);
      if (arr) arr.push(c);
    }
    return m;
  }, [sections, columns]);

  // records keyed by (campaign_id, column_id)
  const recordsMap = useMemo(() => {
    const m = new Map<string, ChecklistCampaignRecord>();
    for (const r of records) m.set(`${r.campaign_id}|${r.column_id}`, r);
    return m;
  }, [records]);

  const getRecord = (campaignId: string, columnId: string) =>
    recordsMap.get(`${campaignId}|${columnId}`);

  // 월간 집계: (campaign_id, column_id) → { numericSum, urlCount, dayCount, textSamples }
  type MonthlyAgg = { numericSum: number; urlCount: number; dayCount: number; textSamples: string[] };
  const monthlyAggMap = useMemo(() => {
    const m = new Map<string, MonthlyAgg>();
    const colTypeMap = new Map(columns.map((c) => [c.id, c.input_type]));
    for (const r of monthlyRecords) {
      const k = `${r.campaign_id}|${r.column_id}`;
      const type = colTypeMap.get(r.column_id);
      const entry = m.get(k) ?? { numericSum: 0, urlCount: 0, dayCount: 0, textSamples: [] };
      entry.dayCount += 1;
      if (type === 'multi_url') {
        entry.urlCount += (r.value_urls || []).length;
      } else if (type === 'number') {
        entry.numericSum += parseNumber(r.value_text);
      } else {
        if (r.value_text?.trim()) entry.textSamples.push(r.value_text.trim());
      }
      m.set(k, entry);
    }
    return m;
  }, [monthlyRecords, columns]);

  // ─── Summary: Best / Urgent ───────────────────────────────
  // Plan SC-06: 베스트=후기+리뷰 URL 합계 Top3, 긴급=일반고객 신규예약=0 OR 인플 예약확정=0
  const { bestTop, urgent } = useMemo(() => {
    const influencerSection = sections.find((s) => s.name === '인플루언서');
    const customerSection = sections.find((s) => s.name === '일반고객');

    const findCol = (sectionId: string | undefined, name: string) =>
      columns.find((c) => c.section_id === sectionId && c.name === name);

    const colInfluencerReview = findCol(influencerSection?.id, '금일 업로드된 후기');
    const colCustomerReview = findCol(customerSection?.id, '금일 업로드된 리뷰');
    const colInfluencerReserve = findCol(influencerSection?.id, '예약확정 인플');
    const colCustomerReserve = findCol(customerSection?.id, '신규예약 고객');

    // 컬럼 타입에 상관없이 "숫자값"을 얻기: multi_url이면 URL 개수, 그 외는 value_text 파싱
    const getCountValue = (col: ChecklistColumn | undefined, campaignId: string): number => {
      if (!col) return 0;
      const rec = getRecord(campaignId, col.id);
      if (!rec) return 0;
      if (col.input_type === 'multi_url') return (rec.value_urls || []).length;
      return parseNumber(rec.value_text);
    };

    type Row = { campaign: Campaign; uploadCount: number; isUrgent: boolean; urgentReason: string[] };
    const rows: Row[] = visibleCampaigns.map((c) => {
      const infReviewUrls = colInfluencerReview ? getRecord(c.id, colInfluencerReview.id)?.value_urls || [] : [];
      const custReviewUrls = colCustomerReview ? getRecord(c.id, colCustomerReview.id)?.value_urls || [] : [];
      const infReserve = getCountValue(colInfluencerReserve, c.id);
      const custReserve = getCountValue(colCustomerReserve, c.id);

      const urgentReason: string[] = [];
      if (custReserve === 0) urgentReason.push('신규예약 고객 0');
      if (infReserve === 0) urgentReason.push('예약확정 인플 0');

      return {
        campaign: c,
        uploadCount: infReviewUrls.length + custReviewUrls.length,
        isUrgent: urgentReason.length > 0,
        urgentReason,
      };
    });

    const bestTop = [...rows]
      .filter((r) => r.uploadCount > 0)
      .sort((a, b) => b.uploadCount - a.uploadCount)
      .slice(0, 3);

    const urgent = rows.filter((r) => r.isUrgent);

    return { bestTop, urgent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCampaigns, records, columns, sections]);

  // ─── Mutations ────────────────────────────────────────────
  const upsertRecord = useMutation({
    mutationFn: async (args: {
      campaignId: string;
      columnId: string;
      valueText?: string | null;
      valueUrls?: string[] | null;
      memo?: string | null;
    }) => {
      const payload = {
        campaign_id: args.campaignId,
        column_id: args.columnId,
        record_date: dateStr,
        value_text: args.valueText ?? null,
        value_urls: args.valueUrls ?? null,
        memo: args.memo ?? null,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('checklist_campaign_records')
        .upsert(payload, { onConflict: 'campaign_id,column_id,record_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.records(dateStr) });
    },
  });

  // 액션 맵: campaign_id → ChecklistCampaignAction[]
  const actionsByCampaign = useMemo(() => {
    const m = new Map<string, ChecklistCampaignAction[]>();
    for (const a of actions) {
      const arr = m.get(a.campaign_id) ?? [];
      arr.push(a);
      m.set(a.campaign_id, arr);
    }
    return m;
  }, [actions]);

  // 로드맵 Project 확보 (없으면 생성) → id 반환
  const ensureProjectForCampaign = useCallback(async (campaign: Campaign): Promise<string> => {
    const projectName = `[${campaign.client_name || campaign.campaign_name}]`;
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_name', projectName)
      .maybeSingle();
    if (existing?.id) return existing.id as string;

    const { data: created, error } = await supabase
      .from('projects')
      .insert({
        project_name: projectName,
        priority: '보통',
        state: '진행중',
        assignee_ids: [],
        sort_order: 0,
      })
      .select('id')
      .single();
    if (error) throw error;
    return created!.id as string;
  }, []);

  // 액션 추가 (로드맵 ProjectTask 동기화)
  const addAction = useMutation({
    mutationFn: async (args: { campaign: Campaign; text: string }) => {
      const trimmed = args.text.trim();
      if (!trimmed) return;
      const projectId = await ensureProjectForCampaign(args.campaign);
      // 1) project_task 먼저 생성
      const { data: task, error: taskErr } = await supabase
        .from('project_tasks')
        .insert({
          project_id: projectId,
          title: trimmed,
          state: '진행중',
          priority: '보통',
          start_date: dateStr,
          assignee_ids: [],
          sort_order: 0,
        })
        .select('id')
        .single();
      if (taskErr) throw taskErr;
      // 2) checklist_campaign_actions 생성
      const existingCount = (actionsByCampaign.get(args.campaign.id) || []).length;
      const { error } = await supabase.from('checklist_campaign_actions').insert({
        campaign_id: args.campaign.id,
        action_date: dateStr,
        text: trimmed,
        sort_order: existingCount,
        project_task_id: task?.id ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.actions(dateStr) });
    },
  });

  const updateAction = useMutation({
    mutationFn: async (args: { action: ChecklistCampaignAction; text: string }) => {
      const trimmed = args.text.trim();
      if (!trimmed) return;
      const { error } = await supabase
        .from('checklist_campaign_actions')
        .update({ text: trimmed, updated_at: new Date().toISOString() })
        .eq('id', args.action.id);
      if (error) throw error;
      if (args.action.project_task_id) {
        await supabase
          .from('project_tasks')
          .update({ title: trimmed, updated_at: new Date().toISOString() })
          .eq('id', args.action.project_task_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.actions(dateStr) });
    },
  });

  const deleteAction = useMutation({
    mutationFn: async (action: ChecklistCampaignAction) => {
      // 로드맵 ProjectTask 먼저 삭제 (FK set null로 레이스 방지)
      if (action.project_task_id) {
        await supabase.from('project_tasks').delete().eq('id', action.project_task_id);
      }
      const { error } = await supabase.from('checklist_campaign_actions').delete().eq('id', action.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.actions(dateStr) });
    },
  });

  const hideCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('checklist_campaign_overrides')
        .upsert({ campaign_id: campaignId, is_hidden: true, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.overrides });
    },
  });

  // ─── Copy to Kakao ────────────────────────────────────────
  // Plan SC-05: [캠페인명]\n#섹션\n- 컬럼: 값\n...
  const buildCopyText = useCallback((campaign: Campaign): string => {
    const lines: string[] = [];
    lines.push(`[${campaign.client_name || campaign.campaign_name}]`);
    for (const section of sections) {
      const cols = columnsBySection.get(section.id) ?? [];
      if (cols.length === 0) continue;
      lines.push('');
      lines.push(`#${section.name}`);
      for (const col of cols) {
        const rec = getRecord(campaign.id, col.id);
        if (col.input_type === 'multi_url') {
          const urls = rec?.value_urls || [];
          if (urls.length === 0) {
            // 빈 값 기본: 0
            lines.push(`- ${col.name}: 0`);
          } else {
            // URL 개수를 숫자로 노출
            lines.push(`- ${col.name}: ${urls.length}`);
            for (const u of urls) lines.push(`  ${u}`);
          }
        } else {
          // 빈 값 기본: 0
          const v = rec?.value_text?.trim() || '0';
          lines.push(`- ${col.name}: ${v}`);
        }
        // 메모가 있으면 들여쓰기 줄로 추가
        const m = rec?.memo?.trim();
        if (m) lines.push(`  └ 메모: ${m}`);
      }
    }
    // 캠페인 액션아이템 (있으면)
    const campActions = actionsByCampaign.get(campaign.id) || [];
    if (campActions.length > 0) {
      lines.push('');
      lines.push('#액션아이템');
      for (const a of campActions) lines.push(`- ${a.text}`);
    }
    return lines.join('\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, columnsBySection, recordsMap, actionsByCampaign]);

  const copyCampaign = async (campaign: Campaign) => {
    const text = buildCopyText(campaign);
    await navigator.clipboard.writeText(text);
  };

  const copyAllVisible = async () => {
    const text = visibleCampaigns.map(buildCopyText).join('\n\n───\n\n');
    await navigator.clipboard.writeText(text);
  };

  // ─── Render ───────────────────────────────────────────────
  if (sections.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white/80 p-6 text-center text-sm text-stone-400">
        체크리스트 섹션이 준비되지 않았습니다. 마이그레이션을 실행해주세요.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-stone-200 bg-white/90 backdrop-blur-sm overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-white border-b border-stone-200">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          <motion.span
            animate={{ rotate: expanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="size-4 text-stone-500" />
          </motion.span>
          <span className="text-[16px] font-bold text-stone-900">캠페인별 필수 체크리스트</span>
          <Badge variant="outline" className="text-[10px]">
            {visibleCampaigns.length}개 캠페인
          </Badge>
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8" onClick={copyAllVisible}>
            <Copy className="size-3.5 mr-1" /> 전체 복사
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setColumnDialogOpen(true)}>
            <Settings2 className="size-3.5 mr-1" /> 컬럼 관리
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* View Mode Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-xl bg-stone-100 p-1 text-[12px]">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all',
                  viewMode === 'daily'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                )}
              >
                <LayoutList className="size-3.5" /> 일간 입력
              </button>
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all',
                  viewMode === 'monthly'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                )}
              >
                <CalendarRange className="size-3.5" /> 월간 집계
              </button>
            </div>

            {viewMode === 'monthly' && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7 rounded-lg"
                  onClick={() => setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                >
                  <ChevronDown className="size-3.5 rotate-90" />
                </Button>
                <div className="text-[12px] font-semibold text-stone-700 min-w-[90px] text-center">
                  {selectedMonth.getFullYear()}.{String(selectedMonth.getMonth() + 1).padStart(2, '0')}
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7 rounded-lg"
                  onClick={() => setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                >
                  <ChevronDown className="size-3.5 -rotate-90" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    const d = new Date();
                    setSelectedMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  }}
                >
                  이번달
                </Button>
              </div>
            )}
          </div>

          {/* Search + Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="캠페인 검색..."
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            <CampaignSelector
              campaigns={eligibleCampaigns.filter((c) => !hiddenIds.has(c.id))}
              selected={selectedCampaignIds}
              onChange={setSelectedCampaignIds}
            />
          </div>

          {/* Grid Table (일간 편집) */}
          {viewMode === 'daily' && (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full border-collapse">
              <thead>
                {/* Section header row */}
                <tr>
                  <th className="sticky left-0 z-10 bg-stone-100 border-b border-r border-stone-200 text-left px-3 py-2 text-[12px] font-bold text-stone-700 min-w-[160px]" rowSpan={2}>
                    캠페인
                  </th>
                  {sections.map((s) => {
                    const theme = getTheme(s.color_theme);
                    const count = columnsBySection.get(s.id)?.length ?? 0;
                    if (count === 0) return null;
                    return (
                      <th
                        key={s.id}
                        colSpan={count}
                        className={cn('border-b border-stone-200 px-3 py-1.5 text-center text-[12px] font-bold', theme.header)}
                      >
                        {theme.emoji} {s.name}
                      </th>
                    );
                  })}
                  <th className="bg-violet-600 border-b border-stone-200 px-2 py-2 text-[11px] font-bold text-white min-w-[100px]" rowSpan={2}>
                    📋 액션
                  </th>
                  <th className="sticky right-0 z-10 bg-stone-100 border-b border-l border-stone-200 px-2 py-2 text-[11px] font-bold text-stone-600 min-w-[90px]" rowSpan={2}>
                    작업
                  </th>
                </tr>
                {/* Column header row */}
                <tr>
                  {sections.map((s) => {
                    const theme = getTheme(s.color_theme);
                    const cols = columnsBySection.get(s.id) ?? [];
                    return cols.map((c) => (
                      <th
                        key={c.id}
                        className={cn('border-b border-stone-200 px-2 py-1.5 text-[11px] font-medium min-w-[130px] align-middle', theme.col)}
                      >
                        <div className="flex flex-col leading-tight gap-0.5">
                          <span className="whitespace-normal break-keep">{c.name}</span>
                          {c.helper_text && (
                            <span className="text-[9px] font-normal text-stone-500 whitespace-normal break-keep">{c.helper_text}</span>
                          )}
                        </div>
                      </th>
                    ));
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 3} className="text-center text-[12px] text-stone-400 py-8">
                      표시할 캠페인이 없습니다.
                    </td>
                  </tr>
                )}
                {visibleCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-stone-100 px-3 py-2 text-[12px] font-semibold text-stone-800 group-hover:bg-stone-50">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[180px]">{campaign.client_name || campaign.campaign_name}</span>
                        {campaign.target_country && (
                          <span className="text-[9px] text-stone-400 font-normal">{campaign.target_country}</span>
                        )}
                      </div>
                    </td>
                    {sections.map((s) => {
                      const cols = columnsBySection.get(s.id) ?? [];
                      return cols.map((col) => (
                        <td key={col.id} className="border-b border-stone-100 p-1 align-middle">
                          <CellEditor
                            record={getRecord(campaign.id, col.id)}
                            column={col}
                            onSave={(valueText, valueUrls, memo) =>
                              upsertRecord.mutate({ campaignId: campaign.id, columnId: col.id, valueText, valueUrls, memo })
                            }
                          />
                        </td>
                      ));
                    })}
                    {/* 액션 칩 셀 */}
                    <td className="border-b border-stone-100 px-2 py-1 align-middle text-center">
                      {(() => {
                        const count = actionsByCampaign.get(campaign.id)?.length || 0;
                        return (
                          <button
                            type="button"
                            onClick={() => setActionCampaign(campaign)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all',
                              count > 0
                                ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:ring-violet-400'
                                : 'bg-stone-50 text-stone-400 hover:bg-violet-50 hover:text-violet-600'
                            )}
                          >
                            <ListTodo className="size-3" />
                            <span className="tabular-nums">{count}</span>개
                          </button>
                        );
                      })()}
                    </td>
                    <td className="sticky right-0 z-10 bg-white border-b border-l border-stone-100 px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="카톡 복사"
                          onClick={() => copyCampaign(campaign)}
                        >
                          <Copy className="size-3.5 text-stone-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="대시보드에서 숨김"
                          onClick={() => {
                            if (confirm(`"${campaign.client_name}"을(를) 대시보드에서 제외하시겠습니까?`)) {
                              hideCampaign.mutate(campaign.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {/* Monthly Aggregate Table */}
          {viewMode === 'monthly' && (
            <MonthlyTable
              sections={sections}
              columns={columns}
              columnsBySection={columnsBySection}
              campaigns={visibleCampaigns}
              aggMap={monthlyAggMap}
              monthLabel={`${selectedMonth.getFullYear()}.${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
            />
          )}

          {/* Summary Cards (베스트/긴급) — 체크리스트 아래 배치 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SummaryCard
              title="🏆 베스트 Top 3"
              color="blue"
              empty="후기/리뷰 업로드 데이터 없음"
              items={bestTop.map((r) => ({
                id: r.campaign.id,
                label: r.campaign.client_name || r.campaign.campaign_name,
                meta: `업로드 ${r.uploadCount}건`,
              }))}
            />
            <SummaryCard
              title="🚨 긴급 캠페인"
              color="rose"
              empty="긴급 캠페인 없음"
              items={urgent.map((r) => ({
                id: r.campaign.id,
                label: r.campaign.client_name || r.campaign.campaign_name,
                meta: r.urgentReason.join(' · '),
              }))}
            />
          </div>
        </div>
      )}

      {/* Action Items Dialog */}
      <ActionItemsDialog
        campaign={actionCampaign}
        actions={actionCampaign ? (actionsByCampaign.get(actionCampaign.id) || []) : []}
        dateLabel={dateStr}
        onClose={() => setActionCampaign(null)}
        onAdd={(text) => actionCampaign && addAction.mutate({ campaign: actionCampaign, text })}
        onUpdate={(action, text) => updateAction.mutate({ action, text })}
        onDelete={(action) => deleteAction.mutate(action)}
      />

      {/* Column Management Dialog */}
      <ColumnManagementDialog
        open={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        sections={sections}
        columns={columns}
        hiddenCampaigns={eligibleCampaigns.filter((c) => hiddenIds.has(c.id))}
        onUnhideCampaign={async (campaignId) => {
          await supabase
            .from('checklist_campaign_overrides')
            .upsert({ campaign_id: campaignId, is_hidden: false, updated_at: new Date().toISOString() });
          queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.overrides });
        }}
      />
    </motion.div>
  );
}

// ─── Summary Card ────────────────────────────────────────────
function SummaryCard({
  title, color, empty, items,
}: {
  title: string;
  color: 'blue' | 'rose';
  empty: string;
  items: { id: string; label: string; meta: string }[];
}) {
  const colors = color === 'blue'
    ? 'from-blue-50 to-indigo-50 border-blue-200 text-blue-700'
    : 'from-rose-50 to-pink-50 border-rose-200 text-rose-700';
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br p-3', colors)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-bold">{title}</span>
        <Badge variant="outline" className="text-[10px] bg-white/70">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-stone-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, idx) => (
            <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold text-stone-400 tabular-nums">{idx + 1}</span>
                <span className="text-[12px] font-semibold text-stone-800 truncate">{it.label}</span>
              </div>
              <span className="text-[10px] text-stone-500 whitespace-nowrap">{it.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Action Items Dialog ─────────────────────────────────────
function ActionItemsDialog({
  campaign, actions, dateLabel, onClose, onAdd, onUpdate, onDelete,
}: {
  campaign: Campaign | null;
  actions: ChecklistCampaignAction[];
  dateLabel: string;
  onClose: () => void;
  onAdd: (text: string) => void;
  onUpdate: (action: ChecklistCampaignAction, text: string) => void;
  onDelete: (action: ChecklistCampaignAction) => void;
}) {
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (!campaign) {
      setNewText('');
      setEditingId(null);
    }
  }, [campaign]);

  if (!campaign) return null;

  const handleAdd = () => {
    const t = newText.trim();
    if (!t) return;
    onAdd(t);
    setNewText('');
  };

  return (
    <Dialog open={!!campaign} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <ListTodo className="size-4 text-violet-600" />
            [{campaign.client_name || campaign.campaign_name}] 액션아이템
            <Badge variant="outline" className="text-[10px] ml-1">{dateLabel}</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            💡 로드맵 <span className="font-semibold">[{campaign.client_name}]</span> 프로젝트에 자동 반영됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {actions.length === 0 && (
            <p className="text-[12px] text-stone-400 italic text-center py-4">등록된 액션이 없습니다.</p>
          )}
          {actions.map((a, idx) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-2 py-1.5 group">
              <span className="text-[11px] text-stone-400 w-4 text-right tabular-nums">{idx + 1}.</span>
              {editingId === a.id ? (
                <>
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="h-7 text-[12px] flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onUpdate(a, editText);
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => { onUpdate(a, editText); setEditingId(null); }}>
                    <Check className="size-3.5 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingId(null)}>
                    <X className="size-3.5 text-stone-400" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[12px] text-stone-800">{a.text}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => { setEditingId(a.id); setEditText(a.text); }}
                  >
                    <Pencil className="size-3 text-stone-400" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      if (confirm('이 액션을 삭제하면 로드맵에서도 함께 삭제됩니다. 진행할까요?')) {
                        onDelete(a);
                      }
                    }}
                  >
                    <Trash2 className="size-3 text-rose-400" />
                  </Button>
                </>
              )}
            </div>
          ))}

          {/* Add new action */}
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50/30 px-2 py-1.5">
            <Plus className="size-3.5 text-violet-500" />
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="새 액션 추가 (Enter)"
              className="h-7 text-[12px] flex-1 border-0 bg-transparent focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <Button size="sm" className="h-7 text-[11px]" disabled={!newText.trim()} onClick={handleAdd}>
              추가
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Monthly Aggregate Table ─────────────────────────────────
function MonthlyTable({
  sections,
  columns,
  columnsBySection,
  campaigns,
  aggMap,
  monthLabel,
}: {
  sections: ChecklistSection[];
  columns: ChecklistColumn[];
  columnsBySection: Map<string, ChecklistColumn[]>;
  campaigns: Campaign[];
  aggMap: Map<string, { numericSum: number; urlCount: number; dayCount: number; textSamples: string[] }>;
  monthLabel: string;
}) {
  // 컬럼별 전체 합계 (하단 요약 행)
  const totals = useMemo(() => {
    const t = new Map<string, { numericSum: number; urlCount: number }>();
    for (const col of columns) {
      let numericSum = 0;
      let urlCount = 0;
      for (const c of campaigns) {
        const agg = aggMap.get(`${c.id}|${col.id}`);
        if (!agg) continue;
        numericSum += agg.numericSum;
        urlCount += agg.urlCount;
      }
      t.set(col.id, { numericSum, urlCount });
    }
    return t;
  }, [columns, campaigns, aggMap]);

  const formatCell = (col: ChecklistColumn, agg: { numericSum: number; urlCount: number; dayCount: number; textSamples: string[] } | undefined): { value: string; sub?: string } => {
    if (!agg) return { value: '0', sub: '미입력' };
    if (col.input_type === 'multi_url') {
      return { value: `${agg.urlCount}`, sub: `${agg.dayCount}일 기록` };
    }
    if (col.input_type === 'number') {
      const avg = agg.dayCount > 0 ? (agg.numericSum / agg.dayCount) : 0;
      return { value: agg.numericSum.toLocaleString(), sub: `일평균 ${avg.toFixed(1)}` };
    }
    return { value: `${agg.dayCount}일`, sub: agg.textSamples[0] ? truncate(agg.textSamples[0], 10) : undefined };
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <div className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-indigo-600" />
          <span className="text-[13px] font-bold text-stone-800">{monthLabel} 월간 집계</span>
        </div>
        <span className="text-[10px] text-stone-500">숫자=합계 · URL=총 건수 · 텍스트=기록 일수</span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-stone-100 border-b border-r border-stone-200 text-left px-3 py-2 text-[12px] font-bold text-stone-700 min-w-[160px]" rowSpan={2}>
              캠페인
            </th>
            {sections.map((s) => {
              const theme = getTheme(s.color_theme);
              const count = columnsBySection.get(s.id)?.length ?? 0;
              if (count === 0) return null;
              return (
                <th
                  key={s.id}
                  colSpan={count}
                  className={cn('border-b border-stone-200 px-3 py-1.5 text-center text-[12px] font-bold', theme.header)}
                >
                  {theme.emoji} {s.name}
                </th>
              );
            })}
          </tr>
          <tr>
            {sections.map((s) => {
              const cols = columnsBySection.get(s.id) ?? [];
              const theme = getTheme(s.color_theme);
              return cols.map((c) => (
                <th
                  key={c.id}
                  className={cn('border-b border-stone-200 px-2 py-1.5 text-[11px] font-medium min-w-[120px] align-middle', theme.col)}
                >
                  <div className="flex flex-col leading-tight gap-0.5">
                    <span className="whitespace-normal break-keep">{c.name}</span>
                    {c.helper_text && (
                      <span className="text-[9px] font-normal text-stone-500 whitespace-normal break-keep">{c.helper_text}</span>
                    )}
                  </div>
                </th>
              ));
            })}
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="text-center text-[12px] text-stone-400 py-8">
                표시할 캠페인이 없습니다.
              </td>
            </tr>
          )}
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="hover:bg-stone-50/60 transition-colors">
              <td className="sticky left-0 z-10 bg-white border-b border-r border-stone-100 px-3 py-2 text-[12px] font-semibold text-stone-800">
                <div className="flex flex-col">
                  <span className="truncate max-w-[180px]">{campaign.client_name || campaign.campaign_name}</span>
                  {campaign.target_country && (
                    <span className="text-[9px] text-stone-400 font-normal">{campaign.target_country}</span>
                  )}
                </div>
              </td>
              {sections.map((s) => {
                const cols = columnsBySection.get(s.id) ?? [];
                return cols.map((col) => {
                  const agg = aggMap.get(`${campaign.id}|${col.id}`);
                  const { value, sub } = formatCell(col, agg);
                  const isEmpty = !agg;
                  return (
                    <td key={col.id} className="border-b border-stone-100 px-2 py-1.5 align-middle text-center">
                      <div className={cn(
                        'flex flex-col items-center justify-center leading-tight',
                        isEmpty ? 'text-stone-400' : 'text-stone-800'
                      )}>
                        <span className={cn('text-[13px] tabular-nums', !isEmpty && 'font-bold')}>{value}</span>
                        {sub && <span className="text-[9px] text-stone-400 mt-0.5">{sub}</span>}
                      </div>
                    </td>
                  );
                });
              })}
            </tr>
          ))}
        </tbody>
        {campaigns.length > 0 && (
          <tfoot>
            <tr className="bg-stone-50 border-t-2 border-stone-300">
              <td className="sticky left-0 z-10 bg-stone-50 border-r border-stone-200 px-3 py-2 text-[12px] font-bold text-stone-700">
                전체 합계
              </td>
              {sections.map((s) => {
                const cols = columnsBySection.get(s.id) ?? [];
                return cols.map((col) => {
                  const t = totals.get(col.id);
                  if (!t) return <td key={col.id} className="px-2 py-2 text-center text-[11px] text-stone-400">-</td>;
                  const display = col.input_type === 'multi_url'
                    ? `${t.urlCount}건`
                    : col.input_type === 'number'
                      ? t.numericSum.toLocaleString()
                      : '-';
                  return (
                    <td key={col.id} className="px-2 py-2 text-center text-[12px] font-bold text-stone-800 tabular-nums">
                      {display}
                    </td>
                  );
                });
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Cell Editor (Popover) ───────────────────────────────────
function CellEditor({
  record,
  column,
  onSave,
}: {
  record: ChecklistCampaignRecord | undefined;
  column: ChecklistColumn;
  onSave: (valueText: string | null, valueUrls: string[] | null, memo: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(record?.value_text ?? '');
  const [urls, setUrls] = useState<string[]>(record?.value_urls ?? []);
  const [memo, setMemo] = useState(record?.memo ?? '');

  useEffect(() => {
    if (open) {
      setText(record?.value_text ?? '');
      setUrls(record?.value_urls ?? []);
      setMemo(record?.memo ?? '');
    }
  }, [open, record]);

  const hasMemo = !!record?.memo?.trim();

  const isMultiUrl = column.input_type === 'multi_url';
  const isNumber = column.input_type === 'number';

  const hasValue = isMultiUrl
    ? (record?.value_urls?.length || 0) > 0
    : !!record?.value_text?.trim();

  const urlCount = record?.value_urls?.length || 0;
  const preview = isMultiUrl
    ? String(urlCount)
    : truncate(record?.value_text || '');

  const handleSave = () => {
    const trimmedMemo = memo.trim();
    const memoPayload = trimmedMemo || null;
    if (isMultiUrl) {
      const cleaned = urls.map((u) => u.trim()).filter(Boolean);
      onSave(null, cleaned.length > 0 ? cleaned : null, memoPayload);
    } else {
      const v = text.trim();
      onSave(v || null, null, memoPayload);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative w-full min-h-[32px] rounded-md px-2 py-1 text-[12px] transition-all',
            isMultiUrl ? 'flex items-center justify-center gap-1' : 'text-left',
            hasValue
              ? 'bg-blue-50 text-blue-800 font-semibold ring-1 ring-blue-200 hover:ring-blue-400'
              : 'bg-stone-50 text-stone-400 hover:bg-white hover:ring-1 hover:ring-stone-300'
          )}
        >
          {isMultiUrl ? (
            <>
              <span className={cn('tabular-nums', hasValue ? 'text-[14px] font-bold' : 'text-[12px]')}>{preview}</span>
              {hasValue && <LinkIcon className="size-3 text-blue-500" />}
            </>
          ) : (
            hasValue ? preview : '입력...'
          )}
          {hasMemo && (
            <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px]" title={record?.memo || ''}>
              <StickyNote className="size-2.5 text-white" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-3 rounded-xl" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-700">{column.name}</p>
              {column.helper_text && (
                <p className="text-[10px] text-stone-400">{column.helper_text}</p>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-stone-100">
              <X className="size-3.5 text-stone-400" />
            </button>
          </div>

          {isMultiUrl ? (
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {urls.length === 0 && (
                <p className="text-[11px] text-stone-400 italic">등록된 URL이 없습니다.</p>
              )}
              {urls.map((u, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    value={u}
                    onChange={(e) => {
                      const next = [...urls];
                      next[idx] = e.target.value;
                      setUrls(next);
                    }}
                    placeholder="https://..."
                    className="h-7 text-[11px]"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    onClick={() => setUrls(urls.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-3 text-rose-400" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[11px]"
                onClick={() => setUrls([...urls, ''])}
              >
                <Plus className="size-3 mr-1" /> URL 추가
              </Button>
            </div>
          ) : isNumber ? (
            <Input
              type="number"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="숫자 입력"
              className="h-8 text-[12px]"
              autoFocus
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
              }}
            />
          ) : (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="텍스트 입력"
              className="text-[12px] min-h-[80px]"
              autoFocus
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
              }}
            />
          )}

          {/* 메모 영역 */}
          <div className="border-t border-stone-100 pt-2">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 mb-1">
              <StickyNote className="size-3" /> 메모 (선택)
            </label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항·맥락 기록"
              className="text-[11px] min-h-[52px] bg-amber-50/40 border-amber-100"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-stone-400">⌘+Enter 저장</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleSave}>
                <Check className="size-3 mr-1" /> 저장
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Campaign Multi-Select ───────────────────────────────────
function CampaignSelector({
  campaigns, selected, onChange,
}: {
  campaigns: Campaign[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-[11px]">
          필터: {selected.size > 0 ? `${selected.size}개 선택됨` : '전체'}
          <ChevronDown className="size-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2 rounded-xl max-h-[320px] overflow-y-auto">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-bold text-stone-600">캠페인 선택</span>
          {selected.size > 0 && (
            <button type="button" className="text-[10px] text-blue-600 hover:underline" onClick={() => onChange(new Set())}>
              초기화
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {campaigns.map((c) => {
            const checked = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] hover:bg-stone-50',
                  checked && 'bg-blue-50'
                )}
              >
                <div className={cn('size-3.5 rounded border flex items-center justify-center',
                  checked ? 'bg-blue-500 border-blue-500' : 'border-stone-300')}>
                  {checked && <Check className="size-2.5 text-white" />}
                </div>
                <span className="truncate">{c.client_name || c.campaign_name}</span>
              </button>
            );
          })}
          {campaigns.length === 0 && (
            <p className="text-[11px] text-stone-400 p-2">선택 가능한 캠페인 없음</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Column Management Dialog ────────────────────────────────
function ColumnManagementDialog({
  open, onClose, sections, columns, hiddenCampaigns, onUnhideCampaign,
}: {
  open: boolean;
  onClose: () => void;
  sections: ChecklistSection[];
  columns: ChecklistColumn[];
  hiddenCampaigns: Campaign[];
  onUnhideCampaign: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [sectionId, setSectionId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ChecklistColumnType>('text');
  const [newHelper, setNewHelper] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHelper, setEditHelper] = useState('');

  useEffect(() => {
    if (open && sections.length > 0 && !sectionId) {
      setSectionId(sections[0].id);
    }
  }, [open, sections, sectionId]);

  const addCol = useMutation({
    mutationFn: async () => {
      if (!sectionId || !newName.trim()) return;
      const sectionCols = columns.filter((c) => c.section_id === sectionId);
      const { error } = await supabase.from('checklist_columns').insert({
        section_id: sectionId,
        name: newName.trim(),
        input_type: newType,
        helper_text: newHelper.trim() || null,
        sort_order: sectionCols.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.columns });
      setNewName('');
      setNewHelper('');
    },
  });

  const updateCol = useMutation({
    mutationFn: async (args: { id: string; name: string; helper_text: string | null }) => {
      const { error } = await supabase
        .from('checklist_columns')
        .update({ name: args.name, helper_text: args.helper_text, updated_at: new Date().toISOString() })
        .eq('id', args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.columns });
      setEditingColId(null);
    },
  });

  const deleteCol = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_columns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.columns });
    },
  });

  const currentCols = columns.filter((c) => c.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">체크리스트 컬럼 관리</DialogTitle>
          <DialogDescription className="text-xs">섹션별 컬럼을 추가/수정/삭제하고, 숨김 처리된 캠페인을 복원할 수 있습니다.</DialogDescription>
        </DialogHeader>

        {/* Section picker */}
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-bold text-stone-600 mb-1">섹션 선택</p>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="h-9 text-[12px]">
                <SelectValue placeholder="섹션" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-[12px]">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Column List */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-600">현재 컬럼 ({currentCols.length})</p>
            {currentCols.length === 0 && (
              <p className="text-[11px] text-stone-400 italic">컬럼 없음</p>
            )}
            {currentCols.map((col) => (
              <div key={col.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-2 py-1.5">
                {editingColId === col.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-[11px] flex-1" placeholder="컬럼명" />
                    <Input value={editHelper} onChange={(e) => setEditHelper(e.target.value)} className="h-7 text-[11px] w-28" placeholder="보조(선택)" />
                    <Button size="icon" variant="ghost" className="size-7" onClick={() =>
                      updateCol.mutate({ id: col.id, name: editName.trim(), helper_text: editHelper.trim() || null })
                    }>
                      <Check className="size-3.5 text-emerald-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingColId(null)}>
                      <X className="size-3.5 text-stone-400" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-stone-800 truncate">{col.name}</p>
                      {col.helper_text && <p className="text-[10px] text-stone-400 truncate">{col.helper_text}</p>}
                    </div>
                    <Badge variant="outline" className="text-[9px]">{col.input_type}</Badge>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => {
                      setEditingColId(col.id);
                      setEditName(col.name);
                      setEditHelper(col.helper_text || '');
                    }}>
                      <Pencil className="size-3 text-stone-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => {
                      if (confirm(`"${col.name}" 컬럼과 모든 입력 데이터가 삭제됩니다. 진행할까요?`)) {
                        deleteCol.mutate(col.id);
                      }
                    }}>
                      <Trash2 className="size-3 text-rose-400" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add New Column */}
          <div className="rounded-lg border border-dashed border-stone-300 p-2.5 space-y-2">
            <p className="text-[11px] font-bold text-stone-600">+ 컬럼 추가</p>
            <div className="grid grid-cols-3 gap-1.5">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-[11px] col-span-2" placeholder="컬럼명" />
              <Select value={newType} onValueChange={(v) => setNewType(v as ChecklistColumnType)}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text" className="text-[11px]">텍스트</SelectItem>
                  <SelectItem value="number" className="text-[11px]">숫자</SelectItem>
                  <SelectItem value="multi_url" className="text-[11px]">다중 URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input value={newHelper} onChange={(e) => setNewHelper(e.target.value)} className="h-7 text-[11px]" placeholder="보조 텍스트 (선택, 예: f/u 제외)" />
            <Button size="sm" className="w-full h-7 text-[11px]" disabled={!newName.trim()} onClick={() => addCol.mutate()}>
              <Plus className="size-3 mr-1" /> 추가
            </Button>
          </div>

          {/* Hidden Campaigns */}
          {hiddenCampaigns.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-stone-200">
              <p className="text-[11px] font-bold text-stone-600">숨김 처리된 캠페인 ({hiddenCampaigns.length})</p>
              {hiddenCampaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5">
                  <span className="text-[12px] text-stone-700">{c.client_name || c.campaign_name}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onUnhideCampaign(c.id)}>
                    복원
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
