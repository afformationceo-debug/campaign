'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, X, Pencil, Save, Plus, Trash2, FileText, Settings, LayoutGrid, List, Download, Upload } from 'lucide-react';
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
  '세팅 관련',
  '인플루언서 관련',
  '지식베이스',
  'CS어드민',
  'CRM',
  '기타',
];

const DEFAULT_TEMPLATE_CONFIGS = [
  // 세팅 관련
  { config_type: '세팅 관련', config_key: '인스타그램 URL' },
  { config_type: '세팅 관련', config_key: '페이스북 URL' },
  { config_type: '세팅 관련', config_key: '트위터 URL' },
  { config_type: '세팅 관련', config_key: '틱톡 URL' },
  { config_type: '세팅 관련', config_key: '플랫폼별 ID/PW' },
  { config_type: '세팅 관련', config_key: '고객전용 라인' },
  { config_type: '세팅 관련', config_key: '고객전용 왓츠앱 링크' },
  { config_type: '세팅 관련', config_key: '홈페이지 링크' },
  { config_type: '세팅 관련', config_key: '구글맵 세팅여부' },
  { config_type: '세팅 관련', config_key: '리틀리 세팅여부' },
  { config_type: '세팅 관련', config_key: '리틀리 링크' },
  // 인플루언서 관련
  { config_type: '인플루언서 관련', config_key: '인플루언서 전용 라인 세팅' },
  { config_type: '인플루언서 관련', config_key: '인플루언서 전용 왓츠앱 세팅' },
  { config_type: '인플루언서 관련', config_key: '스카웃매니저 메신저 연동' },
  { config_type: '인플루언서 관련', config_key: '스카웃매니저 캠페인 등록' },
  // 지식베이스
  { config_type: '지식베이스', config_key: '고객전용 지식베이스 세팅여부' },
  { config_type: '지식베이스', config_key: '인플전용 지식베이스 세팅여부' },
  // CS어드민
  { config_type: 'CS어드민', config_key: '메신저 채널 연동 여부' },
  // CRM
  { config_type: 'CRM', config_key: 'CRM 등록여부' },
];

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

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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

  // CSV Download - export current campaign configs
  const handleCsvDownload = useCallback(() => {
    if (!selectedCampaignId || configs.length === 0) return;
    const campaign = campaigns.find((c) => c.id === selectedCampaignId);
    const campaignName = campaign
      ? `${campaign.client_name}_${campaign.campaign_name}`
      : 'campaign';

    const BOM = '\uFEFF';
    const header = '설정유형,항목이름,값,상태';
    const rows = configs.map((config) =>
      [
        escapeCsvField(config.config_type),
        escapeCsvField(config.config_key),
        escapeCsvField(config.config_value ?? ''),
        escapeCsvField(config.status),
      ].join(',')
    );

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

          if (existing) {
            const { error } = await supabase
              .from('campaign_configs')
              .update({
                config_value: row.config_value,
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
                config_value: row.config_value,
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
      return [
        escapeCsvField(campaign?.client_name ?? ''),
        escapeCsvField(campaign?.campaign_name ?? ''),
        escapeCsvField(config.config_type),
        escapeCsvField(config.config_key),
        escapeCsvField(config.config_value ?? ''),
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

          if (existing) {
            const { error: updateErr } = await supabase
              .from('campaign_configs')
              .update({
                config_value: row.config_value,
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
                config_value: row.config_value,
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
      className="space-y-6"
    >
      <motion.div variants={fadeUpItem} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">캠페인 세팅</h1>
          <p className="text-muted-foreground text-sm mt-1">
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

      {/* Campaign selector + action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
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
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>
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
    </motion.div>
  );
}
