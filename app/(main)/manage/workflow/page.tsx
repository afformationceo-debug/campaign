'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Circle, Ban, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeWorkflow } from '@/hooks/use-realtime-workflow';
import { useUpdateWorkflowCheck, useBulkUpdateWorkflowChecks } from '@/hooks/use-workflow-mutations';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type {
  Campaign,
  CollaborationProduct,
  WorkflowTask,
  CampaignWorkflowCheck,
  CampaignProductWithProduct,
  WorkflowCheckStatus,
  WorkflowSection,
} from '@/lib/types/database';

const supabase = createClient();

const STATUS_CONFIG: Record<WorkflowCheckStatus, { label: string; icon: React.ElementType; className: string; textClass: string }> = {
  '진행전': { label: '진행전', icon: Circle, className: 'bg-stone-100 text-stone-500', textClass: 'text-stone-600' },
  '진행중': { label: '진행중', icon: Clock, className: 'bg-amber-100 text-amber-600', textClass: 'text-amber-700' },
  '완료': { label: '완료', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-600', textClass: 'text-emerald-700' },
  '해당없음': { label: '해당없음', icon: Ban, className: 'bg-stone-50 text-stone-300', textClass: 'text-stone-400 line-through' },
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
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [memoDialog, setMemoDialog] = useState<{ check: CampaignWorkflowCheck; newStatus: WorkflowCheckStatus } | null>(null);
  const [memoText, setMemoText] = useState('');
  const [bulkDialog, setBulkDialog] = useState<{ scope: 'section' | 'all'; section?: WorkflowSection } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<WorkflowCheckStatus>('완료');
  const [bulkExcludeNA, setBulkExcludeNA] = useState(true);

  useRealtimeWorkflow(selectedCampaignId || undefined);
  const updateCheck = useUpdateWorkflowCheck();
  const bulkUpdate = useBulkUpdateWorkflowChecks();

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
    const total = filteredChecks.filter((c) => c.status !== '해당없음').length;
    const completed = filteredChecks.filter((c) => c.status === '완료').length;
    const inProgress = filteredChecks.filter((c) => c.status === '진행중').length;
    const pending = filteredChecks.filter((c) => c.status === '진행전').length;
    return { total, completed, inProgress, pending, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
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
    setMemoDialog({ check, newStatus });
    setMemoText(check.note || '');
  };

  const confirmStatusChange = (skipMemo: boolean) => {
    if (!memoDialog) return;
    updateCheck.mutate({
      id: memoDialog.check.id,
      status: memoDialog.newStatus,
      note: skipMemo ? memoDialog.check.note : memoText || null,
      userId: user?.id,
      campaignId: selectedCampaignId,
    });
    setMemoDialog(null);
    setMemoText('');
  };

  const handleBulkChange = () => {
    if (!bulkDialog) return;
    let targetChecks: CampaignWorkflowCheck[];
    if (bulkDialog.scope === 'section' && bulkDialog.section) {
      const taskIds = new Set(workflowTasks.filter((t) => t.section === bulkDialog.section).map((t) => t.id));
      targetChecks = filteredChecks.filter((c) => taskIds.has(c.workflow_task_id));
    } else {
      targetChecks = filteredChecks;
    }
    bulkUpdate.mutate({
      ids: targetChecks.map((c) => c.id),
      status: bulkStatus,
      excludeNA: bulkExcludeNA,
      userId: user?.id,
      campaignId: selectedCampaignId,
    });
    setBulkDialog(null);
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

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
              {campaigns.filter((c) => c.status === 'active').map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.client_name} {c.campaign_name}</SelectItem>
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

      {/* Stats */}
      {selectedCampaignId && filteredChecks.length > 0 && (
        <motion.div variants={fadeUpItem} className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-xl bg-white border border-stone-100 p-3 text-center">
            <div className="text-2xl font-bold text-stone-900">{stats.rate}%</div>
            <div className="text-xs text-stone-500">완료율</div>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-emerald-600">완료</div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.inProgress}</div>
            <div className="text-xs text-amber-600">진행중</div>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
            <div className="text-2xl font-bold text-stone-500">{stats.pending}</div>
            <div className="text-xs text-stone-500">진행전</div>
          </div>
          <div className="rounded-xl bg-white border border-stone-100 p-3 text-center">
            <div className="text-2xl font-bold text-stone-400">{filteredChecks.filter((c) => c.status === '해당없음').length}</div>
            <div className="text-xs text-stone-400">해당없음</div>
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
      {selectedCampaignId && linkedProducts.length === 0 && (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg font-medium">연결된 협업상품이 없습니다</p>
          <p className="text-sm mt-1">캠페인 관리에서 협업상품을 연결해주세요.</p>
        </div>
      )}

      {/* Checklist by section */}
      {selectedCampaignId && productsToShow.length > 0 && sections.map(({ section, tasks }) => {
        const isCollapsed = collapsedSections.has(section);
        const sectionChecks = filteredChecks.filter((c) => {
          const task = workflowTasks.find((t) => t.id === c.workflow_task_id);
          return task?.section === section;
        });
        const sectionTotal = sectionChecks.filter((c) => c.status !== '해당없음').length;
        const sectionDone = sectionChecks.filter((c) => c.status === '완료').length;
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
                <span className="text-xs font-medium">{sectionDone}/{sectionTotal} ({sectionRate}%)</span>
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

            {/* Tasks */}
            {!isCollapsed && (
              <div className="divide-y divide-stone-100 bg-white">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 px-4 py-2 hover:bg-stone-50/50 transition-colors">
                    <span className="text-xs text-stone-400 w-6 text-right shrink-0">{task.task_number}.</span>
                    <span className={cn('flex-1 text-sm', 'text-stone-700')}>{task.task_name}</span>

                    {/* Per-product status */}
                    <div className="flex items-center gap-1.5">
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
                                  <SelectTrigger className={cn('h-7 w-[100px] text-xs border-0', cfg.className)}>
                                    <div className="flex items-center gap-1">
                                      <Icon className="size-3" />
                                      <span>{cfg.label}</span>
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_STATUSES.map((s) => {
                                      const sc = STATUS_CONFIG[s];
                                      const SIcon = sc.icon;
                                      return (
                                        <SelectItem key={s} value={s}>
                                          <div className="flex items-center gap-1.5">
                                            <SIcon className={cn('size-3', sc.className.split(' ')[1])} />
                                            <span>{sc.label}</span>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                {check.note && <MessageSquare className="size-3 text-stone-400" />}
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
                ))}
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
                <Badge className={STATUS_CONFIG[memoDialog.check.status].className}>{memoDialog.check.status}</Badge>
                <span className="text-stone-400">→</span>
                <Badge className={STATUS_CONFIG[memoDialog.newStatus].className}>{memoDialog.newStatus}</Badge>
              </div>
              <div>
                <Label className="text-xs text-stone-500">메모 (선택)</Label>
                <Input
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  className="mt-1"
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
        <DialogContent className="sm:max-w-[400px]">
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
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-stone-500">&quot;해당없음&quot; 항목 제외</Label>
              <Switch checked={bulkExcludeNA} onCheckedChange={setBulkExcludeNA} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBulkDialog(null)}>취소</Button>
            <Button size="sm" onClick={handleBulkChange}>일괄 변경</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
