'use client';

// Plan Ref: campaign-checklist-dashboard §4 — 캠페인별 필수 체크리스트 섹션
// 자격 필터: collaboration_products.product_name='해외환자유치상품' AND target_country != '중화권(홍,말,싱)'

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Pencil, Copy, Search, X, Check,
  Flame, Trophy, Link as LinkIcon, Settings2, ChevronDown,
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
};

const DEFAULT_THEME = SECTION_THEME.purple;
const getTheme = (t: string) => SECTION_THEME[t] || DEFAULT_THEME;

// Design Ref: §3 — 중화권 제외 키워드
const EXCLUDED_TARGET_COUNTRY = '중화권(홍,말,싱)';
const ELIGIBLE_PRODUCT_NAME = '해외환자유치상품';

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

      // 3) campaigns에서 중화권 제외
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .in('id', ids)
        .neq('target_country', EXCLUDED_TARGET_COUNTRY)
        .order('client_name', { ascending: true });
      return (campaigns || []) as Campaign[];
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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_campaign_overrides' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaignChecklist.overrides });
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
  }, [queryClient, dateStr]);

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

    type Row = { campaign: Campaign; uploadCount: number; isUrgent: boolean; urgentReason: string[] };
    const rows: Row[] = visibleCampaigns.map((c) => {
      const infReviewUrls = colInfluencerReview ? getRecord(c.id, colInfluencerReview.id)?.value_urls || [] : [];
      const custReviewUrls = colCustomerReview ? getRecord(c.id, colCustomerReview.id)?.value_urls || [] : [];
      const infReserve = colInfluencerReserve ? parseNumber(getRecord(c.id, colInfluencerReserve.id)?.value_text) : 0;
      const custReserve = colCustomerReserve ? parseNumber(getRecord(c.id, colCustomerReserve.id)?.value_text) : 0;

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
    }) => {
      const payload = {
        campaign_id: args.campaignId,
        column_id: args.columnId,
        record_date: dateStr,
        value_text: args.valueText ?? null,
        value_urls: args.valueUrls ?? null,
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
            lines.push(`- ${col.name}: -`);
          } else {
            lines.push(`- ${col.name}:`);
            for (const u of urls) lines.push(`  ${u}`);
          }
        } else {
          const v = rec?.value_text?.trim() || '-';
          lines.push(`- ${col.name}: ${v}`);
        }
      }
    }
    return lines.join('\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, columnsBySection, recordsMap]);

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
          {/* Summary Cards */}
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

          {/* Grid Table */}
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
                        className={cn('border-b border-stone-200 px-2 py-1.5 text-[11px] font-medium min-w-[110px]', theme.col)}
                      >
                        <div className="flex flex-col leading-tight">
                          <span>{c.name}</span>
                          {c.helper_text && (
                            <span className="text-[9px] font-normal text-stone-500 mt-0.5">{c.helper_text}</span>
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
                    <td colSpan={columns.length + 2} className="text-center text-[12px] text-stone-400 py-8">
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
                            onSave={(valueText, valueUrls) =>
                              upsertRecord.mutate({ campaignId: campaign.id, columnId: col.id, valueText, valueUrls })
                            }
                          />
                        </td>
                      ));
                    })}
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
        </div>
      )}

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

// ─── Cell Editor (Popover) ───────────────────────────────────
function CellEditor({
  record,
  column,
  onSave,
}: {
  record: ChecklistCampaignRecord | undefined;
  column: ChecklistColumn;
  onSave: (valueText: string | null, valueUrls: string[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(record?.value_text ?? '');
  const [urls, setUrls] = useState<string[]>(record?.value_urls ?? []);

  useEffect(() => {
    if (open) {
      setText(record?.value_text ?? '');
      setUrls(record?.value_urls ?? []);
    }
  }, [open, record]);

  const isMultiUrl = column.input_type === 'multi_url';
  const isNumber = column.input_type === 'number';

  const hasValue = isMultiUrl
    ? (record?.value_urls?.length || 0) > 0
    : !!record?.value_text?.trim();

  const preview = isMultiUrl
    ? `${record?.value_urls?.length || 0}건`
    : truncate(record?.value_text || '');

  const handleSave = () => {
    if (isMultiUrl) {
      const cleaned = urls.map((u) => u.trim()).filter(Boolean);
      onSave(null, cleaned.length > 0 ? cleaned : null);
    } else {
      const v = text.trim();
      onSave(v || null, null);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full min-h-[32px] rounded-md px-2 py-1 text-left text-[12px] transition-all',
            hasValue
              ? 'bg-blue-50 text-blue-800 font-semibold ring-1 ring-blue-200 hover:ring-blue-400'
              : 'bg-stone-50 text-stone-400 hover:bg-white hover:ring-1 hover:ring-stone-300'
          )}
        >
          {hasValue ? preview : '입력...'}
          {isMultiUrl && hasValue && <LinkIcon className="inline-block ml-1 size-3" />}
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
