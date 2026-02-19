'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeConfigs } from '@/hooks/use-realtime-configs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { parseCredentials } from '@/components/manage/credential-editor';
import type { Campaign, CampaignConfig } from '@/lib/types/database';

// Config keys grouped by type, matching DEFAULT_TEMPLATE_CONFIGS
const CONFIG_GROUPS: { type: string; keys: string[] }[] = [
  {
    type: '세팅 관련',
    keys: [
      '인스타그램 URL', '페이스북 URL', '트위터 URL', '틱톡 URL',
      '플랫폼별 ID/PW', '고객전용 라인', '고객전용 왓츠앱 링크',
      '홈페이지 링크', '구글맵 세팅여부', '리틀리 세팅여부', '리틀리 링크',
    ],
  },
  {
    type: '인플루언서 관련',
    keys: [
      '인플루언서 전용 라인 세팅', '인플루언서 전용 왓츠앱 세팅',
      '스카웃매니저 메신저 연동', '스카웃매니저 캠페인 등록',
    ],
  },
  {
    type: '지식베이스',
    keys: ['고객전용 지식베이스 세팅여부', '인플전용 지식베이스 세팅여부'],
  },
  {
    type: 'CS어드민',
    keys: ['메신저 채널 연동 여부'],
  },
  {
    type: 'CRM',
    keys: ['CRM 등록여부'],
  },
];

const ALL_CONFIG_KEYS = CONFIG_GROUPS.flatMap((g) => g.keys);

export function ConfigMatrix() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Realtime: sync config changes across all open tabs/PCs
  useRealtimeConfigs();

  // Fetch all campaigns
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

  // Fetch ALL campaign_configs across all campaigns
  const { data: allConfigs = [], isLoading: configsLoading } = useQuery({
    queryKey: queryKeys.configs.all,
    queryFn: () => fetchAll<CampaignConfig>(supabase, 'campaign_configs'),
  });

  // Build lookup: campaign_id + config_key → config
  const configMap = useMemo(() => {
    const map = new Map<string, CampaignConfig>();
    allConfigs.forEach((config) => {
      map.set(`${config.campaign_id}:${config.config_key}`, config);
    });
    return map;
  }, [allConfigs]);

  // Calculate completion per campaign
  const campaignCompletion = useMemo(() => {
    const map = new Map<string, { completed: number; total: number }>();
    campaigns.forEach((campaign) => {
      let completed = 0;
      let total = 0;
      ALL_CONFIG_KEYS.forEach((key) => {
        const config = configMap.get(`${campaign.id}:${key}`);
        if (config) {
          total++;
          if (config.status === '완료') completed++;
        }
      });
      map.set(campaign.id, { completed, total });
    });
    return map;
  }, [campaigns, configMap]);

  // Toggle status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('campaign_configs')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      logActivity({
        userId: profile?.id,
        actionType: 'update',
        targetTable: 'campaign_configs',
        targetId: id,
        newValue: { status },
      });
    },
    onMutate: async ({ id, status }) => {
      const key = queryKeys.configs.all;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CampaignConfig[]>(key);
      queryClient.setQueryData(key, (old: CampaignConfig[] | undefined) =>
        (old || []).map((c) => (c.id === id ? { ...c, status } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.configs.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all });
      // Also invalidate individual campaign configs
      queryClient.invalidateQueries({ queryKey: ['configs'] });
    },
  });

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

  if (campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        캠페인이 없습니다.
      </div>
    );
  }

  return (
    <div className="relative overflow-auto rounded-lg border bg-background">
      <table className="w-max min-w-full border-collapse">
        <thead>
          <tr>
            {/* Top-left corner */}
            <th
              className={cn(
                'sticky left-0 top-0 z-30 min-w-[200px] max-w-[260px]',
                'bg-background border-b border-r px-3 py-2',
                'text-left text-xs font-semibold text-muted-foreground'
              )}
            >
              캠페인
            </th>

            {/* Config key headers grouped by type */}
            {CONFIG_GROUPS.map((group) =>
              group.keys.map((key, keyIdx) => (
                <th
                  key={key}
                  className={cn(
                    'sticky top-0 z-20',
                    'bg-background border-b px-0.5 py-1',
                    'text-center min-w-[36px] max-w-[44px]',
                    keyIdx === 0 && 'border-l border-l-gray-300'
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        'text-[9px] font-medium text-muted-foreground',
                        'whitespace-nowrap',
                        'max-h-[60px] overflow-hidden'
                      )}
                      style={{ writingMode: 'vertical-lr' }}
                      title={`[${group.type}] ${key}`}
                    >
                      {key}
                    </span>
                  </div>
                </th>
              ))
            )}

            {/* Completion column */}
            <th
              className={cn(
                'sticky top-0 right-0 z-20',
                'bg-background border-b border-l px-2 py-2',
                'text-center text-[10px] font-semibold text-muted-foreground',
                'min-w-[70px]'
              )}
            >
              완료율
            </th>
          </tr>
        </thead>

        <tbody>
          {campaigns.map((campaign) => {
            const completion = campaignCompletion.get(campaign.id);
            const pct =
              completion && completion.total > 0
                ? Math.round((completion.completed / completion.total) * 100)
                : 0;

            return (
              <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                {/* Campaign name (sticky left) */}
                <td
                  className={cn(
                    'sticky left-0 z-10',
                    'bg-background border-b border-r px-3 py-1.5',
                    'text-xs font-medium text-foreground',
                    'min-w-[200px] max-w-[260px]'
                  )}
                >
                  <div className="truncate" title={`${campaign.client_name} - ${campaign.campaign_name}`}>
                    <span className="font-semibold">{campaign.client_name}</span>
                    <span className="text-muted-foreground ml-1">
                      {campaign.campaign_name}
                    </span>
                  </div>
                </td>

                {/* Config status cells */}
                {CONFIG_GROUPS.map((group) =>
                  group.keys.map((key, keyIdx) => {
                    const config = configMap.get(`${campaign.id}:${key}`);

                    return (
                      <td
                        key={key}
                        className={cn(
                          'border-b px-0.5 py-1 text-center',
                          keyIdx === 0 && 'border-l border-l-gray-300'
                        )}
                      >
                        <div className="flex items-center justify-center">
                          {config ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleMutation.mutate({
                                      id: config.id,
                                      status: config.status === '완료' ? '미완료' : '완료',
                                    })
                                  }
                                  className={cn(
                                    'flex items-center justify-center w-7 h-7 rounded-md',
                                    'transition-all duration-150 cursor-pointer',
                                    config.status === '완료'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                      : config.config_value
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                                        : 'bg-red-100 text-red-500 dark:bg-red-900/30'
                                  )}
                                >
                                  {config.status === '완료' ? (
                                    <Check className="size-3.5" />
                                  ) : (
                                    <X className="size-3.5" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={4}>
                                <p className="font-medium">{key}</p>
                                {config.value_type === 'credentials' ? (
                                  <div className="text-[10px] opacity-80 mt-0.5">
                                    {config.config_value ? (
                                      parseCredentials(config.config_value).map((c, i) => (
                                        <p key={i}>{c.platform}: {c.username} / ••••</p>
                                      ))
                                    ) : (
                                      <p>(비어있음)</p>
                                    )}
                                  </div>
                                ) : config.value_type === 'url' && config.config_value ? (
                                  <p className="text-[10px] opacity-80 text-blue-300 break-all max-w-[250px]">
                                    {config.config_value}
                                  </p>
                                ) : (
                                  <p className="text-[10px] opacity-80">
                                    {config.config_value || '(비어있음)'}
                                  </p>
                                )}
                                <p className="text-[10px] mt-1">
                                  상태: {config.status}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <div
                              className={cn(
                                'flex items-center justify-center w-7 h-7 rounded-md',
                                'bg-gray-100 dark:bg-gray-800/40 cursor-not-allowed'
                              )}
                              title="설정 없음"
                            >
                              <span className="text-gray-300 dark:text-gray-600 text-[10px]">-</span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })
                )}

                {/* Completion rate */}
                <td
                  className={cn(
                    'sticky right-0 z-10',
                    'bg-background border-b border-l px-2 py-1.5',
                    'text-center'
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {completion?.completed ?? 0}/{completion?.total ?? 0}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[9px] px-1.5 py-0',
                        pct === 100 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                        pct > 0 && pct < 100 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                        pct === 0 && 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {pct}%
                    </Badge>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
