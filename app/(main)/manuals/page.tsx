'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Search, Bot } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlatformCard } from '@/components/manuals/platform-card';
import { ManualViewer } from '@/components/manuals/manual-viewer';
import type { EcommercePlatform, PlatformManual, ManualType } from '@/lib/types/database';

const MANUAL_TYPES: ManualType[] = ['세팅가이드', '운영가이드', 'FAQ', '트러블슈팅'];

export default function ManualsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();

  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [activeManualType, setActiveManualType] = useState<string>('all');
  const [selectedManual, setSelectedManual] = useState<PlatformManual | null>(null);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newManual, setNewManual] = useState({
    title: '',
    content: '',
    manual_type: '세팅가이드' as ManualType,
    country: '',
  });

  // Fetch platforms
  const { data: platforms = [], isLoading: loadingPlatforms } = useQuery({
    queryKey: queryKeys.platforms.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_platforms')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as EcommercePlatform[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch manuals for selected platform
  const { data: manuals = [], isLoading: loadingManuals } = useQuery({
    queryKey: queryKeys.manuals.byPlatform(selectedPlatformId ?? ''),
    queryFn: async () => {
      if (!selectedPlatformId) return [];
      const { data, error } = await supabase
        .from('platform_manuals')
        .select('*')
        .eq('platform_id', selectedPlatformId)
        .eq('is_published', true)
        .order('sort_order');
      if (error) throw error;
      return data as PlatformManual[];
    },
    enabled: !!selectedPlatformId,
  });

  // Fetch manual counts per platform
  const { data: manualCounts = {} } = useQuery({
    queryKey: [...queryKeys.manuals.all, 'counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_manuals')
        .select('platform_id')
        .eq('is_published', true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.platform_id] = (counts[row.platform_id] || 0) + 1;
      }
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Create manual
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlatformId) return;
      const { error } = await supabase.from('platform_manuals').insert({
        platform_id: selectedPlatformId,
        title: newManual.title,
        content: newManual.content,
        manual_type: newManual.manual_type,
        country: newManual.country || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.manuals.byPlatform(selectedPlatformId ?? '') });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.manuals.all, 'counts'] });
      setIsCreateOpen(false);
      setNewManual({ title: '', content: '', manual_type: '세팅가이드', country: '' });
    },
  });

  // Delete manual
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_manuals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.manuals.byPlatform(selectedPlatformId ?? '') });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.manuals.all, 'counts'] });
      setSelectedManual(null);
    },
  });

  // Auto-expand first manual when manuals load for a new platform
  useEffect(() => {
    if (manuals.length > 0 && selectedPlatformId) {
      setSelectedManual(manuals[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuals.length, selectedPlatformId]);

  const selectedPlatform = platforms.find((p) => p.id === selectedPlatformId);
  const filteredManuals = manuals.filter((m) => {
    if (activeManualType !== 'all' && m.manual_type !== activeManualType) return false;
    if (search) {
      const lower = search.toLowerCase();
      return m.title.toLowerCase().includes(lower) || m.content.toLowerCase().includes(lower);
    }
    return true;
  });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Header */}
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">이커머스 매뉴얼/가이드</h1>
          <p className="text-muted-foreground text-sm mt-1">
            해외 이커머스 플랫폼별 입점 가이드 및 운영 매뉴얼을 관리합니다.
          </p>
        </div>
      </motion.div>

      {/* AI Agent Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-transparent dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-transparent px-4 py-3.5 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-100/30 to-transparent dark:from-emerald-900/15 rounded-bl-full" />
          <div className="flex gap-3 items-start relative">
            <div className="relative shrink-0 mt-0.5">
              <div className="size-9 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center shadow-md ring-2 ring-white/80 dark:ring-white/10">
                <Bot className="size-4 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-emerald-900 dark:text-emerald-200">이커머스 플랫폼 가이드</p>
                <span className="text-[9px] font-medium text-emerald-500/60 dark:text-emerald-400/50 bg-emerald-100/60 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">지식베이스</span>
              </div>
              <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/70 leading-[1.7]">
                <p>플랫폼 카드를 클릭하면 해당 플랫폼의 <strong className="text-emerald-700 dark:text-emerald-300">입점 절차, 수수료, 물류 정보</strong> 등 상세 매뉴얼을 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Platform Cards Grid - compact when a platform is selected */}
      <motion.div variants={fadeUpItem}>
        {loadingPlatforms ? (
          <div className="flex items-center justify-center h-32">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
          </div>
        ) : selectedPlatform ? (
          /* Compact horizontal strip when a platform is selected */
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => {
                  setSelectedPlatformId(platform.id === selectedPlatformId ? null : platform.id);
                  setSelectedManual(null);
                }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap text-sm transition-all shrink-0',
                  platform.id === selectedPlatformId
                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm'
                    : 'hover:border-primary/30 bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{platform.logo_emoji}</span>
                <span>{platform.platform_name}</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{manualCounts[platform.id] || 0}</Badge>
              </button>
            ))}
          </div>
        ) : (
          /* Full grid when no platform is selected */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {platforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                manualCount={manualCounts[platform.id] || 0}
                isSelected={selectedPlatformId === platform.id}
                onClick={() => {
                  setSelectedPlatformId(platform.id);
                  setSelectedManual(null);
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Manual Section */}
      {selectedPlatform && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedPlatform.logo_emoji}</span>
              <h2 className="text-lg font-semibold">{selectedPlatform.platform_name} 매뉴얼</h2>
              <Badge variant="secondary" className="text-[10px]">{manuals.length}개</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="매뉴얼 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-[200px]"
                />
              </div>
              {isAdmin && (
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="size-3.5 mr-1" /> 매뉴얼 추가
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeManualType} onValueChange={(v) => { setActiveManualType(v); setSelectedManual(null); }}>
            <TabsList>
              <TabsTrigger value="all">전체</TabsTrigger>
              {MANUAL_TYPES.map((type) => (
                <TabsTrigger key={type} value={type}>{type}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Manual list - rendered outside Tabs to avoid TabsContent issues */}
          <div className="mt-3">
            {loadingManuals ? (
              <div className="flex items-center justify-center h-32">
                <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
              </div>
            ) : filteredManuals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border rounded-lg gap-2">
                <BookOpen className="size-8 text-muted-foreground/50" />
                <p className="text-sm">등록된 매뉴얼이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredManuals.map((manual) => (
                  <ManualViewer
                    key={manual.id}
                    manual={manual}
                    isExpanded={selectedManual?.id === manual.id}
                    onToggle={() => setSelectedManual(selectedManual?.id === manual.id ? null : manual)}
                    onDelete={isAdmin ? () => deleteMutation.mutate(manual.id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Create Manual Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 매뉴얼 추가</DialogTitle>
            <DialogDescription>
              {selectedPlatform?.platform_name}에 대한 새 매뉴얼을 작성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input
                value={newManual.title}
                onChange={(e) => setNewManual((p) => ({ ...p, title: e.target.value }))}
                placeholder="매뉴얼 제목"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>유형</Label>
                <Select
                  value={newManual.manual_type}
                  onValueChange={(v) => setNewManual((p) => ({ ...p, manual_type: v as ManualType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MANUAL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>대상 국가 (선택)</Label>
                <Input
                  value={newManual.country}
                  onChange={(e) => setNewManual((p) => ({ ...p, country: e.target.value }))}
                  placeholder="예: 일본"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>내용 (마크다운 지원)</Label>
              <Textarea
                value={newManual.content}
                onChange={(e) => setNewManual((p) => ({ ...p, content: e.target.value }))}
                placeholder="매뉴얼 내용을 작성하세요..."
                rows={12}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newManual.title.trim() || !newManual.content.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? '저장 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
