'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle2, Clock, Circle, Minus, User, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { STATUS_COLORS, getNextStatus } from '@/lib/utils/status-colors';
import { useUpdateCheckStatus, useCreateCheck } from '@/hooks/use-update-check-status';
import { useAuth } from '@/hooks/use-auth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '@/lib/utils/category-colors';
import type {
  Campaign,
  Task,
  DailyCheck,
  CampaignTaskConfig,
  CheckStatus,
  TaskCategory,
  User as UserType,
} from '@/lib/types/database';

interface CampaignDetailPanelProps {
  campaignId: string | null;
  date: string;
  onClose: () => void;
}

const STATUS_ICONS: Record<CheckStatus, React.ElementType> = {
  '완료': CheckCircle2,
  '진행중': Clock,
  '미완료': Circle,
  '해당없음': Minus,
};

const STATUS_LABELS: Record<CheckStatus, string> = {
  '완료': '완료',
  '진행중': '진행중',
  '미완료': '미완료',
  '해당없음': '해당없음',
};

// ─── Interactive Status Button ──────────────────────────
function InteractiveStatusCell({
  check,
  isApplicable,
  campaignId,
  taskId,
  date,
  assigneeId,
}: {
  check: DailyCheck | null;
  isApplicable: boolean;
  campaignId: string;
  taskId: string;
  date: string;
  assigneeId: string;
}) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();

  const handleClick = useCallback(() => {
    if (!isApplicable) return;
    if (!check) {
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '진행중',
      });
      return;
    }
    const nextStatus = getNextStatus(check.status);
    updateStatus({ id: check.id, status: nextStatus });
  }, [check, isApplicable, updateStatus, createCheck, campaignId, taskId, date, assigneeId]);

  if (!isApplicable) {
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted/40 cursor-not-allowed">
        <Minus className="size-3 text-muted-foreground/30" />
      </div>
    );
  }

  if (!check) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-md',
          'border border-dashed border-muted-foreground/20',
          'text-muted-foreground/30',
          'hover:border-primary/40 hover:text-primary/60 hover:bg-primary/5',
          'transition-all duration-200 cursor-pointer hover:scale-110'
        )}
        aria-label="클릭하여 체크 시작"
      >
        <Circle className="size-3" />
      </button>
    );
  }

  const status = check.status;
  const colors = STATUS_COLORS[status];
  const Icon = STATUS_ICONS[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-md',
            'transition-all duration-200 cursor-pointer',
            'hover:scale-110 hover:shadow-md active:scale-95',
            colors.bg, colors.darkBg, colors.text,
            check.note && 'ring-1 ring-offset-1',
            check.note && colors.ring
          )}
          aria-label={`상태: ${STATUS_LABELS[status]}`}
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <p className="font-medium">{STATUS_LABELS[status]}</p>
        <p className="text-[10px] opacity-70">클릭하여 상태 변경</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Note Editor Popover ────────────────────────────────
function NoteEditor({
  check,
  taskName,
  campaignId,
  taskId,
  date,
  assigneeId,
}: {
  check: DailyCheck | null;
  taskName: string;
  campaignId: string;
  taskId: string;
  date: string;
  assigneeId: string;
}) {
  const { mutate: updateStatus } = useUpdateCheckStatus();
  const { mutate: createCheck } = useCreateCheck();
  const [open, setOpen] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNoteValue(check?.note ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, check]);

  const handleSave = () => {
    if (check) {
      updateStatus({ id: check.id, status: check.status, note: noteValue });
    } else if (noteValue.trim()) {
      // Create a new check with the note
      createCheck({
        campaign_id: campaignId,
        task_id: taskId,
        check_date: date,
        assigned_user_id: assigneeId,
        status: '진행중',
        note: noteValue,
      });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={check?.note ? 'default' : 'outline'}
          size="xs"
          className={cn(
            'h-6 px-2 text-[10px] rounded-md gap-1',
            check?.note
              ? 'bg-primary/90 hover:bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="size-3" />
          {check?.note ? '결과보기' : '결과값넣기'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" side="left" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{taskName}</p>
          <Input
            ref={inputRef}
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="메모 또는 결과값 입력..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>취소</Button>
            <Button size="xs" onClick={handleSave}>저장</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ─────────────────────────────────────

export function CampaignDetailPanel({
  campaignId,
  date,
  onClose,
}: CampaignDetailPanelProps) {
  const supabase = createClient();
  const isOpen = campaignId !== null;
  const { profile } = useAuth();

  // Fetch campaign detail
  const { data: campaign } = useQuery({
    queryKey: queryKeys.campaigns.detail(campaignId ?? ''),
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    enabled: !!campaignId,
  });

  // Fetch all tasks
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('loop_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  // Fetch checks for campaign + date
  const { data: checks = [] } = useQuery({
    queryKey: queryKeys.checks.byDate(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .eq('check_date', date);
      if (error) throw error;
      return (data ?? []) as DailyCheck[];
    },
  });

  // Fetch task configs for this campaign
  const { data: taskConfigs = [] } = useQuery({
    queryKey: queryKeys.taskConfig.byCampaign(campaignId ?? ''),
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('campaign_task_config')
        .select('*')
        .eq('campaign_id', campaignId);
      if (error) throw error;
      return (data ?? []) as CampaignTaskConfig[];
    },
    enabled: !!campaignId,
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return (data ?? []) as UserType[];
    },
  });

  const currentUserId = profile?.id ?? '';

  // Build lookups
  const configMap = useMemo(() => {
    const map = new Map<string, CampaignTaskConfig>();
    taskConfigs.forEach((config) => map.set(config.task_id, config));
    return map;
  }, [taskConfigs]);

  const checkMap = useMemo(() => {
    const map = new Map<string, DailyCheck>();
    if (!campaignId) return map;
    checks
      .filter((c) => c.campaign_id === campaignId && c.assigned_user_id === currentUserId)
      .forEach((check) => map.set(check.task_id, check));
    return map;
  }, [checks, campaignId, currentUserId]);

  const userMap = useMemo(() => {
    const map = new Map<string, UserType>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  // Group tasks by category
  const taskGroups = useMemo(() => {
    const groups: { category: TaskCategory; tasks: Task[] }[] = [];
    for (const category of CATEGORY_ORDER) {
      const catTasks = tasks.filter((t) => t.category === category);
      if (catTasks.length > 0) {
        groups.push({ category, tasks: catTasks });
      }
    }
    return groups;
  }, [tasks]);

  // Stats
  const stats = useMemo(() => {
    let applicable = 0;
    let completed = 0;
    tasks.forEach((task) => {
      const config = configMap.get(task.id);
      const isApplicable = config ? config.is_applicable : task.is_applicable_default;
      if (isApplicable) {
        applicable++;
        const check = checkMap.get(task.id);
        if (check?.status === '완료') completed++;
      }
    });
    return { applicable, completed };
  }, [tasks, configMap, checkMap]);

  const completionPct =
    stats.applicable > 0
      ? Math.round((stats.completed / stats.applicable) * 100)
      : 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl overflow-hidden"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">
            {campaign
              ? `${campaign.client_name} - ${campaign.campaign_name}`
              : '캠페인 상세'}
          </SheetTitle>
          <SheetDescription>
            {format(new Date(date), 'yyyy년 M월 d일 (EEE)', { locale: ko })} 기준 업무 현황
          </SheetDescription>
          {campaign && (
            <div className="flex items-center gap-2 mt-1">
              {campaign.target_country && (
                <Badge variant="secondary" className="text-xs">
                  {campaign.target_country}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  campaign.status === 'active' && 'border-emerald-300 text-emerald-600',
                  campaign.status === 'paused' && 'border-amber-300 text-amber-600',
                  campaign.status === 'completed' && 'border-gray-300 text-gray-500'
                )}
              >
                {campaign.status}
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs font-semibold',
                  completionPct === 100 && 'bg-emerald-100 text-emerald-700',
                  completionPct > 0 && completionPct < 100 && 'bg-amber-100 text-amber-700',
                  completionPct === 0 && 'bg-gray-100 text-gray-500'
                )}
              >
                {stats.completed}/{stats.applicable} ({completionPct}%)
              </Badge>
            </div>
          )}
        </SheetHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto -mx-4 px-4 min-h-0">
          <div className="space-y-4 pb-6">
            {taskGroups.map((group) => {
              const catColors = CATEGORY_COLORS[group.category];

              return (
                <div key={group.category}>
                  {/* Category Header */}
                  <div
                    className={cn(
                      'sticky top-0 z-10 px-3 py-1.5 rounded-md mb-2',
                      'text-xs font-semibold',
                      catColors.bg, catColors.darkBg, catColors.text
                    )}
                  >
                    {group.category}
                  </div>

                  {/* Task Items */}
                  <div className="space-y-1">
                    {group.tasks.map((task) => {
                      const config = configMap.get(task.id);
                      const isApplicable = config
                        ? config.is_applicable
                        : task.is_applicable_default;
                      const check = checkMap.get(task.id);
                      const assignee = check?.assigned_user_id
                        ? userMap.get(check.assigned_user_id)
                        : null;

                      if (!isApplicable) {
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 opacity-50"
                          >
                            <Minus className="size-4 text-gray-400 shrink-0" />
                            <span className="text-xs text-muted-foreground line-through">
                              {task.task_name}
                            </span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">
                              해당없음
                            </Badge>
                          </div>
                        );
                      }

                      const status: CheckStatus = check?.status ?? '미완료';
                      const statusColors = STATUS_COLORS[status];

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md',
                            'hover:bg-muted/40 transition-colors group'
                          )}
                        >
                          {/* Clickable Status Icon */}
                          <InteractiveStatusCell
                            check={check ?? null}
                            isApplicable={isApplicable}
                            campaignId={campaignId!}
                            taskId={task.id}
                            date={date}
                            assigneeId={currentUserId}
                          />

                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground truncate">
                                {task.task_name}
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[9px] px-1 py-0 shrink-0',
                                  statusColors.bg, statusColors.darkBg, statusColors.text
                                )}
                              >
                                {status}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 mt-1">
                              {assignee && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <User className="size-2.5" />
                                  <span>{assignee.name}</span>
                                </div>
                              )}
                              {check?.completed_at && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Clock className="size-2.5" />
                                  <span>{format(new Date(check.completed_at), 'HH:mm')}</span>
                                </div>
                              )}
                            </div>

                            {/* Note display */}
                            {check?.note && (
                              <div className="flex items-start gap-1 mt-1.5 text-[10px] text-muted-foreground">
                                <FileText className="size-2.5 mt-0.5 shrink-0" />
                                <span className="break-words">{check.note}</span>
                              </div>
                            )}
                          </div>

                          {/* Note/Result editor button - always visible */}
                          <div className="shrink-0">
                            <NoteEditor
                              check={check ?? null}
                              taskName={task.task_name}
                              campaignId={campaignId!}
                              taskId={task.id}
                              date={date}
                              assigneeId={currentUserId}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
