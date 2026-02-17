'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Filter,
  ChevronDown,
  FileEdit,
  Plus,
  Trash2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { ActivityLog, User, Campaign, Task } from '@/lib/types/database';

const PAGE_SIZE = 30;

// target_table 한글 매핑
const TABLE_LABELS: Record<string, string> = {
  daily_checks: '일일 체크',
  campaign_task_config: '업무 적용설정',
  campaigns: '캠페인',
  tasks: '업무',
  users: '사용자',
  campaign_configs: '캠페인 세팅',
};

// new_value/old_value 내 필드명 한글 매핑
const FIELD_LABELS: Record<string, string> = {
  status: '상태',
  campaign_id: '캠페인',
  task_id: '업무',
  check_date: '체크 날짜',
  assigned_user_id: '담당자',
  is_applicable: '적용 여부',
  note: '메모',
  campaign_name: '캠페인명',
  client_name: '광고주',
  target_country: '타겟 국가',
  task_name: '업무명',
  category: '카테고리',
  loop_order: '순서',
  is_applicable_default: '기본 적용 여부',
  default_assignees: '기본 담당자',
  config_key: '설정 키',
  config_value: '설정 값',
  scope: '범위',
};

const ACTION_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileEdit; className: string }> = {
  insert: { label: '생성', icon: Plus, className: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  update: { label: '수정', icon: FileEdit, className: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  delete: { label: '삭제', icon: Trash2, className: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
};

function getActionConfig(actionType: string) {
  const lower = actionType.toLowerCase();
  if (lower.includes('insert') || lower.includes('create')) return ACTION_TYPE_CONFIG.insert;
  if (lower.includes('delete') || lower.includes('remove')) return ACTION_TYPE_CONFIG.delete;
  return ACTION_TYPE_CONFIG.update;
}

function DiffDisplay({
  oldValue,
  newValue,
  campaignMap,
  taskMap,
  userMap,
}: {
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  campaignMap: Map<string, Campaign>;
  taskMap: Map<string, Task>;
  userMap: Map<string, User>;
}) {
  if (!oldValue && !newValue) return null;

  const allKeys = new Set([
    ...Object.keys(oldValue ?? {}),
    ...Object.keys(newValue ?? {}),
  ]);

  // 숨길 필드: id, 타임스탬프
  const HIDDEN_KEYS = new Set(['id', 'updated_at', 'created_at']);

  const changedEntries = Array.from(allKeys)
    .filter((key) => {
      if (HIDDEN_KEYS.has(key)) return false;
      const oldV = oldValue?.[key];
      const newV = newValue?.[key];
      return JSON.stringify(oldV) !== JSON.stringify(newV);
    })
    .slice(0, 8);

  if (changedEntries.length === 0) return null;

  // UUID → 실제값 변환
  const resolveValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    const strVal = String(value);
    if (key === 'campaign_id') {
      const campaign = campaignMap.get(strVal);
      return campaign ? `${campaign.client_name} - ${campaign.campaign_name}` : strVal;
    }
    if (key === 'task_id') {
      const task = taskMap.get(strVal);
      return task ? task.task_name : strVal;
    }
    if (key === 'assigned_user_id') {
      const user = userMap.get(strVal);
      return user ? user.name : strVal;
    }
    if (key === 'is_applicable' || key === 'is_applicable_default') {
      return value ? '적용' : '미적용';
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return strVal;
  };

  return (
    <div className="mt-2 space-y-1">
      {changedEntries.map((key) => {
        const oldV = oldValue?.[key];
        const newV = newValue?.[key];
        const label = FIELD_LABELS[key] ?? key;
        return (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="text-muted-foreground shrink-0 min-w-[80px]">
              {label}:
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {oldV !== undefined && (
                <span className="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-1.5 py-0.5 rounded text-[11px] line-through">
                  {resolveValue(key, oldV)}
                </span>
              )}
              {oldV !== undefined && newV !== undefined && (
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              {newV !== undefined && (
                <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[11px]">
                  {resolveValue(key, newV)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function LogsPage() {
  const supabase = createClient();
  const isAdmin = useIsAdmin();

  const [userFilter, setUserFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Fetch users for filter dropdown
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as User[];
    },
  });

  // Fetch campaigns for ID → name resolution
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

  // Fetch tasks for ID → name resolution
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('loop_order');
      if (error) throw error;
      return data as Task[];
    },
  });

  // Infinite query for logs
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      ...queryKeys.logs.all,
      userFilter,
      actionFilter,
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
    ],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      }
      if (actionFilter !== 'all') {
        query = query.ilike('action_type', `%${actionFilter}%`);
      }
      if (dateFrom) {
        query = query.gte('created_at', format(dateFrom, 'yyyy-MM-dd'));
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setDate(toDate.getDate() + 1);
        query = query.lt('created_at', format(toDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLog[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });

  const logs = data?.pages.flat() ?? [];

  // Build lookup maps
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) {
      map.set(u.id, u);
    }
    return map;
  }, [users]);

  const campaignMap = useMemo(() => {
    const map = new Map<string, Campaign>();
    for (const c of campaigns) {
      map.set(c.id, c);
    }
    return map;
  }, [campaigns]);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) {
      map.set(t.id, t);
    }
    return map;
  }, [tasks]);

  // Unique action types for filter
  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      set.add(log.action_type);
    }
    return Array.from(set).sort();
  }, [logs]);

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
      <motion.div variants={fadeUpItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">활동 로그</h1>
          <p className="text-muted-foreground text-sm mt-1">
            시스템 활동 내역을 확인합니다.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-lg">
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUpItem} className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[160px]" size="sm">
            <SelectValue placeholder="사용자" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 사용자</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[140px]" size="sm">
            <SelectValue placeholder="액션 타입" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 액션</SelectItem>
            <SelectItem value="insert">생성</SelectItem>
            <SelectItem value="update">수정</SelectItem>
            <SelectItem value="delete">삭제</SelectItem>
          </SelectContent>
        </Select>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, 'MM/dd', { locale: ko }) : '시작일'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground text-sm">~</span>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, 'MM/dd', { locale: ko }) : '종료일'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
            />
          </PopoverContent>
        </Popover>

        {(dateFrom || dateTo || userFilter !== 'all' || actionFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUserFilter('all');
              setActionFilter('all');
              setDateFrom(undefined);
              setDateTo(undefined);
            }}
          >
            필터 초기화
          </Button>
        )}
      </motion.div>

      {/* Log List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border rounded-lg gap-2">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <span className="text-lg">📋</span>
          </div>
          활동 로그가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log, idx) => {
            const user = log.user_id ? userMap.get(log.user_id) : null;
            const config = getActionConfig(log.action_type);
            const ActionIcon = config.icon;

            // Show date separator
            const currentDate = format(new Date(log.created_at), 'yyyy-MM-dd');
            const prevDate =
              idx > 0
                ? format(new Date(logs[idx - 1].created_at), 'yyyy-MM-dd')
                : null;
            const showDateHeader = currentDate !== prevDate;

            return (
              <div key={log.id}>
                {showDateHeader && (
                  <div className="flex items-center gap-3 pt-2 pb-1">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {format(new Date(log.created_at), 'yyyy년 M월 d일 (EEEE)', {
                        locale: ko,
                      })}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                )}

                <Card className="py-3">
                  <CardContent className="flex gap-3 px-4 py-0">
                    <div
                      className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-full shrink-0 mt-0.5',
                        config.className
                      )}
                    >
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {user?.name ?? '시스템'}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {config.label}
                        </Badge>
                        {log.target_table && (
                          <span className="text-xs text-muted-foreground">
                            {TABLE_LABELS[log.target_table] ?? log.target_table}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {format(new Date(log.created_at), 'HH:mm:ss')}
                        </span>
                      </div>
                      {log.target_id && (() => {
                        // Resolve target_id to human-readable name
                        let resolved: string | null = null;
                        if (log.target_table === 'campaigns') {
                          const c = campaignMap.get(log.target_id);
                          if (c) resolved = `${c.client_name} - ${c.campaign_name}`;
                        } else if (log.target_table === 'tasks') {
                          const t = taskMap.get(log.target_id);
                          if (t) resolved = t.task_name;
                        } else if (log.target_table === 'daily_checks' || log.target_table === 'campaign_task_config') {
                          // DiffDisplay already shows campaign/task names, skip redundant UUID
                          return null;
                        }
                        if (!resolved) return null;
                        return (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {resolved}
                          </p>
                        );
                      })()}
                      <DiffDisplay
                        oldValue={log.old_value}
                        newValue={log.new_value}
                        campaignMap={campaignMap}
                        taskMap={taskMap}
                        userMap={userMap}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? '로딩 중...' : '더 보기'}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center py-2">
            총 {logs.length}건 표시
          </p>
        </div>
      )}
    </motion.div>
  );
}
