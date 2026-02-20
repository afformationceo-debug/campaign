'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, BookOpen, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
} from '@/components/ui/dialog';
import type {
  Campaign,
  EcommercePlatform,
  CampaignPlatform,
  CampaignPlatformWithRelations,
  SetupStatus,
  User as UserType,
} from '@/lib/types/database';

const STATUS_CONFIG: Record<SetupStatus, { label: string; className: string }> = {
  '미시작': { label: '미시작', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30' },
  '진행중': { label: '진행중', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
  '완료': { label: '완료', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' },
};

export function BrandCampaignSetup({ campaign }: { campaign: Campaign }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ platform_id: '', country: '', note: '' });

  // Fetch campaign platforms
  const { data: campaignPlatforms = [] } = useQuery({
    queryKey: queryKeys.campaignPlatforms.byCampaign(campaign.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_platforms')
        .select('*, ecommerce_platforms(*), users(*)')
        .eq('campaign_id', campaign.id)
        .order('created_at');
      if (error) throw error;
      return data as CampaignPlatformWithRelations[];
    },
  });

  // Fetch all platforms for the add dialog
  const { data: platforms = [] } = useQuery({
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

  // Fetch users for assignment
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as UserType[];
    },
  });

  // Add platform
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campaign_platforms').insert({
        campaign_id: campaign.id,
        platform_id: addForm.platform_id,
        country: addForm.country,
        note: addForm.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignPlatforms.byCampaign(campaign.id) });
      setIsAddOpen(false);
      setAddForm({ platform_id: '', country: '', note: '' });
    },
  });

  // Update status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SetupStatus }) => {
      const { error } = await supabase
        .from('campaign_platforms')
        .update({ setup_status: status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignPlatforms.byCampaign(campaign.id) });
    },
  });

  // Update field
  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CampaignPlatform> }) => {
      const { error } = await supabase
        .from('campaign_platforms')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignPlatforms.byCampaign(campaign.id) });
    },
  });

  // Get available countries for selected platform
  const selectedPlatform = platforms.find((p) => p.id === addForm.platform_id);
  const availableCountries = selectedPlatform?.available_countries ?? [];

  const completedCount = campaignPlatforms.filter((cp) => cp.setup_status === '완료').length;
  const totalCount = campaignPlatforms.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">플랫폼 세팅 현황</h3>
          {totalCount > 0 && (
            <Badge variant="secondary" className={cn(
              'text-[9px]',
              completedCount === totalCount ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            )}>
              {completedCount}/{totalCount} 완료
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)}>
          <Plus className="size-3.5 mr-1" /> 플랫폼 추가
        </Button>
      </div>

      {campaignPlatforms.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg">
          아직 등록된 플랫폼이 없습니다. 플랫폼을 추가해주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {campaignPlatforms.map((cp) => (
            <div key={cp.id} className="rounded-xl border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cp.ecommerce_platforms?.logo_emoji}</span>
                  <div>
                    <p className="text-xs font-semibold">{cp.ecommerce_platforms?.platform_name}</p>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{cp.country}</Badge>
                  </div>
                </div>
                <Select
                  value={cp.setup_status}
                  onValueChange={(v) => updateStatusMutation.mutate({ id: cp.id, status: v as SetupStatus })}
                >
                  <SelectTrigger className="h-7 w-[90px] text-[10px] border-0 bg-transparent px-1">
                    <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0', STATUS_CONFIG[cp.setup_status as SetupStatus]?.className)}>
                      {cp.setup_status}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_CONFIG) as SetupStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <Badge variant="secondary" className={cn('text-[9px]', STATUS_CONFIG[s].className)}>{s}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Shop URL */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <ExternalLink className="size-3 text-muted-foreground shrink-0" />
                {cp.shop_url ? (
                  <a href={cp.shop_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    {cp.shop_url}
                  </a>
                ) : (
                  <Input
                    placeholder="샵 URL 입력..."
                    className="h-6 text-[10px]"
                    onBlur={(e) => {
                      if (e.target.value) updateFieldMutation.mutate({ id: cp.id, updates: { shop_url: e.target.value } });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        const val = e.currentTarget.value;
                        if (val) updateFieldMutation.mutate({ id: cp.id, updates: { shop_url: val } });
                      }
                    }}
                  />
                )}
              </div>

              {/* Assignee */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <User className="size-3 text-muted-foreground shrink-0" />
                <Select
                  value={cp.assigned_user_id ?? ''}
                  onValueChange={(v) => updateFieldMutation.mutate({ id: cp.id, updates: { assigned_user_id: v || null } })}
                >
                  <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent px-1 flex-1">
                    <SelectValue placeholder="담당자 배정" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">미배정</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Manual link */}
              <a
                href="/manuals"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <BookOpen className="size-3" />
                매뉴얼 보기
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Add Platform Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>플랫폼 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>플랫폼</Label>
              <Select value={addForm.platform_id} onValueChange={(v) => setAddForm((p) => ({ ...p, platform_id: v, country: '' }))}>
                <SelectTrigger><SelectValue placeholder="플랫폼 선택" /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.logo_emoji} {p.platform_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addForm.platform_id && (
              <div className="space-y-2">
                <Label>국가</Label>
                <Select value={addForm.country} onValueChange={(v) => setAddForm((p) => ({ ...p, country: v }))}>
                  <SelectTrigger><SelectValue placeholder="국가 선택" /></SelectTrigger>
                  <SelectContent>
                    {availableCountries.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea
                value={addForm.note}
                onChange={(e) => setAddForm((p) => ({ ...p, note: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>취소</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!addForm.platform_id || !addForm.country || addMutation.isPending}
            >
              {addMutation.isPending ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
