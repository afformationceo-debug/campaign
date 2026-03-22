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
  '진행전': { label: '진행전', icon: Circle, bg: 'bg-stone-100', text: 'text-stone-500', dot: 'bg-stone-400' },
  '진행중': { label: '진행중', icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  '완료': { label: '완료', icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  '해당없음': { label: '해당없음', icon: Ban, bg: 'bg-stone-50', text: 'text-stone-300', dot: 'bg-stone-300' },
};

const SECTION_COLORS: Record<WorkflowSection, string> = {
  '영업': 'bg-blue-50 text-blue-700 border-blue-200',
  '온보딩': 'bg-amber-50 text-amber-700 border-amber-200',
  '인플루언서': 'bg-purple-50 text-purple-700 border-purple-200',
  '일반고객 CS 대행': 'bg-rose-50 text-rose-700 border-rose-200',
};

const ALL_STATUSES: WorkflowCheckStatus[] = ['진행전', '진행중', '완료', '해당없음'];

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

  useRealtimeWorkflow(selectedCampaignId || undefined);

  // ── 데이터 ──
  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: async () => {
      const { data } = await supabase.from('campaigns').select('*').order('client_name');
      return (data || []) as Campaign[];
    },
  });

  const { data: campaignProducts = [] } = useQuery({
    queryKey: queryKeys.campaignProducts.byCampaign(selectedCampaignId),
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data } = await supabase
        .from('campaign_products')
        .select('*, collaboration_products(*)')
        .eq('campaign_id', selectedCampaignId)
        .order('created_at');
      return (data || []) as CampaignProductWithProduct[];
    },
    enabled: !!selectedCampaignId,
  });

  const { data: workflowTasks = [] } = useQuery({
    queryKey: queryKeys.workflowTasks.all,
    queryFn: async () => {
      const { data } = await supabase.from('workflow_tasks').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as WorkflowTask[];
    },
  });

  const { data: checks = [] } = useQuery({
    queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId),
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data } = await supabase
        .from('campaign_workflow_checks')
        .select('*')
        .eq('campaign_id', selectedCampaignId);
      return (data || []) as CampaignWorkflowCheck[];
    },
    enabled: !!selectedCampaignId,
  });

  // ── 파생 데이터 ──
  const linkedProducts = useMemo(() =>
    campaignProducts.map((cp) => cp.collaboration_products),
    [campaignProducts]
  );

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
    return sectionOrder.map((sec) => ({
      section: sec,
      tasks: workflowTasks.filter((t) => t.section === sec),
    }));
  }, [workflowTasks]);

  const productsToShow = selectedProductId === 'all' ? linkedProducts : linkedProducts.filter((p) => p.id === selectedProductId);

  // ── 통계 ──
  const stats = useMemo(() => {
    const applicable = filteredChecks.filter((c) => c.status !== '해당없음');
    const total = applicable.length;
    const completed = applicable.filter((c) => c.status === '완료').length;
    const inProgress = applicable.filter((c) => c.status === '진행중').length;
    const pending = applicable.filter((c) => c.status === '진행전').length;
    const na = filteredChecks.length - total;
    return { total, completed, inProgress, pending, na, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [filteredChecks]);

  // ── 핸들러 ──
  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(sec) ? next.delete(sec) : next.add(sec);
      return next;
    });
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

    await supabase
      .from('campaign_workflow_checks')
      .update({ status: newStatus, note, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('id', check.id);

    await logActivity({ userId: user?.id, actionType: 'update', targetTable: 'campaign_workflow_checks', targetId: check.id, newValue: { status: newStatus, note } });
    queryClient.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId) });
    setMemoDialog(null);
    setMemoText('');
  };

  const handleBulkChange = async () => {
    if (!bulkDialog) return;
    setBulkLoading(true);

    let targetChecks: CampaignWorkflowCheck[];
    if (bulkDialog.scope === 'section' && bulkDialog.section) {
      const taskIds = new Set(workflowTasks.filter((t) => t.section === bulkDialog.section).map((t) => t.id));
      targetChecks = filteredChecks.filter((c) => taskIds.has(c.workflow_task_id));
    } else {
      targetChecks = filteredChecks;
    }

    // 해당없음 제외 옵션
    if (bulkExcludeNA) {
      targetChecks = targetChecks.filter((c) => c.status !== '해당없음');
    }

    if (targetChecks.length === 0) {
      setBulkLoading(false);
      setBulkDialog(null);
      return;
    }

    const ids = targetChecks.map((c) => c.id);

    // Supabase .in()은 최대 배열 크기 제한 있으므로 chunk 처리
    const CHUNK_SIZE = 100;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      await supabase
        .from('campaign_workflow_checks')
        .update({ status: bulkStatus, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
        .in('id', chunk);
    }

    await logActivity({
      userId: user?.id,
      actionType: 'bulk_update',
      targetTable: 'campaign_workflow_checks',
      newValue: { count: ids.length, status: bulkStatus, scope: bulkDialog.scope, section: bulkDialog.section },
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.workflowChecks.byCampaign(selectedCampaignId) });
    setBulkLoading(false);
    setBulkDialog(null);
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 p-6">
      {/* Header */}
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">워크플로우 체크리스트</h1>
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
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className={c.status !== 'active' ? 'text-stone-400' : ''}>{c.client_name} {c.campaign_name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {linkedProducts.length > 0 && (
          <div className="min-w-[200px]">
            <Label className="text-xs text-stone-500 mb-1.5 block">협업상품 필터</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상품</SelectItem>
                {linkedProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedCampaignId && filteredChecks.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setBulkDialog({ scope: 'all' })}>
            전체 일괄변경
          </Button>
        )}
      </motion.div>

      {/* Stats + Progress */}
      {selectedCampaignId && filteredChecks.length > 0 && (
        <motion.div variants={fadeUpItem} className="space-y-3">
          {/* Progress bar */}
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-stone-700">전체 진행률</span>
              <span className="text-2xl font-black text-stone-900">{stats.rate}%</span>
            </div>
            <Progress value={stats.rate} className="h-3" />
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-stone-600">완료 {stats.completed}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-amber-500" />
                <span className="text-xs text-stone-600">진행중 {stats.inProgress}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-stone-400" />
                <span className="text-xs text-stone-600">진행전 {stats.pending}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-stone-200" />
                <span className="text-xs text-stone-400">해당없음 {stats.na}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* No campaign selected */}
      {!selectedCampaignId && (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg font-medium">캠페인을 선택해주세요</p>
          <p className="text-sm mt-1">캠페인을 선택하면 연결된 협업상품의 워크플로우를 확인할 수 있습니다.</p>
        </div>
      )}

      {/* No products linked */}
      {selectedCampaignId && linkedProducts.length === 0 && checks.length === 0 && (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg font-medium">연결된 협업상품이 없습니다</p>
          <p className="text-sm mt-1">캠페인 관리에서 협업상품을 연결해주세요.</p>
        </div>
      )}

      {/* Checklist by section */}
      {selectedCampaignId && productsToShow.length > 0 && sections.map(({ section, tasks }) => {
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
            {/* Section Header */}
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
                {/* Section mini stats */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold">{sectionRate}%</span>
                  <span className="opacity-60">({sectionDone}/{sectionTotal})</span>
                  {sectionInProgress > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700">{sectionInProgress} 진행중</Badge>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={(e) => { e.stopPropagation(); setBulkDialog({ scope: 'section', section }); }}
                  >
                    일괄변경
                  </Button>
                )}
              </div>
            </div>

            {/* Section progress bar */}
            {!isCollapsed && sectionTotal > 0 && (
              <div className="px-4 py-1.5 bg-stone-50/50 border-b border-stone-100">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-stone-200">
                  {sectionDone > 0 && <div className="bg-emerald-500" style={{ width: `${(sectionDone / sectionTotal) * 100}%` }} />}
                  {sectionInProgress > 0 && <div className="bg-amber-400" style={{ width: `${(sectionInProgress / sectionTotal) * 100}%` }} />}
                </div>
              </div>
            )}

            {/* Tasks */}
            {!isCollapsed && (
              <div className="divide-y divide-stone-100 bg-white">
                {tasks.map((task) => {
                  // 이 TASK의 모든 상품 체크 상태 수집
                  const taskChecks = productsToShow.map((p) => checkMap.get(`${p.id}:${task.id}`)).filter(Boolean) as CampaignWorkflowCheck[];
                  const hasNA = taskChecks.every((c) => c.status === '해당없음');

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 transition-colors',
                        hasNA ? 'bg-stone-50/30' : 'hover:bg-stone-50/50'
                      )}
                    >
                      {/* Task number */}
                      <span className={cn('text-xs w-6 text-right shrink-0 font-mono', hasNA ? 'text-stone-300' : 'text-stone-400')}>
                        {task.task_number}.
                      </span>

                      {/* Task name */}
                      <span className={cn('flex-1 text-sm', hasNA ? 'text-stone-300 line-through' : 'text-stone-700')}>
                        {task.task_name}
                      </span>

                      {/* Per-product status dropdowns */}
                      <div className="flex items-center gap-2 shrink-0">
                        {productsToShow.map((product) => {
                          const check = checkMap.get(`${product.id}:${task.id}`);
                          if (!check) return null;
                          const cfg = STATUS_CONFIG[check.status];
                          const Icon = cfg.icon;
                          return (
                            <Tooltip key={product.id}>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  {productsToShow.length > 1 && (
                                    <span className="text-[10px] text-stone-400 max-w-[60px] truncate">{product.product_name}</span>
                                  )}
                                  <Select
                                    value={check.status}
                                    onValueChange={(v) => handleStatusChange(check, v as WorkflowCheckStatus)}
                                  >
                                    <SelectTrigger className={cn('h-7 w-[105px] text-xs border rounded-lg', cfg.bg, cfg.text, 'border-transparent')}>
                                      <div className="flex items-center gap-1.5">
                                        <Icon className="size-3.5" />
                                        <span className="font-medium">{cfg.label}</span>
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ALL_STATUSES.map((s) => {
                                        const sc = STATUS_CONFIG[s];
                                        const SIcon = sc.icon;
                                        return (
                                          <SelectItem key={s} value={s}>
                                            <div className="flex items-center gap-1.5">
                                              <SIcon className={cn('size-3.5', sc.text)} />
                                              <span>{sc.label}</span>
                                            </div>
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                  {check.note && <MessageSquare className="size-3 text-blue-400" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[300px]">
                                <p className="font-medium text-xs">{product.product_name} — {cfg.label}</p>
                                {check.note && <p className="text-xs text-muted-foreground mt-1">{check.note}</p>}
                              </TooltipContent>
                            </Tooltip>
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
          <DialogHeader>
            <DialogTitle className="text-base">상태 변경</DialogTitle>
          </DialogHeader>
          {memoDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={cn(STATUS_CONFIG[memoDialog.check.status].bg, STATUS_CONFIG[memoDialog.check.status].text)}>{memoDialog.check.status}</Badge>
                <span className="text-stone-400">→</span>
                <Badge className={cn(STATUS_CONFIG[memoDialog.newStatus].bg, STATUS_CONFIG[memoDialog.newStatus].text)}>{memoDialog.newStatus}</Badge>
              </div>
              <div>
                <Label className="text-xs text-stone-500">메모 (선택)</Label>
                <Input
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  className="mt-1"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) confirmStatusChange(false); }}
                />
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
            <DialogTitle className="text-base">
              {bulkDialog?.scope === 'section' ? `[${bulkDialog.section}] 일괄 상태변경` : '전체 일괄 상태변경'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-stone-500">변경할 상태</Label>
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as WorkflowCheckStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => {
                    const sc = STATUS_CONFIG[s];
                    const SIcon = sc.icon;
                    return (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-1.5">
                          <SIcon className={cn('size-3.5', sc.text)} />
                          <span>{sc.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
              <div>
                <Label className="text-xs text-stone-700 font-medium">&quot;해당없음&quot; 항목 제외</Label>
                <p className="text-[10px] text-stone-400 mt-0.5">해당없음 상태는 변경하지 않습니다</p>
              </div>
              <Switch checked={bulkExcludeNA} onCheckedChange={setBulkExcludeNA} />
            </div>
            {bulkDialog && (
              <p className="text-xs text-stone-500 bg-stone-50 rounded-lg p-2.5">
                {(() => {
                  let targets = bulkDialog.scope === 'section' && bulkDialog.section
                    ? filteredChecks.filter((c) => {
                        const taskIds = new Set(workflowTasks.filter((t) => t.section === bulkDialog.section).map((t) => t.id));
                        return taskIds.has(c.workflow_task_id);
                      })
                    : filteredChecks;
                  if (bulkExcludeNA) targets = targets.filter((c) => c.status !== '해당없음');
                  return `${targets.length}개 항목이 "${STATUS_CONFIG[bulkStatus].label}"(으)로 변경됩니다.`;
                })()}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBulkDialog(null)}>취소</Button>
            <Button size="sm" onClick={handleBulkChange} disabled={bulkLoading}>
              {bulkLoading ? '변경 중...' : '일괄 변경'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
