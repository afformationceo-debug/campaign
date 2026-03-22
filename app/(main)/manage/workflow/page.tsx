'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Circle, Ban, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeWorkflow } from '@/hooks/use-realtime-workflow';
import { logActivity } from '@/lib/utils/log-activity';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import type {
  Campaign,
  WorkflowTask,
  CampaignWorkflowCheck,
  CampaignProductWithProduct,
  WorkflowCheckStatus,
  WorkflowSection,
} from '@/lib/types/database';

const supabase = createClient();

const STATUS_CONFIG: Record<WorkflowCheckStatus, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  '진행전': { label: '진행전', icon: Circle, bg: 'bg-stone-100', text: 'text-stone-500', dot: 'bg-stone-300' },
  '진행중': { label: '진행중', icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  '완료': { label: '완료', icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  '해당없음': { label: '해당없음', icon: Ban, bg: 'bg-stone-50', text: 'text-stone-300', dot: 'bg-stone-200' },
};

const SECTION_COLORS: Record<WorkflowSection, string> = {
  '영업': 'bg-blue-50 text-blue-700 border-blue-200',
  '온보딩': 'bg-amber-50 text-amber-700 border-amber-200',
  '인플루언서': 'bg-purple-50 text-purple-700 border-purple-200',
  '일반고객 CS 대행': 'bg-rose-50 text-rose-700 border-rose-200',
};

const ALL_STATUSES: WorkflowCheckStatus[] = ['진행전', '진행중', '완료', '해당없음'];
const VIEW_ALL = '__ALL__';

export default function WorkflowPage() {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [memoDialog, setMemoDialog] = useState<{ check: CampaignWorkflowCheck; newStatus: WorkflowCheckStatus } | null>(null);
  const [memoText, setMemoText] = useState('');
  const [bulkDialog, setBulkDialog] = useState<{ scope: 'section' | 'all'; section?: WorkflowSection } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<WorkflowCheckStatus>('완료');
  const [bulkExcludeNA, setBulkExcludeNA] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [cellDetail, setCellDetail] = useState<{ check: CampaignWorkflowCheck; campaignName: string; taskName: string } | null>(null);
  const [cellDetailStatus, setCellDetailStatus] = useState<WorkflowCheckStatus>('진행전');
  const [cellDetailMemo, setCellDetailMemo] = useState('');

  const isAllView = selectedCampaignId === VIEW_ALL;
  useRealtimeWorkflow(isAllView ? undefined : (selectedCampaignId || undefined));

  // ── 공통 데이터 ──
  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: async () => {
      const { data } = await supabase.from('campaigns').select('*').order('campaign_name');
      return (data || []) as Campaign[];
    },
  });

  const { data: workflowTasks = [] } = useQuery({
    queryKey: queryKeys.workflowTasks.all,
    queryFn: async () => {
      const { data } = await supabase.from('workflow_tasks').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as WorkflowTask[];
    },
  });

  // ── 전체 뷰용: 모든 체크 데이터 ──
  const { data: allChecks = [] } = useQuery({
    queryKey: ['workflowChecks', 'all'],
    queryFn: async () => {
      const { data } = await supabase.from('campaign_workflow_checks').select('*');
      return (data || []) as CampaignWorkflowCheck[];
    },
    enabled: isAllView,
  });

  // ── 전체 뷰용: 모든 캠페인-상품 연결 ──
  const { data: allCampaignProducts = [] } = useQuery({
    queryKey: queryKeys.campaignProducts.all,
    queryFn: async () => {
      const { data } = await supabase.from('campaign_products').select('*, collaboration_products(*)').order('created_at');
      return (data || []) as CampaignProductWithProduct[];
    },
    enabled: isAllView,
  });

  // ── 개별 뷰용 데이터 ──
  const { data: campaignProducts = [] } = useQuery({
    queryKey: queryKeys.campaignProducts.byCampaign(selectedCampaignId),
    queryFn: async () => {
      if (!selectedCampaignId || isAllView) return [];
      const { data } = await supabase.from('campaign_products').select('*, collaboration_products(*)').eq('campaign_id', selectedCampaignId).order('created_at');
      return (data || []) as CampaignProductWithProduct[];
    },
    enabled: !!selectedCampaignId && !isAllView,
  });

  const { data: checks = [] } = useQuery({
    queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId),
    queryFn: async () => {
      if (!selectedCampaignId || isAllView) return [];
      const { data } = await supabase.from('campaign_workflow_checks').select('*').eq('campaign_id', selectedCampaignId);
      return (data || []) as CampaignWorkflowCheck[];
    },
    enabled: !!selectedCampaignId && !isAllView,
  });

  // ── 파생 데이터 ──
  const linkedProducts = useMemo(() => campaignProducts.map((cp) => cp.collaboration_products), [campaignProducts]);

  const filteredChecks = useMemo(() => {
    if (selectedProductId === 'all') return checks;
    return checks.filter((c) => c.product_id === selectedProductId);
  }, [checks, selectedProductId]);

  const checkMap = useMemo(() => {
    const map = new Map<string, CampaignWorkflowCheck>();
    filteredChecks.forEach((c) => map.set(`${c.product_id}:${c.workflow_task_id}`, c));
    return map;
  }, [filteredChecks]);

  const sections = useMemo(() => {
    const sectionOrder: WorkflowSection[] = ['영업', '온보딩', '인플루언서', '일반고객 CS 대행'];
    return sectionOrder.map((sec) => ({ section: sec, tasks: workflowTasks.filter((t) => t.section === sec) }));
  }, [workflowTasks]);

  const productsToShow = selectedProductId === 'all' ? linkedProducts : linkedProducts.filter((p) => p.id === selectedProductId);

  // ── 전체 뷰: 매트릭스 데이터 ──
  const matrixCampaigns = useMemo(() => {
    if (!isAllView) return [];
    const campaignIds = new Set(allCampaignProducts.map((cp) => cp.campaign_id));
    return campaigns.filter((c) => campaignIds.has(c.id));
  }, [isAllView, allCampaignProducts, campaigns]);

  const matrixCheckMap = useMemo(() => {
    if (!isAllView) return new Map<string, CampaignWorkflowCheck>();
    const map = new Map<string, CampaignWorkflowCheck>();
    allChecks.forEach((c) => map.set(`${c.campaign_id}:${c.workflow_task_id}`, c));
    return map;
  }, [isAllView, allChecks]);

  // ── 통계 ──
  const stats = useMemo(() => {
    const source = isAllView ? allChecks : filteredChecks;
    const applicable = source.filter((c) => c.status !== '해당없음');
    const total = applicable.length;
    const completed = applicable.filter((c) => c.status === '완료').length;
    const inProgress = applicable.filter((c) => c.status === '진행중').length;
    const pending = applicable.filter((c) => c.status === '진행전').length;
    const na = source.length - total;
    return { total, completed, inProgress, pending, na, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [isAllView, allChecks, filteredChecks]);

  // ── 핸들러 ──
  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => { const n = new Set(prev); n.has(sec) ? n.delete(sec) : n.add(sec); return n; });
  };

  const handleStatusChange = (check: CampaignWorkflowCheck, newStatus: WorkflowCheckStatus) => {
    if (check.status === newStatus) return;
    setMemoDialog({ check, newStatus });
    setMemoText(check.note || '');
  };

  const confirmStatusChange = async (skipMemo: boolean) => {
    if (!memoDialog) return;
    const { check, newStatus } = memoDialog;
    const note = skipMemo ? check.note : (memoText || null);
    await supabase.from('campaign_workflow_checks').update({ status: newStatus, note, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', check.id);
    await logActivity({ userId: user?.id, actionType: 'update', targetTable: 'campaign_workflow_checks', targetId: check.id, newValue: { status: newStatus, note } });
    if (isAllView) {
      queryClient.invalidateQueries({ queryKey: ['workflowChecks', 'all'] });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId) });
    }
    setMemoDialog(null);
    setMemoText('');
  };

  const handleBulkChange = async () => {
    if (!bulkDialog) return;
    setBulkLoading(true);
    let targetChecks: CampaignWorkflowCheck[];
    const source = isAllView ? allChecks : filteredChecks;
    if (bulkDialog.scope === 'section' && bulkDialog.section) {
      const taskIds = new Set(workflowTasks.filter((t) => t.section === bulkDialog.section).map((t) => t.id));
      targetChecks = source.filter((c) => taskIds.has(c.workflow_task_id));
    } else {
      targetChecks = source;
    }
    if (bulkExcludeNA) targetChecks = targetChecks.filter((c) => c.status !== '해당없음');
    if (targetChecks.length > 0) {
      const ids = targetChecks.map((c) => c.id);
      for (let i = 0; i < ids.length; i += 100) {
        await supabase.from('campaign_workflow_checks').update({ status: bulkStatus, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }).in('id', ids.slice(i, i + 100));
      }
      await logActivity({ userId: user?.id, actionType: 'bulk_update', targetTable: 'campaign_workflow_checks', newValue: { count: ids.length, status: bulkStatus } });
    }
    if (isAllView) {
      queryClient.invalidateQueries({ queryKey: ['workflowChecks', 'all'] });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId) });
    }
    setBulkLoading(false);
    setBulkDialog(null);
  };

  const showStats = (isAllView && allChecks.length > 0) || (!isAllView && selectedCampaignId && filteredChecks.length > 0);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 p-6">
      {/* Header */}
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">캠페인별 워크플로우</h1>
          <p className="text-sm text-stone-500 mt-1">캠페인별 협업상품 세팅 진행 현황</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUpItem} className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[280px]">
          <Label className="text-xs text-stone-500 mb-1.5 block">캠페인 선택</Label>
          <Select value={selectedCampaignId} onValueChange={(v) => { setSelectedCampaignId(v); setSelectedProductId('all'); }}>
            <SelectTrigger><SelectValue placeholder="캠페인을 선택하세요" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={VIEW_ALL}><span className="font-bold">전체 캠페인 (매트릭스)</span></SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className={c.status !== 'active' ? 'text-stone-400' : ''}>{c.campaign_name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isAllView && linkedProducts.length > 0 && (
          <div className="min-w-[200px]">
            <Label className="text-xs text-stone-500 mb-1.5 block">협업상품 필터</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상품</SelectItem>
                {linkedProducts.map((p) => (<SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showStats && (
          <Button variant="outline" size="sm" onClick={() => setBulkDialog({ scope: 'all' })}>
            전체 일괄변경
          </Button>
        )}
      </motion.div>

      {/* Stats */}
      {showStats && (
        <motion.div variants={fadeUpItem}>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-stone-700">전체 진행률</span>
              <span className="text-2xl font-black text-stone-900">{stats.rate}%</span>
            </div>
            <Progress value={stats.rate} className="h-3" />
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-stone-600">완료 {stats.completed}</span></div>
              <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-amber-500" /><span className="text-xs text-stone-600">진행중 {stats.inProgress}</span></div>
              <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-stone-400" /><span className="text-xs text-stone-600">진행전 {stats.pending}</span></div>
              <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-stone-200" /><span className="text-xs text-stone-400">해당없음 {stats.na}</span></div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!selectedCampaignId && (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg font-medium">캠페인을 선택해주세요</p>
          <p className="text-sm mt-1">개별 캠페인 또는 &quot;전체 캠페인&quot;을 선택하세요.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          전체 캠페인 매트릭스 뷰
         ══════════════════════════════════════════════════════ */}
      {isAllView && matrixCampaigns.length > 0 && sections.map(({ section, tasks }) => {
        const isCollapsed = collapsedSections.has(section);
        return (
          <motion.div key={section} variants={fadeUpItem} className="rounded-xl border border-stone-200 overflow-hidden">
            <div
              className={cn('flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b', SECTION_COLORS[section])}
              onClick={() => toggleSection(section)}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                <span className="font-bold text-sm">[{section}]</span>
                <span className="text-xs opacity-70">{tasks[0]?.task_number}~{tasks[tasks.length - 1]?.task_number}번</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setBulkDialog({ scope: 'section', section }); }}>
                일괄변경
              </Button>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-100">
                      <th className="sticky left-0 z-10 bg-stone-50 text-left py-2 px-3 font-semibold text-stone-500 min-w-[250px] border-r border-stone-200">TASK</th>
                      {matrixCampaigns.map((c) => (
                        <th key={c.id} className="py-2 px-1 font-medium text-stone-500 min-w-[36px] max-w-[36px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="writing-vertical-rl text-[10px] leading-tight h-[100px] overflow-hidden cursor-default whitespace-nowrap">
                                {c.campaign_name}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p className="text-xs">{c.campaign_name}</p></TooltipContent>
                          </Tooltip>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-b border-stone-50 hover:bg-stone-50/30">
                        <td className="sticky left-0 z-10 bg-white py-1.5 px-3 text-stone-700 border-r border-stone-100 whitespace-nowrap">
                          <span className="text-stone-400 mr-1">{task.task_number}.</span>{task.task_name}
                        </td>
                        {matrixCampaigns.map((campaign) => {
                          const check = matrixCheckMap.get(`${campaign.id}:${task.id}`);
                          if (!check) return <td key={campaign.id} className="text-center py-1.5"><span className="text-stone-200">-</span></td>;
                          const cfg = STATUS_CONFIG[check.status];
                          return (
                            <td key={campaign.id} className="text-center py-1.5 px-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={cn('size-6 rounded-md flex items-center justify-center mx-auto transition-all hover:scale-125 hover:shadow-sm cursor-pointer', cfg.bg)}
                                    onClick={() => {
                                      setCellDetail({ check, campaignName: campaign.campaign_name, taskName: task.task_name });
                                      setCellDetailStatus(check.status);
                                      setCellDetailMemo(check.note || '');
                                    }}
                                  >
                                    <div className={cn('size-2.5 rounded-full', cfg.dot)} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px]">
                                  <p className="font-medium">{campaign.campaign_name}</p>
                                  <p className="text-muted-foreground">{task.task_name}: <span className={cfg.text}>{cfg.label}</span></p>
                                  {check.note && <p className="text-muted-foreground mt-1">{check.note}</p>}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* ══════════════════════════════════════════════════════
          개별 캠페인 상세 뷰 (기존)
         ══════════════════════════════════════════════════════ */}
      {!isAllView && selectedCampaignId && linkedProducts.length === 0 && checks.length === 0 && (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg font-medium">연결된 협업상품이 없습니다</p>
          <p className="text-sm mt-1">캠페인 관리에서 협업상품을 연결해주세요.</p>
        </div>
      )}

      {!isAllView && selectedCampaignId && productsToShow.length > 0 && sections.map(({ section, tasks }) => {
        const isCollapsed = collapsedSections.has(section);
        const sectionTaskIds = new Set(tasks.map((t) => t.id));
        const sectionChecks = filteredChecks.filter((c) => sectionTaskIds.has(c.workflow_task_id));
        const applicable = sectionChecks.filter((c) => c.status !== '해당없음');
        const sectionDone = applicable.filter((c) => c.status === '완료').length;
        const sectionInProgress = applicable.filter((c) => c.status === '진행중').length;
        const sectionTotal = applicable.length;
        const sectionRate = sectionTotal > 0 ? Math.round((sectionDone / sectionTotal) * 100) : 0;

        return (
          <motion.div key={section} variants={fadeUpItem} className="rounded-xl border border-stone-200 overflow-hidden">
            <div
              className={cn('flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b', SECTION_COLORS[section])}
              onClick={() => toggleSection(section)}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                <span className="font-bold text-sm">[{section}]</span>
                <span className="text-xs opacity-70">{tasks[0]?.task_number}~{tasks[tasks.length - 1]?.task_number}번</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold">{sectionRate}%</span>
                  <span className="opacity-60">({sectionDone}/{sectionTotal})</span>
                  {sectionInProgress > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700">{sectionInProgress} 진행중</Badge>}
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setBulkDialog({ scope: 'section', section }); }}>
                    일괄변경
                  </Button>
                )}
              </div>
            </div>

            {!isCollapsed && sectionTotal > 0 && (
              <div className="px-4 py-1.5 bg-stone-50/50 border-b border-stone-100">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-stone-200">
                  {sectionDone > 0 && <div className="bg-emerald-500" style={{ width: `${(sectionDone / sectionTotal) * 100}%` }} />}
                  {sectionInProgress > 0 && <div className="bg-amber-400" style={{ width: `${(sectionInProgress / sectionTotal) * 100}%` }} />}
                </div>
              </div>
            )}

            {!isCollapsed && (
              <div className="divide-y divide-stone-100 bg-white">
                {tasks.map((task) => {
                  const taskChecks = productsToShow.map((p) => checkMap.get(`${p.id}:${task.id}`)).filter(Boolean) as CampaignWorkflowCheck[];
                  const hasNA = taskChecks.every((c) => c.status === '해당없음');
                  return (
                    <div key={task.id} className={cn('flex items-center gap-2 px-4 py-2.5 transition-colors', hasNA ? 'bg-stone-50/30' : 'hover:bg-stone-50/50')}>
                      <span className={cn('text-xs w-6 text-right shrink-0 font-mono', hasNA ? 'text-stone-300' : 'text-stone-400')}>{task.task_number}.</span>
                      <span className={cn('flex-1 text-sm', hasNA ? 'text-stone-300 line-through' : 'text-stone-700')}>{task.task_name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {productsToShow.map((product) => {
                          const check = checkMap.get(`${product.id}:${task.id}`);
                          if (!check) return null;
                          const cfg = STATUS_CONFIG[check.status];
                          const Icon = cfg.icon;
                          return (
                            <div key={product.id} className="flex items-center gap-1">
                              {productsToShow.length > 1 && <span className="text-[10px] text-stone-400 max-w-[60px] truncate">{product.product_name}</span>}
                              <button
                                type="button"
                                className={cn('h-7 px-2.5 text-xs border rounded-lg flex items-center gap-1.5 transition-all hover:shadow-sm hover:scale-[1.02] cursor-pointer', cfg.bg, cfg.text, 'border-transparent')}
                                onClick={() => {
                                  setCellDetail({ check, campaignName: campaigns.find(c => c.id === check.campaign_id)?.campaign_name || '', taskName: task.task_name });
                                  setCellDetailStatus(check.status);
                                  setCellDetailMemo(check.note || '');
                                }}
                              >
                                <Icon className="size-3.5" />
                                <span className="font-medium">{cfg.label}</span>
                                {check.note && <MessageSquare className="size-3 text-blue-400 ml-0.5" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Memo Dialog */}
      <Dialog open={!!memoDialog} onOpenChange={() => setMemoDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-base">상태 변경</DialogTitle></DialogHeader>
          {memoDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={cn(STATUS_CONFIG[memoDialog.check.status].bg, STATUS_CONFIG[memoDialog.check.status].text)}>{memoDialog.check.status}</Badge>
                <span className="text-stone-400">→</span>
                <Badge className={cn(STATUS_CONFIG[memoDialog.newStatus].bg, STATUS_CONFIG[memoDialog.newStatus].text)}>{memoDialog.newStatus}</Badge>
              </div>
              <div>
                <Label className="text-xs text-stone-500">메모 (선택)</Label>
                <Input value={memoText} onChange={(e) => setMemoText(e.target.value)} placeholder="메모를 입력하세요..." className="mt-1"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) confirmStatusChange(false); }} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => confirmStatusChange(true)}>건너뛰기</Button>
            <Button size="sm" onClick={() => confirmStatusChange(false)}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Change Dialog */}
      <Dialog open={!!bulkDialog} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base">{bulkDialog?.scope === 'section' ? `[${bulkDialog.section}] 일괄 상태변경` : '전체 일괄 상태변경'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-stone-500">변경할 상태</Label>
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as WorkflowCheckStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => { const sc = STATUS_CONFIG[s]; const SIcon = sc.icon; return (
                    <SelectItem key={s} value={s}><div className="flex items-center gap-1.5"><SIcon className={cn('size-3.5', sc.text)} /><span>{sc.label}</span></div></SelectItem>
                  ); })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
              <div><Label className="text-xs text-stone-700 font-medium">&quot;해당없음&quot; 항목 제외</Label><p className="text-[10px] text-stone-400 mt-0.5">해당없음 상태는 변경하지 않습니다</p></div>
              <Switch checked={bulkExcludeNA} onCheckedChange={setBulkExcludeNA} />
            </div>
            {bulkDialog && (
              <p className="text-xs text-stone-500 bg-stone-50 rounded-lg p-2.5">
                {(() => {
                  const source = isAllView ? allChecks : filteredChecks;
                  let targets = bulkDialog.scope === 'section' && bulkDialog.section
                    ? source.filter((c) => { const tids = new Set(workflowTasks.filter((t) => t.section === bulkDialog.section).map((t) => t.id)); return tids.has(c.workflow_task_id); })
                    : source;
                  if (bulkExcludeNA) targets = targets.filter((c) => c.status !== '해당없음');
                  return `${targets.length}개 항목이 "${STATUS_CONFIG[bulkStatus].label}"(으)로 변경됩니다.`;
                })()}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBulkDialog(null)}>취소</Button>
            <Button size="sm" onClick={handleBulkChange} disabled={bulkLoading}>{bulkLoading ? '변경 중...' : '일괄 변경'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSS for vertical text */}
      {/* Cell Detail Dialog (상태 변경 + 메모) */}
      <Dialog open={!!cellDetail} onOpenChange={() => setCellDetail(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base">업무 상태 변경</DialogTitle>
          </DialogHeader>
          {cellDetail && (
            <div className="space-y-4">
              {/* 캠페인 / TASK 정보 */}
              <div className="rounded-lg bg-stone-50 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">캠페인</span>
                  <span className="text-sm font-medium text-stone-800">{cellDetail.campaignName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">업무</span>
                  <span className="text-sm text-stone-700">{cellDetail.taskName}</span>
                </div>
              </div>

              {/* 상태 선택 */}
              <div>
                <Label className="text-xs text-stone-500 mb-2 block">상태</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_STATUSES.map((s) => {
                    const sc = STATUS_CONFIG[s];
                    const SIcon = sc.icon;
                    const isSelected = cellDetailStatus === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-xl p-2.5 border-2 transition-all text-xs font-medium',
                          isSelected ? 'border-orange-400 shadow-sm' : 'border-transparent hover:border-stone-200',
                          sc.bg, sc.text
                        )}
                        onClick={() => setCellDetailStatus(s)}
                      >
                        <SIcon className="size-5" />
                        <span>{sc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 메모 */}
              <div>
                <Label className="text-xs text-stone-500">메모</Label>
                <Input
                  value={cellDetailMemo}
                  onChange={(e) => setCellDetailMemo(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  className="mt-1"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    // save
                    (async () => {
                      await supabase.from('campaign_workflow_checks').update({ status: cellDetailStatus, note: cellDetailMemo || null, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', cellDetail.check.id);
                      if (isAllView) queryClient.invalidateQueries({ queryKey: ['workflowChecks', 'all'] });
                      else queryClient.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId) });
                      setCellDetail(null);
                    })();
                  }}}
                />
              </div>

              {/* 현재 메모 표시 */}
              {cellDetail.check.note && cellDetailMemo === cellDetail.check.note && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
                  <p className="text-[10px] text-blue-500 font-semibold mb-0.5">기존 메모</p>
                  <p className="text-xs text-blue-700">{cellDetail.check.note}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCellDetail(null)}>취소</Button>
            <Button size="sm" onClick={async () => {
              if (!cellDetail) return;
              await supabase.from('campaign_workflow_checks').update({ status: cellDetailStatus, note: cellDetailMemo || null, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', cellDetail.check.id);
              await logActivity({ userId: user?.id, actionType: 'update', targetTable: 'campaign_workflow_checks', targetId: cellDetail.check.id, newValue: { status: cellDetailStatus, note: cellDetailMemo } });
              if (isAllView) queryClient.invalidateQueries({ queryKey: ['workflowChecks', 'all'] });
              else queryClient.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId) });
              setCellDetail(null);
            }}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`.writing-vertical-rl { writing-mode: vertical-rl; text-orientation: mixed; }`}</style>
    </motion.div>
  );
}
