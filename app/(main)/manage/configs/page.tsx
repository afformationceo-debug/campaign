'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Pencil, Save, Plus, Trash2, FileText, Settings, LayoutGrid, List } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfigMatrix } from '@/components/manage/config-matrix';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Campaign, CampaignConfig } from '@/lib/types/database';

const CONFIG_TYPE_OPTIONS = [
  '기본 정보',
  'DM 템플릿',
  '이메일 템플릿',
  '결제 정보',
  '계약 조건',
  '타겟 설정',
  '기타',
];

const DEFAULT_TEMPLATE_CONFIGS = [
  { config_type: '기본 정보', config_key: '홈페이지 URL' },
  { config_type: '기본 정보', config_key: '인스타그램 URL' },
  { config_type: '기본 정보', config_key: '담당 병원/클리닉' },
  { config_type: '기본 정보', config_key: '주요 시술 항목' },
  { config_type: 'DM 템플릿', config_key: '초기 DM 텍스트' },
  { config_type: 'DM 템플릿', config_key: '팔로업 DM 텍스트' },
  { config_type: 'DM 템플릿', config_key: '예약 확인 DM' },
  { config_type: '이메일 템플릿', config_key: '웰컴 이메일' },
  { config_type: '이메일 템플릿', config_key: '예약 확인 이메일' },
  { config_type: '결제 정보', config_key: '결제 계좌' },
  { config_type: '결제 정보', config_key: '월 예산' },
  { config_type: '계약 조건', config_key: '계약 기간' },
  { config_type: '계약 조건', config_key: '수수료율' },
  { config_type: '타겟 설정', config_key: '타겟 국가' },
  { config_type: '타겟 설정', config_key: '타겟 연령대' },
  { config_type: '타겟 설정', config_key: '타겟 키워드' },
];

export default function ConfigsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // New config dialog state
  const [isNewConfigDialogOpen, setIsNewConfigDialogOpen] = useState(false);
  const [newConfigType, setNewConfigType] = useState('');
  const [newConfigKey, setNewConfigKey] = useState('');
  const [newConfigValue, setNewConfigValue] = useState('');

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
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

  // Auto-select first campaign when loaded
  useEffect(() => {
    if (!selectedCampaignId && campaigns.length > 0) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  // Fetch configs for selected campaign
  const { data: configs = [], isLoading } = useQuery({
    queryKey: queryKeys.configs.byCampaign(selectedCampaignId),
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from('campaign_configs')
        .select('*')
        .eq('campaign_id', selectedCampaignId)
        .order('config_type')
        .order('config_key');
      if (error) throw error;
      return data as CampaignConfig[];
    },
    enabled: !!selectedCampaignId,
  });

  // Update config value
  const updateValueMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from('campaign_configs')
        .update({ config_value: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configs.byCampaign(selectedCampaignId),
      });
      setEditingConfigId(null);
      setEditValue('');
      logActivity({
        userId: profile?.id,
        actionType: 'update',
        targetTable: 'campaign_configs',
        targetId: variables.id,
        newValue: { config_value: variables.value },
      });
    },
  });

  // Toggle config status
  const toggleStatusMutation = useMutation({
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
      const key = queryKeys.configs.byCampaign(selectedCampaignId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CampaignConfig[]>(key);
      queryClient.setQueryData(key, (old: CampaignConfig[] | undefined) =>
        (old || []).map((c) => (c.id === id ? { ...c, status } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.configs.byCampaign(selectedCampaignId),
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configs.byCampaign(selectedCampaignId),
      });
    },
  });

  // Create single config entry
  const createConfigMutation = useMutation({
    mutationFn: async (newConfig: {
      campaign_id: string;
      config_type: string;
      config_key: string;
      config_value: string;
      status: string;
    }) => {
      const { error } = await supabase
        .from('campaign_configs')
        .insert(newConfig);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configs.byCampaign(selectedCampaignId),
      });
      setIsNewConfigDialogOpen(false);
      setNewConfigType('');
      setNewConfigKey('');
      setNewConfigValue('');
    },
  });

  // Create default template configs
  const createTemplateMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const rows = DEFAULT_TEMPLATE_CONFIGS.map((item) => ({
        campaign_id: campaignId,
        config_type: item.config_type,
        config_key: item.config_key,
        config_value: '',
        status: '미완료',
      }));
      const { error } = await supabase
        .from('campaign_configs')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configs.byCampaign(selectedCampaignId),
      });
    },
  });

  // Delete config entry
  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaign_configs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configs.byCampaign(selectedCampaignId),
      });
    },
  });

  // Group by config_type
  const groupedConfigs = useMemo(() => {
    const groups: Record<string, CampaignConfig[]> = {};
    for (const config of configs) {
      const type = config.config_type || '기타';
      if (!groups[type]) groups[type] = [];
      groups[type].push(config);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'ko'));
  }, [configs]);

  const startEditing = (config: CampaignConfig) => {
    setEditingConfigId(config.id);
    setEditValue(config.config_value ?? '');
  };

  const cancelEditing = () => {
    setEditingConfigId(null);
    setEditValue('');
  };

  const saveEdit = (id: string) => {
    updateValueMutation.mutate({ id, value: editValue });
  };

  const handleCreateConfig = () => {
    if (!selectedCampaignId || !newConfigType || !newConfigKey.trim()) return;
    createConfigMutation.mutate({
      campaign_id: selectedCampaignId,
      config_type: newConfigType,
      config_key: newConfigKey.trim(),
      config_value: newConfigValue,
      status: '미완료',
    });
  };

  const handleCreateTemplate = () => {
    if (!selectedCampaignId) return;
    createTemplateMutation.mutate(selectedCampaignId);
  };

  const handleDeleteConfig = (id: string) => {
    deleteConfigMutation.mutate(id);
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">캠페인 세팅</h1>
        <p className="text-muted-foreground text-sm">
          캠페인별 설정 항목을 관리합니다.
        </p>
      </div>

      <Tabs defaultValue="individual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="individual" className="gap-1.5">
            <List className="h-3.5 w-3.5" />
            개별 세팅
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            매트릭스 뷰
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <ConfigMatrix />
        </TabsContent>

        <TabsContent value="individual" className="space-y-6">

      {/* Campaign selector */}
      <div className="flex items-center gap-3">
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="캠페인을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.campaign_name} ({campaign.client_name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCampaignId && (
          <>
            <Badge variant="secondary">{configs.length}개 설정 항목</Badge>
            <Button
              size="sm"
              onClick={() => setIsNewConfigDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              새 설정 추가
            </Button>
          </>
        )}
      </div>

      {/* New Config Dialog */}
      <Dialog open={isNewConfigDialogOpen} onOpenChange={setIsNewConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 설정 항목 추가</DialogTitle>
            <DialogDescription>
              선택한 캠페인에 새로운 설정 항목을 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="config-type">설정 유형</Label>
              <Select value={newConfigType} onValueChange={setNewConfigType}>
                <SelectTrigger id="config-type">
                  <SelectValue placeholder="설정 유형을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {CONFIG_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-key">항목 이름</Label>
              <Input
                id="config-key"
                placeholder="설정 항목 이름을 입력하세요"
                value={newConfigKey}
                onChange={(e) => setNewConfigKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-value">값</Label>
              <Textarea
                id="config-value"
                placeholder="설정 값을 입력하세요 (선택사항)"
                value={newConfigValue}
                onChange={(e) => setNewConfigValue(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewConfigDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleCreateConfig}
              disabled={
                !newConfigType ||
                !newConfigKey.trim() ||
                createConfigMutation.isPending
              }
            >
              {createConfigMutation.isPending ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config entries */}
      {!selectedCampaignId ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border rounded-lg gap-3">
          <Settings className="h-10 w-10 text-muted-foreground/50" />
          <div className="text-center">
            <p className="font-medium">캠페인을 선택하세요</p>
            <p className="text-sm">캠페인을 선택하면 설정 항목이 표시됩니다.</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          로딩 중...
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border rounded-lg gap-4">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <div className="text-center">
            <p className="font-medium text-muted-foreground">설정 항목이 없습니다.</p>
            <p className="text-sm text-muted-foreground mt-1">
              기본 템플릿을 생성하여 빠르게 시작하거나, 개별 설정을 추가하세요.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleCreateTemplate}
            disabled={createTemplateMutation.isPending}
          >
            <FileText className="h-4 w-4 mr-2" />
            {createTemplateMutation.isPending
              ? '생성 중...'
              : '기본 템플릿 생성'}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedConfigs.map(([configType, items]) => (
            <Card key={configType}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{configType}</CardTitle>
                <CardDescription>{items.length}개 항목</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">항목</TableHead>
                      <TableHead>값</TableHead>
                      <TableHead className="w-[100px] text-center">상태</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">
                          {config.config_key}
                        </TableCell>
                        <TableCell>
                          {editingConfigId === config.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-8"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(config.id);
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => saveEdit(config.id)}
                                disabled={updateValueMutation.isPending}
                              >
                                <Save className="h-3 w-3 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={cancelEditing}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className={cn(
                                'text-sm',
                                !config.config_value && 'text-muted-foreground italic'
                              )}
                            >
                              {config.config_value || '(비어있음)'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'cursor-pointer transition-colors',
                              config.status === '완료'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                            )}
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: config.id,
                                status: config.status === '완료' ? '미완료' : '완료',
                              })
                            }
                          >
                            {config.status === '완료' ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <X className="h-3 w-3 mr-1" />
                            )}
                            {config.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {editingConfigId !== config.id && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => startEditing(config)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleDeleteConfig(config.id)}
                              disabled={deleteConfigMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

        </TabsContent>
      </Tabs>
    </div>
  );
}
