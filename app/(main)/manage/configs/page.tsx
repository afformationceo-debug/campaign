'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, X, Plus, Trash2, FileText, Settings, LayoutGrid, List, Download, Upload, AlertTriangle, BarChart3, ExternalLink, Globe, Link2, KeyRound, ToggleLeft, ClipboardList, Bot } from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { logActivity } from '@/lib/utils/log-activity';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeConfigs } from '@/hooks/use-realtime-configs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfigMatrix } from '@/components/manage/config-matrix';
import { ConfigDashboard } from '@/components/manage/config-dashboard';
import { ConfigKeyView } from '@/components/manage/config-key-view';
import { Progress } from '@/components/ui/progress';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CredentialEditor, parseCredentials, credentialsToText, textToCredentialsJson } from '@/components/manage/credential-editor';
import type { Campaign, CampaignConfig, ConfigValueType } from '@/lib/types/database';

const CONFIG_TYPE_OPTIONS = [
  '세팅 관련',
  '인플루언서 관련',
  '지식베이스',
  'CS어드민',
  'CRM',
  '국내챗닥',
  '이커머스 세팅',
  '인플루언서 기획',
  '브랜드 마케팅',
  '기타',
];

const DEFAULT_TEMPLATE_CONFIGS = [
  // 세팅 관련
  { config_type: '세팅 관련', config_key: '인스타그램 URL', value_type: 'url' as const },
  { config_type: '세팅 관련', config_key: '페이스북 URL', value_type: 'url' as const },
  { config_type: '세팅 관련', config_key: '트위터 URL', value_type: 'url' as const },
  { config_type: '세팅 관련', config_key: '틱톡 URL', value_type: 'url' as const },
  { config_type: '세팅 관련', config_key: '플랫폼별 ID/PW', value_type: 'credentials' as const },
  { config_type: '세팅 관련', config_key: '고객전용 라인', value_type: 'url' as const },
  { config_type: '세팅 관련', config_key: '고객전용 왓츠앱 링크', value_type: 'url' as const },
  { config_type: '세팅 관련', config_key: '홈페이지 링크', value_type: 'url' as const },
  { config_type: '세팅 관련', config_key: '구글맵 세팅여부', value_type: 'status' as const },
  { config_type: '세팅 관련', config_key: '리틀리 세팅여부', value_type: 'status' as const },
  { config_type: '세팅 관련', config_key: '리틀리 링크', value_type: 'url' as const },
  // 인플루언서 관련
  { config_type: '인플루언서 관련', config_key: '인플루언서 전용 라인 세팅', value_type: 'url' as const },
  { config_type: '인플루언서 관련', config_key: '인플루언서 전용 왓츠앱 세팅', value_type: 'url' as const },
  { config_type: '인플루언서 관련', config_key: '스카웃매니저 라인 메신저 연동', value_type: 'status' as const },
  { config_type: '인플루언서 관련', config_key: '스카웃매니저 왓츠앱 메신저 연동', value_type: 'status' as const },
  { config_type: '인플루언서 관련', config_key: '스카웃매니저 캠페인 등록', value_type: 'status' as const },
  // 지식베이스
  { config_type: '지식베이스', config_key: '고객전용 지식베이스 세팅여부', value_type: 'status' as const },
  { config_type: '지식베이스', config_key: '인플전용 지식베이스 세팅여부', value_type: 'status' as const },
  // CS어드민
  { config_type: 'CS어드민', config_key: '메신저 채널 연동 여부', value_type: 'status' as const },
  { config_type: 'CS어드민', config_key: 'CRM 연동설정 여부', value_type: 'status' as const },
  // CRM
  { config_type: 'CRM', config_key: 'CRM 등록여부', value_type: 'status' as const },
];

const BRAND_TEMPLATE_CONFIGS = [
  { config_type: '이커머스 세팅', config_key: '플랫폼 계정 생성', value_type: 'status' as const },
  { config_type: '이커머스 세팅', config_key: '상품 등록', value_type: 'status' as const },
  { config_type: '이커머스 세팅', config_key: '결제 시스템 연동', value_type: 'status' as const },
  { config_type: '이커머스 세팅', config_key: '배송 설정', value_type: 'status' as const },
  { config_type: '인플루언서 기획', config_key: '타겟 인플루언서 리스트업', value_type: 'status' as const },
  { config_type: '인플루언서 기획', config_key: '원고비 예산 배분', value_type: 'text' as const },
  { config_type: '인플루언서 기획', config_key: '스카웃매니저 캠페인 세팅', value_type: 'status' as const },
  { config_type: '브랜드 마케팅', config_key: 'SNS 채널 세팅', value_type: 'status' as const },
  { config_type: '브랜드 마케팅', config_key: '광고 소재 제작', value_type: 'status' as const },
  { config_type: '브랜드 마케팅', config_key: '현지 마케팅 채널 연동', value_type: 'status' as const },
];

const STATUS_VALUE_OPTIONS = ['완료', '진행중', '미완료', '해당없음', '세팅완료', '진행필요', '불필요'];

// Parse a single CSV line handling quoted fields with commas/quotes inside
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function escapeCsvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export default function ConfigsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();

  // Realtime: sync config changes across all open tabs/PCs
  useRealtimeConfigs();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Config key renaming state (global across campaigns)
  const [renamingConfigId, setRenamingConfigId] = useState<string | null>(null);
  const [renameKeyValue, setRenameKeyValue] = useState('');
  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false);
  const [pendingRename, setPendingRename] = useState<{
    oldKey: string;
    newKey: string;
    configType: string;
    affectedCount: number;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameSubmittingRef = useRef(false);

  // New config dialog state
  const [isNewConfigDialogOpen, setIsNewConfigDialogOpen] = useState(false);
  const [newConfigType, setNewConfigType] = useState('');
  const [newConfigKey, setNewConfigKey] = useState('');
  const [newConfigValue, setNewConfigValue] = useState('');

  // CSV upload state (per-campaign)
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ updated: number; created: number } | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // All-campaigns CSV state
  const [allCsvUploading, setAllCsvUploading] = useState(false);
  const [allCsvResult, setAllCsvResult] = useState<{ updated: number; created: number; skipped: number } | null>(null);
  const allCsvFileInputRef = useRef<HTMLInputElement>(null);

  // Credential editor state
  const [credentialEditorOpen, setCredentialEditorOpen] = useState(false);
  const [credentialEditingConfig, setCredentialEditingConfig] = useState<CampaignConfig | null>(null);

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

  // Fetch ALL configs for counts in dropdown (uses separate key to avoid collisions)
  const { data: allCampaignConfigs = [] } = useQuery({
    queryKey: queryKeys.configs.counts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_configs')
        .select('campaign_id, status');
      if (error) throw error;
      return data as { campaign_id: string; status: string }[];
    },
  });

  // Config counts per campaign for dropdown display
  const configCountMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const cfg of allCampaignConfigs) {
      const entry = map.get(cfg.campaign_id) || { total: 0, done: 0 };
      entry.total += 1;
      if (cfg.status !== '미완료') entry.done += 1;
      map.set(cfg.campaign_id, entry);
    }
    return map;
  }, [allCampaignConfigs]);

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
    refetchOnWindowFocus: true,
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
      // Choose template based on campaign type
      const campaign = campaigns.find((c) => c.id === campaignId);
      const templateConfigs = campaign?.campaign_type === '제품브랜드'
        ? BRAND_TEMPLATE_CONFIGS
        : DEFAULT_TEMPLATE_CONFIGS;
      const rows = templateConfigs.map((item) => ({
        campaign_id: campaignId,
        config_type: item.config_type,
        config_key: item.config_key,
        config_value: '',
        value_type: item.value_type,
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

  // Rename config_key globally across ALL campaigns
  const renameConfigKeyMutation = useMutation({
    mutationFn: async ({
      oldKey,
      newKey,
      configType,
    }: {
      oldKey: string;
      newKey: string;
      configType: string;
    }) => {
      const { data, error } = await supabase
        .from('campaign_configs')
        .update({ config_key: newKey, updated_at: new Date().toISOString() })
        .eq('config_key', oldKey)
        .eq('config_type', configType)
        .select('id');
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate ALL config queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['configs'] });
      renameSubmittingRef.current = false;
      setRenamingConfigId(null);
      setRenameKeyValue('');
      setRenameConfirmOpen(false);
      setPendingRename(null);
      logActivity({
        userId: profile?.id,
        actionType: 'rename_config_key',
        targetTable: 'campaign_configs',
        targetId: null,
        oldValue: { config_key: variables.oldKey },
        newValue: { config_key: variables.newKey, config_type: variables.configType, updatedRows: data?.length ?? 0 },
      });
    },
    onError: (err) => {
      renameSubmittingRef.current = false;
      alert(`항목명 변경 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    },
  });

  // Start renaming a config key
  const startRenameKey = (config: CampaignConfig) => {
    if (renameSubmittingRef.current) return;
    setRenamingConfigId(config.id);
    setRenameKeyValue(config.config_key);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  // Check how many campaigns would be affected and show confirmation
  const handleRenameKeySubmit = async (config: CampaignConfig) => {
    // Guard against double-submission from Enter + onBlur race
    if (renameSubmittingRef.current || renameConfirmOpen) return;

    const newKey = renameKeyValue.trim();
    if (!newKey || newKey === config.config_key) {
      setRenamingConfigId(null);
      setRenameKeyValue('');
      return;
    }

    renameSubmittingRef.current = true;

    // Count affected rows across all campaigns
    const { count, error } = await supabase
      .from('campaign_configs')
      .select('*', { count: 'exact', head: true })
      .eq('config_key', config.config_key)
      .eq('config_type', config.config_type);

    if (error) {
      console.error('Count error:', error);
      renameSubmittingRef.current = false;
      alert(`조회 실패: ${error.message}`);
      return;
    }

    const affectedCount = count ?? 0;

    if (affectedCount > 1) {
      // Multiple campaigns affected - show confirmation dialog
      renameSubmittingRef.current = false;
      setPendingRename({
        oldKey: config.config_key,
        newKey,
        configType: config.config_type,
        affectedCount,
      });
      setRenameConfirmOpen(true);
    } else {
      // Only this campaign or no match - apply directly
      renameConfigKeyMutation.mutate({
        oldKey: config.config_key,
        newKey,
        configType: config.config_type,
      });
    }
  };

  const confirmRename = () => {
    if (!pendingRename) return;
    renameSubmittingRef.current = true;
    renameConfigKeyMutation.mutate({
      oldKey: pendingRename.oldKey,
      newKey: pendingRename.newKey,
      configType: pendingRename.configType,
    });
  };

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

  // CSV Download - export current campaign configs
  const handleCsvDownload = useCallback(() => {
    if (!selectedCampaignId || configs.length === 0) return;
    const campaign = campaigns.find((c) => c.id === selectedCampaignId);
    const campaignName = campaign
      ? `${campaign.client_name}_${campaign.campaign_name}`
      : 'campaign';

    const BOM = '\uFEFF';
    const header = '설정유형,항목이름,값,상태';
    const rows = configs.map((config) => {
      const displayValue = config.value_type === 'credentials'
        ? credentialsToText(config.config_value)
        : config.config_value ?? '';
      return [
        escapeCsvField(config.config_type),
        escapeCsvField(config.config_key),
        escapeCsvField(displayValue),
        escapeCsvField(config.status),
      ].join(',');
    });

    const csvContent = BOM + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${campaignName}_설정.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [selectedCampaignId, configs, campaigns]);

  // CSV Upload - parse and upsert to Supabase
  const handleCsvUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedCampaignId) return;

      setCsvUploading(true);
      setCsvResult(null);

      try {
        const text = await file.text();
        const content = text.replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length < 2) {
          alert('CSV 파일에 데이터가 없습니다.');
          return;
        }

        // Parse & validate header
        const headers = parseCsvLine(lines[0]);
        const expectedHeaders = ['설정유형', '항목이름', '값', '상태'];
        const headerMap: Record<string, number> = {};
        for (const expected of expectedHeaders) {
          const idx = headers.findIndex((h) => h.trim() === expected);
          if (idx === -1) {
            alert(
              `필수 컬럼 "${expected}"이(가) 없습니다.\n예상 형식: ${expectedHeaders.join(',')}`
            );
            return;
          }
          headerMap[expected] = idx;
        }

        // Parse data rows
        const rows: {
          config_type: string;
          config_key: string;
          config_value: string;
          status: string;
        }[] = [];
        for (let i = 1; i < lines.length; i++) {
          const fields = parseCsvLine(lines[i]);
          if (fields.length < 4) continue;
          const config_type = fields[headerMap['설정유형']].trim();
          const config_key = fields[headerMap['항목이름']].trim();
          const config_value = fields[headerMap['값']].trim();
          const status = fields[headerMap['상태']].trim();
          if (!config_type || !config_key) continue;
          rows.push({
            config_type,
            config_key,
            config_value,
            status: status || '미완료',
          });
        }

        if (rows.length === 0) {
          alert('유효한 데이터가 없습니다.');
          return;
        }

        // Fetch existing configs for matching
        const { data: existingConfigs, error: fetchError } = await supabase
          .from('campaign_configs')
          .select('*')
          .eq('campaign_id', selectedCampaignId);
        if (fetchError) throw fetchError;

        // Build lookup: config_type::config_key → existing record
        const existingMap = new Map<string, CampaignConfig>();
        (existingConfigs || []).forEach((c: CampaignConfig) => {
          existingMap.set(`${c.config_type}::${c.config_key}`, c);
        });

        let updated = 0;
        let created = 0;

        for (const row of rows) {
          const key = `${row.config_type}::${row.config_key}`;
          const existing = existingMap.get(key);

          // Convert credentials text to JSON for storage
          const isCredential = row.config_key === '플랫폼별 ID/PW' || existing?.value_type === 'credentials';
          const storedValue = isCredential
            ? textToCredentialsJson(row.config_value)
            : row.config_value;

          if (existing) {
            const { error } = await supabase
              .from('campaign_configs')
              .update({
                config_value: storedValue,
                status: row.status,
              })
              .eq('id', existing.id);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await supabase
              .from('campaign_configs')
              .insert({
                campaign_id: selectedCampaignId,
                config_type: row.config_type,
                config_key: row.config_key,
                config_value: storedValue,
                status: row.status,
              });
            if (error) throw error;
            created++;
          }
        }

        logActivity({
          userId: profile?.id,
          actionType: 'csv_import',
          targetTable: 'campaign_configs',
          targetId: selectedCampaignId,
          newValue: { updated, created, totalRows: rows.length },
        });

        // Invalidate caches
        queryClient.invalidateQueries({
          queryKey: queryKeys.configs.byCampaign(selectedCampaignId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.configs.all,
        });

        setCsvResult({ updated, created });
      } catch (err) {
        console.error('CSV upload error:', err);
        alert(
          `CSV 업로드 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
        );
      } finally {
        setCsvUploading(false);
        if (csvFileInputRef.current) {
          csvFileInputRef.current.value = '';
        }
      }
    },
    [selectedCampaignId, supabase, queryClient, profile]
  );

  // All-campaigns CSV Download
  const handleAllCsvDownload = useCallback(async () => {
    if (campaigns.length === 0) return;

    // Fetch all configs across all campaigns
    const { data: allConfigs, error } = await supabase
      .from('campaign_configs')
      .select('*')
      .order('campaign_id')
      .order('config_type')
      .order('config_key');
    if (error) {
      alert(`데이터 조회 실패: ${error.message}`);
      return;
    }

    // Build campaign lookup
    const campaignMap = new Map<string, Campaign>();
    campaigns.forEach((c) => campaignMap.set(c.id, c));

    const BOM = '\uFEFF';
    const header = '고객명,캠페인명,설정유형,항목이름,값,상태';
    const rows = (allConfigs as CampaignConfig[]).map((config) => {
      const campaign = campaignMap.get(config.campaign_id);
      const displayValue = config.value_type === 'credentials'
        ? credentialsToText(config.config_value)
        : config.config_value ?? '';
      return [
        escapeCsvField(campaign?.client_name ?? ''),
        escapeCsvField(campaign?.campaign_name ?? ''),
        escapeCsvField(config.config_type),
        escapeCsvField(config.config_key),
        escapeCsvField(displayValue),
        escapeCsvField(config.status),
      ].join(',');
    });

    const csvContent = BOM + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `전체_캠페인_설정_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [campaigns, supabase]);

  // All-campaigns CSV Upload
  const handleAllCsvUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setAllCsvUploading(true);
      setAllCsvResult(null);

      try {
        const text = await file.text();
        const content = text.replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length < 2) {
          alert('CSV 파일에 데이터가 없습니다.');
          return;
        }

        // Parse & validate header
        const headers = parseCsvLine(lines[0]);
        const expectedHeaders = ['고객명', '캠페인명', '설정유형', '항목이름', '값', '상태'];
        const headerMap: Record<string, number> = {};
        for (const expected of expectedHeaders) {
          const idx = headers.findIndex((h) => h.trim() === expected);
          if (idx === -1) {
            alert(
              `필수 컬럼 "${expected}"이(가) 없습니다.\n예상 형식: ${expectedHeaders.join(',')}`
            );
            return;
          }
          headerMap[expected] = idx;
        }

        // Parse data rows
        const rows: {
          client_name: string;
          campaign_name: string;
          config_type: string;
          config_key: string;
          config_value: string;
          status: string;
        }[] = [];
        for (let i = 1; i < lines.length; i++) {
          const fields = parseCsvLine(lines[i]);
          if (fields.length < 6) continue;
          const client_name = fields[headerMap['고객명']].trim();
          const campaign_name = fields[headerMap['캠페인명']].trim();
          const config_type = fields[headerMap['설정유형']].trim();
          const config_key = fields[headerMap['항목이름']].trim();
          const config_value = fields[headerMap['값']].trim();
          const status = fields[headerMap['상태']].trim();
          if (!client_name || !campaign_name || !config_type || !config_key) continue;
          rows.push({
            client_name,
            campaign_name,
            config_type,
            config_key,
            config_value,
            status: status || '미완료',
          });
        }

        if (rows.length === 0) {
          alert('유효한 데이터가 없습니다.');
          return;
        }

        // Build campaign lookup: client_name + campaign_name → campaign_id
        const campaignLookup = new Map<string, string>();
        campaigns.forEach((c) => {
          campaignLookup.set(`${c.client_name}::${c.campaign_name}`, c.id);
        });

        // Fetch ALL existing configs
        const { data: existingAll, error: fetchError } = await supabase
          .from('campaign_configs')
          .select('*');
        if (fetchError) throw fetchError;

        // Build lookup: campaign_id::config_type::config_key → existing record
        const existingMap = new Map<string, CampaignConfig>();
        (existingAll || []).forEach((c: CampaignConfig) => {
          existingMap.set(`${c.campaign_id}::${c.config_type}::${c.config_key}`, c);
        });

        let updated = 0;
        let created = 0;
        let skipped = 0;

        for (const row of rows) {
          const campaignId = campaignLookup.get(
            `${row.client_name}::${row.campaign_name}`
          );
          if (!campaignId) {
            skipped++;
            continue;
          }

          const key = `${campaignId}::${row.config_type}::${row.config_key}`;
          const existing = existingMap.get(key);

          // Convert credentials text to JSON for storage
          const isCredential = row.config_key === '플랫폼별 ID/PW' || existing?.value_type === 'credentials';
          const storedValue = isCredential
            ? textToCredentialsJson(row.config_value)
            : row.config_value;

          if (existing) {
            const { error: updateErr } = await supabase
              .from('campaign_configs')
              .update({
                config_value: storedValue,
                status: row.status,
              })
              .eq('id', existing.id);
            if (updateErr) throw updateErr;
            updated++;
          } else {
            const { error: insertErr } = await supabase
              .from('campaign_configs')
              .insert({
                campaign_id: campaignId,
                config_type: row.config_type,
                config_key: row.config_key,
                config_value: storedValue,
                status: row.status,
              });
            if (insertErr) throw insertErr;
            created++;
          }
        }

        logActivity({
          userId: profile?.id,
          actionType: 'csv_import_all',
          targetTable: 'campaign_configs',
          targetId: null,
          newValue: { updated, created, skipped, totalRows: rows.length },
        });

        // Invalidate all config caches
        queryClient.invalidateQueries({ queryKey: ['configs'] });

        setAllCsvResult({ updated, created, skipped });
      } catch (err) {
        console.error('All-campaigns CSV upload error:', err);
        alert(
          `전체 CSV 업로드 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
        );
      } finally {
        setAllCsvUploading(false);
        if (allCsvFileInputRef.current) {
          allCsvFileInputRef.current.value = '';
        }
      }
    },
    [campaigns, supabase, queryClient, profile]
  );

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <span className="text-lg">🔒</span>
          </div>
          <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-3"
    >
      <motion.div variants={fadeUpItem} className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">캠페인 세팅</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            캠페인별 설정 항목을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAllCsvDownload}
            disabled={campaigns.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            전체 CSV 다운로드
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => allCsvFileInputRef.current?.click()}
            disabled={allCsvUploading}
          >
            <Upload className="h-4 w-4 mr-1" />
            {allCsvUploading ? '업로드 중...' : '전체 CSV 업로드'}
          </Button>
          <input
            ref={allCsvFileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleAllCsvUpload}
          />
        </div>
      </motion.div>

      {/* AI Agent Guide Banner */}
      <motion.div variants={fadeUpItem}>
        <div className="relative rounded-xl border border-slate-200 dark:border-slate-800/50 bg-gradient-to-r from-slate-50/80 via-gray-50/50 to-transparent dark:from-slate-950/30 dark:via-gray-950/20 dark:to-transparent px-4 py-3.5 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-100/30 to-transparent dark:from-slate-900/15 rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-gray-100/20 to-transparent dark:from-gray-900/10 rounded-tr-full" />
          <div className="flex gap-3 items-start relative">
            <div className="relative shrink-0 mt-0.5">
              <div className="size-9 rounded-full bg-gradient-to-br from-slate-500 via-gray-500 to-zinc-600 flex items-center justify-center shadow-md shadow-slate-200/50 dark:shadow-slate-900/30 ring-2 ring-white/80 dark:ring-white/10">
                <Bot className="size-4 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-slate-900 dark:text-slate-200">어포메이션 본질 AI Agent</p>
                <span className="text-[9px] font-medium text-slate-500/60 dark:text-slate-400/50 bg-slate-100/60 dark:bg-slate-800/30 px-1.5 py-0.5 rounded-full">캠페인 세팅 가이드</span>
              </div>
              <div className="text-[11px] text-slate-800/80 dark:text-slate-300/70 leading-[1.7] space-y-1">
                <p>안녕하세요, 어포메이션 임직원 여러분! 캠페인 세팅 페이지를 안내해 드립니다.</p>
                <div className="bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2 space-y-0.5 border border-slate-200/50 dark:border-slate-700/20">
                  <p>각 캠페인의 <strong className="text-slate-700 dark:text-slate-300">SNS URL, 플랫폼 ID/PW, 지식베이스, CRM 연동</strong> 등의 세팅 항목을 관리합니다.</p>
                  <p><strong className="text-gray-700 dark:text-gray-300">대시보드 뷰</strong>에서 전체 캠페인의 세팅 현황을 한눈에 확인할 수 있으며, <strong className="text-gray-700 dark:text-gray-300">CSV 내보내기/가져오기</strong>도 지원합니다.</p>
                </div>
                <p className="text-[10px] text-slate-600/60 dark:text-slate-400/40">세팅 항목이 누락되면 캠페인 운영에 차질이 생길 수 있으니 빠짐없이 입력해 주세요!</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* All-campaigns CSV result */}
      {allCsvResult && (
        <motion.div variants={fadeUpItem} className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-2 rounded-lg">
          <Check className="h-4 w-4 shrink-0" />
          전체 CSV 업로드 완료: {allCsvResult.created}개 생성, {allCsvResult.updated}개 업데이트
          {allCsvResult.skipped > 0 && `, ${allCsvResult.skipped}개 스킵 (캠페인 미매칭)`}
          <button
            className="ml-2 text-xs underline cursor-pointer"
            onClick={() => setAllCsvResult(null)}
          >
            닫기
          </button>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (v === 'individual' && !selectedCampaignId && campaigns.length > 0) {
          setSelectedCampaignId(campaigns[0].id);
        }
      }} className="space-y-2">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            대시보드
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-1.5">
            <List className="h-3.5 w-3.5" />
            개별 세팅
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            매트릭스 뷰
          </TabsTrigger>
          <TabsTrigger value="key-view" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            항목별 현황
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ConfigDashboard onSelectCampaign={(id) => {
            setSelectedCampaignId(id);
            setActiveTab('individual');
          }} />
        </TabsContent>

        <TabsContent value="matrix">
          <ConfigMatrix />
        </TabsContent>

        <TabsContent value="key-view">
          <ConfigKeyView />
        </TabsContent>

        <TabsContent value="individual" className="space-y-3">

      {/* Campaign selector + action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="캠페인을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => {
              const counts = configCountMap.get(campaign.id);
              return (
                <SelectItem key={campaign.id} value={campaign.id}>
                  <div className="flex items-center gap-2">
                    <span>{campaign.campaign_name} ({campaign.client_name})</span>
                    {counts ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] px-1.5 py-0 shrink-0',
                          counts.done === counts.total
                            ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30'
                            : counts.done > 0
                            ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30'
                            : 'text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-950/30'
                        )}
                      >
                        {counts.done}/{counts.total} 설정됨
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 text-muted-foreground">
                        미설정
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleCsvDownload}
              disabled={configs.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV 다운로드
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => csvFileInputRef.current?.click()}
              disabled={csvUploading}
            >
              <Upload className="h-4 w-4 mr-1" />
              {csvUploading ? '업로드 중...' : 'CSV 업로드'}
            </Button>
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
          </>
        )}
      </div>

      {/* Campaign progress summary */}
      {selectedCampaignId && configs.length > 0 && (() => {
        const done = configs.filter((c) => c.status === '완료').length;
        const pct = Math.round((done / configs.length) * 100);
        return (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/20">
            <span className="text-[11px] text-muted-foreground shrink-0">세팅 진행률</span>
            <Progress value={pct} className="h-2 flex-1" />
            <span className={cn(
              'text-xs font-semibold shrink-0',
              pct === 100 && 'text-emerald-600',
              pct > 0 && pct < 100 && 'text-amber-600',
              pct === 0 && 'text-red-500',
            )}>
              {done}/{configs.length} ({pct}%)
            </span>
          </div>
        );
      })()}

      {/* CSV upload result */}
      {csvResult && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-2 rounded-lg">
          <Check className="h-4 w-4" />
          CSV 업로드 완료: {csvResult.created}개 생성, {csvResult.updated}개 업데이트
          <button
            className="ml-2 text-xs underline cursor-pointer"
            onClick={() => setCsvResult(null)}
          >
            닫기
          </button>
        </div>
      )}

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

      {/* Rename Confirmation Dialog */}
      <Dialog open={renameConfirmOpen} onOpenChange={(open) => {
        if (!open) {
          setRenameConfirmOpen(false);
          setPendingRename(null);
          setRenamingConfigId(null);
          setRenameKeyValue('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              항목명 일괄 변경 확인
            </DialogTitle>
            <DialogDescription>
              이 변경은 모든 캠페인에 동시에 적용됩니다.
            </DialogDescription>
          </DialogHeader>
          {pendingRename && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">변경 전:</span>
                  <span className="font-medium line-through text-red-500">{pendingRename.oldKey}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">변경 후:</span>
                  <span className="font-medium text-emerald-600">{pendingRename.newKey}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">설정 유형:</span>
                  <Badge variant="secondary" className="text-[10px]">{pendingRename.configType}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span><strong>{pendingRename.affectedCount}개 캠페인</strong>의 해당 항목명이 일괄 변경됩니다.</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRenameConfirmOpen(false);
              setPendingRename(null);
              setRenamingConfigId(null);
              setRenameKeyValue('');
            }}>
              취소
            </Button>
            <Button
              onClick={confirmRename}
              disabled={renameConfigKeyMutation.isPending}
            >
              {renameConfigKeyMutation.isPending ? '변경 중...' : '일괄 변경'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config entries */}
      {!selectedCampaignId ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border rounded-lg gap-2">
          <Settings className="h-8 w-8 text-muted-foreground/50" />
          <div className="text-center">
            <p className="font-medium text-sm">캠페인을 선택하세요</p>
            <p className="text-xs">캠페인을 선택하면 설정 항목이 표시됩니다.</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 border rounded-lg gap-2">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <div className="text-center">
            <p className="font-medium text-sm text-muted-foreground">설정 항목이 없습니다.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
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
        <div className="space-y-2">
          {groupedConfigs.map(([configType, items]) => {
            const groupDone = items.filter((i) => i.status === '완료').length;
            const groupPct = items.length > 0 ? Math.round((groupDone / items.length) * 100) : 0;
            const groupIcon = configType === 'CRM' ? <BarChart3 className="size-3 text-muted-foreground" />
              : configType === 'CS어드민' ? <Globe className="size-3 text-muted-foreground" />
              : configType === '지식베이스' ? <FileText className="size-3 text-muted-foreground" />
              : configType === '인플루언서 관련' ? <Link2 className="size-3 text-muted-foreground" />
              : <Settings className="size-3 text-muted-foreground" />;

            return (
            <div key={configType} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center gap-2">
                {groupIcon}
                <span className="text-xs font-semibold">{configType}</span>
                <div className="flex items-center gap-2 ml-auto">
                  <Progress value={groupPct} className="h-1 w-16" />
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[9px] px-1.5 py-0',
                      groupPct === 100 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                      groupPct > 0 && groupPct < 100 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
                    )}
                  >
                    {groupDone}/{items.length}
                  </Badge>
                </div>
              </div>
              <table className="w-full table-fixed text-left">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[25%]">항목</th>
                    <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground">값</th>
                    <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[80px] text-center">상태</th>
                    <th className="px-3 py-1 text-[10px] font-semibold text-muted-foreground w-[36px]" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((config) => (
                    <tr key={config.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-1">
                        {renamingConfigId === config.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              ref={renameInputRef}
                              value={renameKeyValue}
                              onChange={(e) => setRenameKeyValue(e.target.value)}
                              className="h-6 text-[11px] font-medium"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                  e.currentTarget.blur();
                                }
                                if (e.key === 'Escape') { setRenamingConfigId(null); setRenameKeyValue(''); }
                              }}
                              onBlur={() => handleRenameKeySubmit(config)}
                            />
                          </div>
                        ) : (
                          <span
                            className="text-[11px] font-medium truncate block cursor-text hover:bg-accent/50 rounded px-1 -mx-1 min-h-[20px]"
                            onClick={() => startRenameKey(config)}
                            title="클릭하여 항목명 수정 (전체 캠페인 일괄 반영)"
                          >
                            {config.config_key}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1">
                        {/* value_type-aware rendering */}
                        {config.value_type === 'credentials' ? (
                          <span
                            className="text-[11px] cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 min-h-[20px] block"
                            onClick={() => { setCredentialEditingConfig(config); setCredentialEditorOpen(true); }}
                          >
                            {config.config_value ? (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {parseCredentials(config.config_value).length}개 플랫폼
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/50 italic">클릭하여 입력</span>
                            )}
                          </span>
                        ) : config.value_type === 'status' ? (
                          <Select
                            value={config.config_value || '__empty__'}
                            onValueChange={(v) => {
                              const newVal = v === '__empty__' ? '' : v;
                              updateValueMutation.mutate({ id: config.id, value: newVal });
                            }}
                          >
                            <SelectTrigger className={cn(
                              'h-6 text-[11px] border-0 bg-transparent px-1 -mx-1 font-medium',
                              (config.config_value === '세팅완료' || config.config_value === '완료') && 'text-emerald-700 dark:text-emerald-400',
                              (config.config_value === '불필요' || config.config_value === '해당없음') && 'text-gray-500',
                              config.config_value === '미완료' && 'text-red-600 dark:text-red-400',
                              (config.config_value === '진행필요' || config.config_value === '진행중') && 'text-amber-600 dark:text-amber-400',
                            )}>
                              <SelectValue placeholder="선택..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">
                                <span className="text-muted-foreground/50">(비어있음)</span>
                              </SelectItem>
                              {STATUS_VALUE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  <span className={cn(
                                    (opt === '세팅완료' || opt === '완료') && 'text-emerald-700',
                                    opt === '미완료' && 'text-red-600',
                                    (opt === '진행필요' || opt === '진행중') && 'text-amber-600',
                                    (opt === '불필요' || opt === '해당없음') && 'text-gray-500',
                                  )}>
                                    {(opt === '세팅완료' || opt === '완료') ? '✓ ' : opt === '미완료' ? '✕ ' : (opt === '진행필요' || opt === '진행중') ? '◌ ' : ''}{opt}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : config.value_type === 'url' ? (
                          editingConfigId === config.id ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-6 text-[11px]"
                              autoFocus
                              placeholder="URL 또는 세팅완료/불필요"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveEdit(config.id);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              onBlur={() => saveEdit(config.id)}
                            />
                          ) : config.config_value && /^https?:\/\//.test(config.config_value) ? (
                            <div className="flex items-center gap-1 min-w-0">
                              <ExternalLink className="size-2.5 text-blue-500 shrink-0" />
                              <a
                                href={config.config_value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline truncate block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {config.config_value}
                              </a>
                              <span
                                className="text-[9px] text-muted-foreground/40 cursor-text hover:text-muted-foreground shrink-0"
                                onClick={() => startEditing(config)}
                                title="수정"
                              >
                                수정
                              </span>
                            </div>
                          ) : (config.config_value === '세팅완료' || config.config_value === '완료') ? (
                            <span className="inline-flex items-center gap-1 cursor-text" onClick={() => startEditing(config)}>
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{config.config_value}</Badge>
                            </span>
                          ) : config.config_value === '불필요' ? (
                            <span className="inline-flex items-center gap-1 cursor-text" onClick={() => startEditing(config)}>
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">불필요</Badge>
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'text-[11px] truncate block cursor-text hover:bg-accent/50 rounded px-1 -mx-1 min-h-[20px]',
                                !config.config_value && 'text-muted-foreground/50 italic'
                              )}
                              onClick={() => startEditing(config)}
                            >
                              {config.config_value || '클릭하여 입력'}
                            </span>
                          )
                        ) : (
                          /* text (default) */
                          editingConfigId === config.id ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-6 text-[11px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveEdit(config.id);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              onBlur={() => saveEdit(config.id)}
                            />
                          ) : (
                            <span
                              className={cn(
                                'text-[11px] truncate block cursor-text hover:bg-accent/50 rounded px-1 -mx-1 min-h-[20px]',
                                !config.config_value && 'text-muted-foreground/50 italic'
                              )}
                              onClick={() => startEditing(config)}
                            >
                              {config.config_value || '(비어있음)'}
                            </span>
                          )
                        )}
                      </td>
                      <td className="px-3 py-1 text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'cursor-pointer transition-colors text-[9px] px-1.5 py-0',
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
                            <Check className="h-2.5 w-2.5 mr-0.5" />
                          ) : (
                            <X className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {config.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDeleteConfig(config.id)}
                          disabled={deleteConfigMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })}
        </div>
      )}

        </TabsContent>
      </Tabs>

      {/* Credential Editor Dialog */}
      <CredentialEditor
        open={credentialEditorOpen}
        onOpenChange={setCredentialEditorOpen}
        value={credentialEditingConfig?.config_value ?? null}
        campaignName={campaigns.find((c) => c.id === credentialEditingConfig?.campaign_id)?.campaign_name}
        onSave={(value) => {
          if (credentialEditingConfig) {
            updateValueMutation.mutate({ id: credentialEditingConfig.id, value });
          }
        }}
      />
    </motion.div>
  );
}
