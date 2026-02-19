'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Settings,
  Link2,
  FileText,
  Globe,
  BarChart3,
  Filter,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeConfigs } from '@/hooks/use-realtime-configs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Campaign, CampaignConfig, ConfigValueType } from '@/lib/types/database';

// Value type mapping for each config key
const VALUE_TYPE_MAP: Record<string, ConfigValueType> = {
  '인스타그램 URL': 'url',
  '페이스북 URL': 'url',
  '트위터 URL': 'url',
  '틱톡 URL': 'url',
  '플랫폼별 ID/PW': 'credentials',
  '고객전용 라인': 'url',
  '고객전용 왓츠앱 링크': 'url',
  '홈페이지 링크': 'url',
  '구글맵 세팅여부': 'status',
  '리틀리 세팅여부': 'status',
  '리틀리 링크': 'url',
  '인플루언서 전용 라인 세팅': 'url',
  '인플루언서 전용 왓츠앱 세팅': 'url',
  '스카웃매니저 라인 메신저 연동': 'status',
  '스카웃매니저 왓츠앱 메신저 연동': 'status',
  '스카웃매니저 캠페인 등록': 'status',
  '고객전용 지식베이스 세팅여부': 'status',
  '인플전용 지식베이스 세팅여부': 'status',
  '메신저 채널 연동 여부': 'status',
  'CRM 연동설정 여부': 'status',
  'CRM 등록여부': 'status',
};

const STATUS_VALUE_OPTIONS = ['세팅완료', '완료', '진행중', '미완료', '진행필요', '불필요', '해당없음'];

const CONFIG_GROUPS: { type: string; icon: React.ElementType; keys: string[] }[] = [
  {
    type: '세팅 관련',
    icon: Settings,
    keys: [
      '인스타그램 URL', '페이스북 URL', '트위터 URL', '틱톡 URL',
      '플랫폼별 ID/PW', '고객전용 라인', '고객전용 왓츠앱 링크',
      '홈페이지 링크', '구글맵 세팅여부', '리틀리 세팅여부', '리틀리 링크',
    ],
  },
  {
    type: '인플루언서 관련',
    icon: Link2,
    keys: [
      '인플루언서 전용 라인 세팅', '인플루언서 전용 왓츠앱 세팅',
      '스카웃매니저 라인 메신저 연동', '스카웃매니저 왓츠앱 메신저 연동', '스카웃매니저 캠페인 등록',
    ],
  },
  {
    type: '지식베이스',
    icon: FileText,
    keys: ['고객전용 지식베이스 세팅여부', '인플전용 지식베이스 세팅여부'],
  },
  {
    type: 'CS어드민',
    icon: Globe,
    keys: ['메신저 채널 연동 여부', 'CRM 연동설정 여부'],
  },
  {
    type: 'CRM',
    icon: BarChart3,
    keys: ['CRM 등록여부'],
  },
];

// Find config_type for a given config_key
function getConfigType(key: string): string {
  for (const group of CONFIG_GROUPS) {
    if (group.keys.includes(key)) return group.type;
  }
  return '기타';
}

interface KeyStats {
  key: string;
  configType: string;
  completed: { campaign: Campaign; config: CampaignConfig }[];
  incomplete: { campaign: Campaign; config: CampaignConfig | null }[];
  total: number;
  pct: number;
}

// Inline editor for a single campaign config value
function InlineConfigEditor({
  campaign,
  configKey,
  config,
  valueType,
  onSave,
  isSaving,
}: {
  campaign: Campaign;
  configKey: string;
  config: CampaignConfig | null;
  valueType: ConfigValueType;
  onSave: (value: string) => void;
  isSaving: boolean;
}) {
  const [localValue, setLocalValue] = useState(config?.config_value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input on mount
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSave = () => {
    onSave(localValue);
  };

  if (valueType === 'status') {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">
          {campaign.client_name} - {campaign.campaign_name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          항목: <span className="font-medium text-foreground">{configKey}</span>
        </p>
        <Select
          value={localValue || '__empty__'}
          onValueChange={(v) => {
            const val = v === '__empty__' ? '' : v;
            setLocalValue(val);
            onSave(val);
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="상태를 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">
              <span className="text-muted-foreground">(선택안함)</span>
            </SelectItem>
            {STATUS_VALUE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                <span className={cn(
                  (opt === '세팅완료' || opt === '완료') && 'text-emerald-700',
                  opt === '미완료' && 'text-red-600',
                  (opt === '진행필요' || opt === '진행중') && 'text-amber-600',
                  (opt === '불필요' || opt === '해당없음') && 'text-gray-500',
                )}>
                  {opt}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">
        {campaign.client_name} - {campaign.campaign_name}
      </p>
      <p className="text-[10px] text-muted-foreground">
        항목: <span className="font-medium text-foreground">{configKey}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={valueType === 'url' ? 'https://...' : '값을 입력하세요'}
          className="h-8 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />
        <Button
          size="sm"
          className="h-8 px-2.5"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save className="size-3.5 mr-1" />
          {isSaving ? '저장...' : '저장'}
        </Button>
      </div>
      {config?.config_value && (
        <p className="text-[10px] text-muted-foreground">
          현재값: <span className="font-mono">{config.config_value}</span>
        </p>
      )}
    </div>
  );
}

export function ConfigKeyView() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  useRealtimeConfigs();

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<{ campaignId: string; configKey: string } | null>(null);

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

  const configMap = useMemo(() => {
    const map = new Map<string, CampaignConfig>();
    allConfigs.forEach((config) => {
      map.set(`${config.campaign_id}:${config.config_key}`, config);
    });
    return map;
  }, [allConfigs]);

  // Build stats for each config key
  const keyStats = useMemo(() => {
    const stats: KeyStats[] = [];
    const activeGroups = filterType === 'all'
      ? CONFIG_GROUPS
      : CONFIG_GROUPS.filter((g) => g.type === filterType);

    for (const group of activeGroups) {
      for (const key of group.keys) {
        const completed: KeyStats['completed'] = [];
        const incomplete: KeyStats['incomplete'] = [];

        for (const campaign of campaigns) {
          const config = configMap.get(`${campaign.id}:${key}`);
          if (config && config.status === '완료') {
            completed.push({ campaign, config });
          } else {
            incomplete.push({ campaign, config: config ?? null });
          }
        }

        const total = campaigns.length;
        const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

        stats.push({
          key,
          configType: group.type,
          completed,
          incomplete,
          total,
          pct,
        });
      }
    }

    return stats;
  }, [campaigns, configMap, filterType]);

  // Upsert mutation: creates or updates a config + sets value + marks 완료
  const upsertMutation = useMutation({
    mutationFn: async ({
      campaignId,
      configKey,
      configValue,
      existingId,
    }: {
      campaignId: string;
      configKey: string;
      configValue: string;
      existingId: string | null;
    }) => {
      const configType = getConfigType(configKey);
      const valueType = VALUE_TYPE_MAP[configKey] ?? 'text';

      if (existingId) {
        // Update existing
        const { error } = await supabase
          .from('campaign_configs')
          .update({
            config_value: configValue,
            status: '완료',
          })
          .eq('id', existingId);
        if (error) throw error;
        logActivity({
          userId: profile?.id,
          actionType: 'update',
          targetTable: 'campaign_configs',
          targetId: existingId,
          newValue: { config_value: configValue, status: '완료' },
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from('campaign_configs')
          .insert({
            campaign_id: campaignId,
            config_type: configType,
            config_key: configKey,
            config_value: configValue,
            value_type: valueType,
            status: '완료',
          });
        if (error) throw error;
        logActivity({
          userId: profile?.id,
          actionType: 'create',
          targetTable: 'campaign_configs',
          targetId: campaignId,
          newValue: { config_key: configKey, config_value: configValue, status: '완료' },
        });
      }
    },
    onSuccess: () => {
      setEditingItem(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all });
      queryClient.invalidateQueries({ queryKey: ['configs'] });
    },
  });

  // Toggle mutation (for completed → 미완료)
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
      const qk = queryKeys.configs.all;
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<CampaignConfig[]>(qk);
      queryClient.setQueryData(qk, (old: CampaignConfig[] | undefined) =>
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
      queryClient.invalidateQueries({ queryKey: ['configs'] });
    },
  });

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  // Group stats by configType (must be below early return)
  const grouped = (() => {
    const map = new Map<string, KeyStats[]>();
    for (const stat of keyStats) {
      const list = map.get(stat.configType) || [];
      list.push(stat);
      map.set(stat.configType, list);
    }
    return Array.from(map.entries());
  })();

  // Overall stats
  const overallStats = (() => {
    const allComplete = keyStats.filter((s) => s.pct === 100).length;
    const hasIssues = keyStats.filter((s) => s.incomplete.length > 0).length;
    return { total: keyStats.length, allComplete, hasIssues };
  })();

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-3">
            <p className="text-[10px] text-muted-foreground font-medium">전체 항목</p>
            <p className="text-xl font-bold tabular-nums">{overallStats.total}</p>
          </div>
          <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">전체 완료</p>
            <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{overallStats.allComplete}</p>
          </div>
          <div className={cn(
            'rounded-xl border p-3',
            overallStats.hasIssues > 0
              ? 'bg-red-50 dark:bg-red-950/20'
              : 'bg-card'
          )}>
            <p className={cn('text-[10px] font-medium', overallStats.hasIssues > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>미완료 있음</p>
            <p className={cn('text-xl font-bold tabular-nums', overallStats.hasIssues > 0 ? 'text-red-700 dark:text-red-300' : '')}>{overallStats.hasIssues}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              {CONFIG_GROUPS.map((g) => (
                <SelectItem key={g.type} value={g.type}>{g.type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-xs ml-auto">
            {campaigns.length}개 캠페인
          </Badge>
        </div>

        {/* Config Key Groups */}
        <div className="space-y-4">
          {grouped.map(([groupType, stats]) => {
            const GroupIcon = CONFIG_GROUPS.find((g) => g.type === groupType)?.icon ?? Settings;
            const groupComplete = stats.filter((s) => s.pct === 100).length;
            const groupPct = stats.length > 0 ? Math.round((groupComplete / stats.length) * 100) : 0;

            return (
              <div key={groupType} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {/* Group Header */}
                <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
                  <GroupIcon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{groupType}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <Progress value={groupPct} className="h-1.5 w-20" />
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] px-2 py-0',
                        groupPct === 100 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                        groupPct > 0 && groupPct < 100 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                      )}
                    >
                      {groupComplete}/{stats.length} 항목 완료
                    </Badge>
                  </div>
                </div>

                {/* Config Key Rows */}
                <div className="divide-y">
                  {stats.map((stat) => {
                    const isExpanded = expandedKeys.has(stat.key);
                    const hasIncomplete = stat.incomplete.length > 0;
                    const isAllComplete = stat.pct === 100;

                    return (
                      <div key={stat.key}>
                        {/* Key Row */}
                        <button
                          type="button"
                          className={cn(
                            'w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left',
                            isAllComplete && 'bg-emerald-50/50 dark:bg-emerald-950/10',
                          )}
                          onClick={() => toggleExpand(stat.key)}
                        >
                          {/* Expand indicator */}
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                          </div>

                          {/* Status icon */}
                          <div className="shrink-0">
                            {isAllComplete ? (
                              <CheckCircle2 className="size-5 text-emerald-500" />
                            ) : hasIncomplete ? (
                              <AlertTriangle className="size-5 text-amber-500" />
                            ) : (
                              <XCircle className="size-5 text-red-500" />
                            )}
                          </div>

                          {/* Key name */}
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              'text-sm font-medium',
                              isAllComplete && 'text-emerald-700 dark:text-emerald-300'
                            )}>
                              {stat.key}
                            </span>
                          </div>

                          {/* Progress */}
                          <div className="flex items-center gap-3 shrink-0">
                            <Progress value={stat.pct} className="h-2 w-24" />
                            <div className="flex items-center gap-1.5 min-w-[100px] justify-end">
                              <span className={cn(
                                'text-xs font-semibold tabular-nums',
                                isAllComplete ? 'text-emerald-600' : stat.pct > 0 ? 'text-amber-600' : 'text-red-600'
                              )}>
                                {stat.completed.length}/{stat.total}
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[9px] px-1.5 py-0 tabular-nums',
                                  isAllComplete && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                                  stat.pct > 0 && !isAllComplete && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                                  stat.pct === 0 && 'bg-red-100 text-red-600 dark:bg-red-900/30',
                                )}
                              >
                                {stat.pct}%
                              </Badge>
                            </div>
                            {hasIncomplete && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                                미완료 {stat.incomplete.length}
                              </Badge>
                            )}
                          </div>
                        </button>

                        {/* Expanded Campaign List */}
                        {isExpanded && (
                          <div className="px-4 pb-3 bg-muted/10">
                            <div className="ml-9 space-y-2 pt-2">
                              {/* Incomplete campaigns */}
                              {stat.incomplete.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <XCircle className="size-3 text-red-500" />
                                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                                      미완료 ({stat.incomplete.length})
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {stat.incomplete.map(({ campaign, config }) => {
                                      const isEditing = editingItem?.campaignId === campaign.id && editingItem?.configKey === stat.key;
                                      const valueType = VALUE_TYPE_MAP[stat.key] ?? 'text';

                                      return (
                                        <Popover
                                          key={campaign.id}
                                          open={isEditing}
                                          onOpenChange={(open) => {
                                            if (!open) setEditingItem(null);
                                          }}
                                        >
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <PopoverTrigger asChild>
                                                <button
                                                  type="button"
                                                  className={cn(
                                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                                                    'border border-red-200 dark:border-red-800',
                                                    'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
                                                    'hover:bg-red-100 dark:hover:bg-red-950/50',
                                                    isEditing && 'ring-2 ring-red-400/50',
                                                  )}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingItem({ campaignId: campaign.id, configKey: stat.key });
                                                  }}
                                                >
                                                  <XCircle className="size-3 shrink-0" />
                                                  <span className="truncate max-w-[150px]">{campaign.client_name}</span>
                                                  <Pencil className="size-2.5 ml-0.5 opacity-50" />
                                                </button>
                                              </PopoverTrigger>
                                            </TooltipTrigger>
                                            {!isEditing && (
                                              <TooltipContent>
                                                <p className="text-xs font-medium">{campaign.client_name} - {campaign.campaign_name}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                  {config ? (
                                                    <>값: {config.config_value || '(비어있음)'} | 상태: {config.status}</>
                                                  ) : (
                                                    '설정 항목이 없습니다'
                                                  )}
                                                </p>
                                                <p className="text-[10px] text-blue-400 mt-0.5">클릭하여 세팅값 입력</p>
                                              </TooltipContent>
                                            )}
                                          </Tooltip>
                                          <PopoverContent
                                            className="w-80 p-3"
                                            side="bottom"
                                            align="start"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <InlineConfigEditor
                                              campaign={campaign}
                                              configKey={stat.key}
                                              config={config}
                                              valueType={valueType}
                                              isSaving={upsertMutation.isPending}
                                              onSave={(value) => {
                                                upsertMutation.mutate({
                                                  campaignId: campaign.id,
                                                  configKey: stat.key,
                                                  configValue: value,
                                                  existingId: config?.id ?? null,
                                                });
                                              }}
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Completed campaigns */}
                              {stat.completed.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <CheckCircle2 className="size-3 text-emerald-500" />
                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      완료 ({stat.completed.length})
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {stat.completed.map(({ campaign, config }) => {
                                      const isEditing = editingItem?.campaignId === campaign.id && editingItem?.configKey === stat.key;

                                      return (
                                        <Popover
                                          key={campaign.id}
                                          open={isEditing}
                                          onOpenChange={(open) => {
                                            if (!open) setEditingItem(null);
                                          }}
                                        >
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <PopoverTrigger asChild>
                                                <button
                                                  type="button"
                                                  className={cn(
                                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                                                    'border border-emerald-200 dark:border-emerald-800',
                                                    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
                                                    'hover:bg-emerald-100 dark:hover:bg-emerald-950/50',
                                                    isEditing && 'ring-2 ring-emerald-400/50',
                                                  )}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingItem({ campaignId: campaign.id, configKey: stat.key });
                                                  }}
                                                >
                                                  <CheckCircle2 className="size-3 shrink-0" />
                                                  <span className="truncate max-w-[150px]">{campaign.client_name}</span>
                                                  {config.config_value && (
                                                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-0.5 bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40">
                                                      {config.config_value.length > 15 ? config.config_value.slice(0, 15) + '…' : config.config_value}
                                                    </Badge>
                                                  )}
                                                </button>
                                              </PopoverTrigger>
                                            </TooltipTrigger>
                                            {!isEditing && (
                                              <TooltipContent>
                                                <p className="text-xs font-medium">{campaign.client_name} - {campaign.campaign_name}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                  값: {config.config_value || '(비어있음)'} | 상태: 완료
                                                </p>
                                                <p className="text-[10px] text-blue-400 mt-0.5">클릭하여 수정</p>
                                              </TooltipContent>
                                            )}
                                          </Tooltip>
                                          <PopoverContent
                                            className="w-80 p-3"
                                            side="bottom"
                                            align="start"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <InlineConfigEditor
                                              campaign={campaign}
                                              configKey={stat.key}
                                              config={config}
                                              valueType={VALUE_TYPE_MAP[stat.key] ?? 'text'}
                                              isSaving={upsertMutation.isPending}
                                              onSave={(value) => {
                                                upsertMutation.mutate({
                                                  campaignId: campaign.id,
                                                  configKey: stat.key,
                                                  configValue: value,
                                                  existingId: config.id,
                                                });
                                              }}
                                            />
                                            <div className="mt-2 pt-2 border-t">
                                              <button
                                                type="button"
                                                className="text-[10px] text-red-500 hover:text-red-700 transition-colors"
                                                onClick={() => {
                                                  toggleMutation.mutate({ id: config.id, status: '미완료' });
                                                  setEditingItem(null);
                                                }}
                                              >
                                                미완료로 변경
                                              </button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {stat.incomplete.length === 0 && stat.completed.length > 0 && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                  <CheckCircle2 className="size-3.5" />
                                  모든 캠페인이 완료되었습니다
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
