'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { queryKeys } from '@/lib/utils/query-keys';
import { useRealtimeConfigs } from '@/hooks/use-realtime-configs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Campaign, CampaignConfig } from '@/lib/types/database';

// 19 standard config keys
const STANDARD_KEYS_COUNT = 19;

interface ConfigDashboardProps {
  onSelectCampaign: (campaignId: string) => void;
}

export function ConfigDashboard({ onSelectCampaign }: ConfigDashboardProps) {
  const supabase = createClient();
  useRealtimeConfigs();

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
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

  const { data: allConfigs = [], isLoading: configsLoading } = useQuery({
    queryKey: queryKeys.configs.all,
    queryFn: () => fetchAll<CampaignConfig>(supabase, 'campaign_configs'),
  });

  // Per-campaign stats
  const campaignStats = useMemo(() => {
    const map = new Map<string, { completed: number; total: number }>();
    for (const config of allConfigs) {
      const entry = map.get(config.campaign_id) || { completed: 0, total: 0 };
      entry.total += 1;
      if (config.status === '완료') entry.completed += 1;
      map.set(config.campaign_id, entry);
    }
    return map;
  }, [allConfigs]);

  // Summary stats
  const summary = useMemo(() => {
    let totalCampaigns = campaigns.length;
    let completedCampaigns = 0;
    let totalPct = 0;
    let setupCampaigns = 0;

    campaigns.forEach((c) => {
      const stats = campaignStats.get(c.id);
      if (!stats || stats.total === 0) return;
      setupCampaigns++;
      const pct = (stats.completed / stats.total) * 100;
      totalPct += pct;
      if (pct === 100) completedCampaigns++;
    });

    return {
      totalCampaigns,
      completedCampaigns,
      avgCompletion: setupCampaigns > 0 ? Math.round(totalPct / setupCampaigns * 10) / 10 : 0,
      notStarted: totalCampaigns - setupCampaigns,
    };
  }, [campaigns, campaignStats]);

  // Sorted campaigns: in-progress first, then not-started, then completed
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const sa = campaignStats.get(a.id);
      const sb = campaignStats.get(b.id);
      const pctA = sa && sa.total > 0 ? sa.completed / sa.total : -1;
      const pctB = sb && sb.total > 0 ? sb.completed / sb.total : -1;
      // In-progress (0 < pct < 1) first, then not-started (-1), then completed (1)
      const orderA = pctA === -1 ? 2 : pctA === 1 ? 3 : 1;
      const orderB = pctB === -1 ? 2 : pctB === 1 ? 3 : 1;
      if (orderA !== orderB) return orderA - orderB;
      return (pctB ?? 0) - (pctA ?? 0);
    });
  }, [campaigns, campaignStats]);

  const isLoading = campaignsLoading || configsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
          <span className="text-sm">데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="text-[10px] text-muted-foreground font-medium">전체 캠페인</div>
          <div className="text-2xl font-bold mt-1">{summary.totalCampaigns}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="text-[10px] text-muted-foreground font-medium">세팅 완료</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{summary.completedCampaigns}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="text-[10px] text-muted-foreground font-medium">평균 완료율</div>
          <div className="text-2xl font-bold mt-1">{summary.avgCompletion}%</div>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="text-[10px] text-muted-foreground font-medium">미시작</div>
          <div className="text-2xl font-bold mt-1 text-red-500">{summary.notStarted}</div>
        </div>
      </div>

      {/* Per-Campaign Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
          <BarChart3 className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">캠페인별 세팅 완료율</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
            {campaigns.length}개
          </Badge>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b bg-muted/10">
              <th className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">캠페인</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground w-[80px]">고객명</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground w-[80px]">국가</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground w-[200px]">진행률</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground w-[80px] text-center">상태</th>
            </tr>
          </thead>
          <tbody>
            {sortedCampaigns.map((campaign) => {
              const stats = campaignStats.get(campaign.id);
              const total = stats?.total ?? 0;
              const completed = stats?.completed ?? 0;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const statusLabel = total === 0 ? '미설정' : pct === 100 ? '완료' : pct > 0 ? '진행중' : '미시작';

              return (
                <tr
                  key={campaign.id}
                  className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => onSelectCampaign(campaign.id)}
                >
                  <td className="px-3 py-1.5 text-[11px] font-medium">{campaign.campaign_name}</td>
                  <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{campaign.client_name}</td>
                  <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{campaign.target_country ?? '-'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-[50px] text-right shrink-0">
                        {completed}/{total} ({pct}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[9px] px-1.5 py-0 gap-0.5',
                        statusLabel === '완료' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                        statusLabel === '진행중' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                        statusLabel === '미시작' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
                        statusLabel === '미설정' && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                      )}
                    >
                      {statusLabel === '완료' && <CheckCircle2 className="size-2.5" />}
                      {statusLabel === '진행중' && <AlertCircle className="size-2.5" />}
                      {statusLabel === '미시작' && <MinusCircle className="size-2.5" />}
                      {statusLabel}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
