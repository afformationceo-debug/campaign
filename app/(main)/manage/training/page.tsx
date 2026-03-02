'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Search,
  ListChecks,
  User as UserIcon,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/utils/query-keys';
import { CATEGORY_ORDER } from '@/lib/utils/category-colors';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useAuth } from '@/hooks/use-auth';
import { logActivity } from '@/lib/utils/log-activity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Task,
  User,
  TaskCategory,
  TaskTraining,
  TaskStep,
} from '@/lib/types/database';

export default function TrainingPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'trained' | 'untrained'>('all');

  // ── Data Fetching ──
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as User[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('loop_order');
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const { data: allSteps = [] } = useQuery({
    queryKey: ['taskSteps', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_steps')
        .select('*')
        .order('step_order');
      if (error) throw error;
      return (data ?? []) as TaskStep[];
    },
  });

  const { data: training = [], isLoading } = useQuery({
    queryKey: queryKeys.training.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('task_training').select('*');
      if (error) throw error;
      return (data ?? []) as TaskTraining[];
    },
  });

  // ── Mutations ──
  const toggleTrainedMutation = useMutation({
    mutationFn: async ({
      taskId,
      userId,
      isTrained,
      stepsConfirmed,
    }: {
      taskId: string;
      userId: string;
      isTrained: boolean;
      stepsConfirmed: boolean;
    }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('task_training')
        .upsert(
          {
            task_id: taskId,
            user_id: userId,
            is_trained: isTrained,
            trained_at: isTrained ? now : null,
            trainer_id: isTrained ? profile?.id : null,
            steps_confirmed: stepsConfirmed,
            updated_at: now,
          },
          { onConflict: 'task_id,user_id' }
        );
      if (error) throw error;
      logActivity({
        userId: profile?.id,
        actionType: 'upsert',
        targetTable: 'task_training',
        newValue: { task_id: taskId, user_id: userId, is_trained: isTrained },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.training.all });
    },
  });

  // ── Derived data ──
  const parentTasks = useMemo(() => {
    return tasks.filter((t) => !t.parent_task_id && (t.frequency === 'daily' || t.frequency === 'weekly'));
  }, [tasks]);

  const stepsMap = useMemo(() => {
    const map = new Map<string, TaskStep[]>();
    for (const step of allSteps) {
      if (!map.has(step.task_id)) map.set(step.task_id, []);
      map.get(step.task_id)!.push(step);
    }
    return map;
  }, [allSteps]);

  const trainingMap = useMemo(() => {
    const map = new Map<string, TaskTraining>();
    for (const t of training) {
      map.set(`${t.task_id}:${t.user_id}`, t);
    }
    return map;
  }, [training]);

  // ── Filter ──
  const filteredTasks = useMemo(() => {
    let result = parentTasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.task_name.toLowerCase().includes(q));
    }
    return result;
  }, [parentTasks, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (filterUser === 'all') return users;
    return users.filter((u) => u.id === filterUser);
  }, [users, filterUser]);

  // ── Overall stats ──
  const stats = useMemo(() => {
    let totalPairs = 0;
    let trainedPairs = 0;
    let stepsConfirmedPairs = 0;

    for (const task of parentTasks) {
      for (const user of users) {
        const assignees = task.default_assignees ?? [];
        if (!assignees.includes(user.name)) continue;

        totalPairs++;
        const record = trainingMap.get(`${task.id}:${user.id}`);
        if (record?.is_trained) trainedPairs++;
        if (record?.steps_confirmed) stepsConfirmedPairs++;
      }
    }

    const pct = totalPairs > 0 ? Math.round((trainedPairs / totalPairs) * 100) : 0;
    return { totalPairs, trainedPairs, stepsConfirmedPairs, pct };
  }, [parentTasks, users, trainingMap]);

  // Group tasks by category
  const grouped = useMemo(() => {
    const result: { category: TaskCategory; tasks: Task[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const catTasks = filteredTasks.filter((t) => t.category === cat);
      if (catTasks.length > 0) {
        result.push({ category: cat, tasks: catTasks });
      }
    }
    return result;
  }, [filteredTasks]);

  // ── Auth guard ──
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
    <TooltipProvider>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {/* Header */}
        <motion.div variants={fadeUpItem}>
          <h1 className="text-2xl font-black tracking-tight">교육 이수 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            담당자별 업무 교육 완료 여부와 Step 확인 상태를 관리합니다.
          </p>
        </motion.div>

        {/* AI Guide */}
        <motion.div variants={fadeUpItem}>
          <div className="relative rounded-xl border border-border bg-secondary/50 px-4 py-3.5 overflow-hidden">
            <div className="flex gap-3 items-start relative">
              <div className="relative shrink-0 mt-0.5">
                <div className="size-9 rounded-full bg-foreground flex items-center justify-center ring-2 ring-background">
                  <Bot className="size-4 text-background" />
                </div>
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold text-foreground">어포메이션 본질 AI Agent</p>
                  <span className="text-[9px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">교육관리 가이드</span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-[1.7]">
                  <div className="bg-background/60 dark:bg-background/30 rounded-lg px-3 py-2 space-y-0.5 border border-border">
                    <p><strong className="text-foreground">교육 완료</strong>를 토글하면 해당 담당자가 업무를 이해하고 수행할 준비가 되었음을 기록합니다.</p>
                    <p><strong className="text-foreground">Step 확인</strong>은 업무의 단계가 명확한지, 담당자가 각 Step을 숙지했는지 체크합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats + Filters */}
        <motion.div variants={fadeUpItem} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-full px-3 py-1.5">
            <GraduationCap className="size-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">교육 완료율</span>
            <span className={cn(
              'text-[11px] font-bold',
              stats.pct >= 80 ? 'text-emerald-500' : stats.pct >= 50 ? 'text-amber-500' : 'text-destructive'
            )}>
              {stats.trainedPairs}/{stats.totalPairs} ({stats.pct}%)
            </span>
          </div>

          <Input
            placeholder="업무 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[200px] h-8"
          />

          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[140px] h-8 text-[11px]">
              <SelectValue placeholder="담당자" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 담당자</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v: 'all' | 'trained' | 'untrained') => setFilterStatus(v)}>
            <SelectTrigger className="w-[120px] h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="trained">교육 완료</SelectItem>
              <SelectItem value="untrained">미교육</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Matrix */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="size-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ category, tasks: catTasks }) => (
              <div key={category} className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-secondary/40 border-b flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-semibold">
                    {category}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{catTasks.length}개 업무</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b bg-secondary/20">
                        <th className="px-3 py-2 text-[9px] font-semibold text-muted-foreground min-w-[200px]">업무</th>
                        <th className="px-3 py-2 text-[9px] font-semibold text-muted-foreground w-[60px] text-center whitespace-nowrap">Steps</th>
                        {filteredUsers.map((u) => (
                          <th key={u.id} className="px-2 py-2 text-[9px] font-semibold text-muted-foreground text-center min-w-[90px]">
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{u.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {catTasks.map((task) => {
                        const taskSteps = stepsMap.get(task.id) ?? [];
                        const assignees = task.default_assignees ?? [];

                        return (
                          <tr key={task.id} className="border-b hover:bg-secondary/10 transition-colors">
                            <td className="px-3 py-2">
                              <div>
                                <span className="text-[11px] font-medium">{task.task_name}</span>
                                {task.description && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {taskSteps.length > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 cursor-help">
                                      <ListChecks className="size-2.5 mr-0.5" />
                                      {taskSteps.length}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[250px]">
                                    <p className="font-medium text-xs mb-1">업무 단계</p>
                                    <ol className="text-[10px] space-y-0.5 list-decimal list-inside">
                                      {taskSteps.map((s) => (
                                        <li key={s.id}>{s.step_name}</li>
                                      ))}
                                    </ol>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-[9px] text-muted-foreground/40">-</span>
                              )}
                            </td>
                            {filteredUsers.map((user) => {
                              const isAssigned = assignees.includes(user.name);
                              if (!isAssigned) {
                                return (
                                  <td key={user.id} className="px-2 py-2 text-center">
                                    <span className="text-[9px] text-muted-foreground/30">-</span>
                                  </td>
                                );
                              }

                              const record = trainingMap.get(`${task.id}:${user.id}`);
                              const isTrained = record?.is_trained ?? false;
                              const stepsConfirmed = record?.steps_confirmed ?? false;

                              // Filter check
                              if (filterStatus === 'trained' && !isTrained) return (
                                <td key={user.id} className="px-2 py-2 text-center">
                                  <span className="text-[9px] text-muted-foreground/30">-</span>
                                </td>
                              );
                              if (filterStatus === 'untrained' && isTrained) return (
                                <td key={user.id} className="px-2 py-2 text-center">
                                  <span className="text-[9px] text-muted-foreground/30">-</span>
                                </td>
                              );

                              return (
                                <td key={user.id} className="px-2 py-2">
                                  <div className="flex flex-col items-center gap-1">
                                    {/* Trained toggle */}
                                    <div className="flex items-center gap-1">
                                      <Switch
                                        size="sm"
                                        checked={isTrained}
                                        onCheckedChange={(checked) =>
                                          toggleTrainedMutation.mutate({
                                            taskId: task.id,
                                            userId: user.id,
                                            isTrained: checked,
                                            stepsConfirmed: checked ? stepsConfirmed : false,
                                          })
                                        }
                                      />
                                      <span className={cn(
                                        'text-[8px]',
                                        isTrained ? 'text-emerald-500' : 'text-muted-foreground'
                                      )}>
                                        {isTrained ? '완료' : '미교육'}
                                      </span>
                                    </div>
                                    {/* Steps confirmed */}
                                    {taskSteps.length > 0 && isTrained && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleTrainedMutation.mutate({
                                            taskId: task.id,
                                            userId: user.id,
                                            isTrained: true,
                                            stepsConfirmed: !stepsConfirmed,
                                          })
                                        }
                                        className={cn(
                                          'flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full transition-colors',
                                          stepsConfirmed
                                            ? 'bg-emerald-500/10 text-emerald-600'
                                            : 'bg-amber-500/10 text-amber-600'
                                        )}
                                      >
                                        {stepsConfirmed ? (
                                          <CheckCircle2 className="size-2.5" />
                                        ) : (
                                          <AlertTriangle className="size-2.5" />
                                        )}
                                        Step {stepsConfirmed ? '확인' : '미확인'}
                                      </button>
                                    )}
                                    {/* Trained date */}
                                    {record?.trained_at && (
                                      <span className="text-[7px] text-muted-foreground/50">
                                        {format(new Date(record.trained_at), 'M/d')}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {grouped.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <GraduationCap className="size-8 opacity-20" />
                <span className="text-sm">검색 결과가 없습니다.</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
