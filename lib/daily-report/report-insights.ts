import type {
  Campaign,
  CampaignTaskConfig,
  CheckStatus,
  DailyCheck,
  Task,
  TaskCategory,
  TaskStep,
  TaskTraining,
  User,
  StepCheck,
} from '../types/database';

export interface DailyReportTaskItem {
  task: Task;
  campaign: Campaign | null;
  check: DailyCheck | null;
  taskSteps: TaskStep[];
  completedSteps: number;
  totalSteps: number;
  isTrained: boolean;
}

export interface DailyReportInsightEntry {
  taskId: string;
  taskName: string;
  campaignName: string;
  category: TaskCategory;
  status: CheckStatus | '미완료';
  resultValue: string | null;
  isTrained: boolean;
  stepProgressLabel: string | null;
  timeRangeLabel: string | null;
}

export interface DailyReportInsights {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  notTrainedCount: number;
  resultValueCount: number;
  completedStepCount: number;
  totalStepCount: number;
  activeCampaignCount: number;
  highlightEntries: DailyReportInsightEntry[];
  attentionEntries: DailyReportInsightEntry[];
  headline: string;
}

interface BuildUserDailyReportItemsInput {
  user: User;
  tasks: Task[];
  checks: DailyCheck[];
  campaigns: Campaign[];
  taskConfigs: CampaignTaskConfig[];
  steps: TaskStep[];
  stepChecks: StepCheck[];
  training: TaskTraining[];
}

const REPORT_FREQUENCIES = new Set(['daily', 'weekly']);

export function buildUserDailyReportItems({
  user,
  tasks,
  checks,
  campaigns,
  taskConfigs,
  steps,
  stepChecks,
  training,
}: BuildUserDailyReportItemsInput): DailyReportTaskItem[] {
  const configMap = new Map<string, CampaignTaskConfig>();
  taskConfigs.forEach((config) => {
    configMap.set(`${config.campaign_id}:${config.task_id}`, config);
  });

  const checkMap = new Map<string, DailyCheck>();
  checks.forEach((check) => {
    if (check.assigned_user_id !== user.id) return;
    const key = `${check.campaign_id ?? 'null'}:${check.task_id}`;
    checkMap.set(key, check);
  });

  const stepsByTaskId = new Map<string, TaskStep[]>();
  steps.forEach((step) => {
    const current = stepsByTaskId.get(step.task_id) ?? [];
    current.push(step);
    current.sort((left, right) => left.step_order - right.step_order);
    stepsByTaskId.set(step.task_id, current);
  });

  const completedStepCountByCheckId = new Map<string, number>();
  stepChecks.forEach((stepCheck) => {
    if (!stepCheck.is_completed) return;
    completedStepCountByCheckId.set(
      stepCheck.daily_check_id,
      (completedStepCountByCheckId.get(stepCheck.daily_check_id) ?? 0) + 1
    );
  });

  const trainedTaskIds = new Set(
    training
      .filter((record) => record.user_id === user.id && record.is_trained)
      .map((record) => record.task_id)
  );

  const buildItem = (task: Task, campaign: Campaign | null): DailyReportTaskItem => {
    const check = checkMap.get(`${campaign?.id ?? 'null'}:${task.id}`) ?? null;
    const taskSteps = stepsByTaskId.get(task.id) ?? [];
    return {
      task,
      campaign,
      check,
      taskSteps,
      completedSteps: check ? completedStepCountByCheckId.get(check.id) ?? 0 : 0,
      totalSteps: taskSteps.length,
      isTrained: trainedTaskIds.has(task.id),
    };
  };

  const dailyTasks = tasks.filter(
    (task) => !task.parent_task_id && REPORT_FREQUENCIES.has(task.frequency)
  );

  const items: DailyReportTaskItem[] = [];

  dailyTasks
    .filter((task) => task.scope === 'global')
    .forEach((task) => {
      const assignees = task.default_assignees ?? [];
      if (!assignees.includes(user.name)) return;
      items.push(buildItem(task, null));
    });

  dailyTasks
    .filter((task) => task.scope !== 'global')
    .forEach((task) => {
      campaigns.forEach((campaign) => {
        const config = configMap.get(`${campaign.id}:${task.id}`);
        const check = checkMap.get(`${campaign.id}:${task.id}`) ?? null;
        if (!config && !check) return;

        const isApplicable = config ? config.is_applicable : task.is_applicable_default;
        if (!isApplicable && !check) return;

        const assigneeName = config?.override_assignee ?? null;
        const assignees = assigneeName ? [assigneeName] : (task.default_assignees ?? []);
        if (!assignees.includes(user.name)) return;

        items.push(buildItem(task, campaign));
      });
    });

  return items;
}

export function buildDailyReportInsights(items: DailyReportTaskItem[]): DailyReportInsights {
  const totalTasks = items.length;
  const completedTasks = items.filter((item) => isCompletedStatus(item.check?.status)).length;
  const inProgressTasks = items.filter((item) => item.check?.status === '진행중').length;
  const pendingTasks = items.filter((item) => !item.check || item.check.status === '미완료').length;
  const notTrainedCount = items.filter((item) => !item.isTrained).length;
  const resultValueCount = items.filter((item) => hasText(item.check?.result_value)).length;
  const completedStepCount = items.reduce((sum, item) => sum + item.completedSteps, 0);
  const totalStepCount = items.reduce((sum, item) => sum + item.totalSteps, 0);
  const activeCampaignCount = new Set(
    items
      .filter((item) => item.campaign && (item.check?.status === '완료' || item.check?.status === '진행중'))
      .map((item) => item.campaign?.id)
  ).size;

  const highlightEntries = items
    .filter((item) => shouldHighlight(item))
    .sort((left, right) => compareHighlightPriority(left, right))
    .slice(0, 3)
    .map((item) => toInsightEntry(item));

  const attentionEntries = items
    .filter((item) => needsAttention(item))
    .sort((left, right) => compareAttentionPriority(left, right))
    .slice(0, 3)
    .map((item) => toInsightEntry(item));

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    notTrainedCount,
    resultValueCount,
    completedStepCount,
    totalStepCount,
    activeCampaignCount,
    highlightEntries,
    attentionEntries,
    headline: buildHeadline({ completedTasks, resultValueCount, followUpCount: inProgressTasks + pendingTasks }),
  };
}

function isCompletedStatus(status: CheckStatus | undefined): boolean {
  return status === '완료' || status === '해당없음';
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasOperationalEvidence(item: DailyReportTaskItem): boolean {
  return (
    hasText(item.check?.result_value) ||
    item.completedSteps > 0 ||
    Boolean(item.check?.completed_at) ||
    Boolean(item.check?.started_at)
  );
}

function shouldHighlight(item: DailyReportTaskItem): boolean {
  if (item.check?.status === '완료' || item.check?.status === '진행중') return true;
  return hasOperationalEvidence(item);
}

function needsAttention(item: DailyReportTaskItem): boolean {
  if (!item.check || item.check.status === '미완료') return true;
  if (item.check.status === '진행중') return true;
  return !item.isTrained;
}

function compareHighlightPriority(left: DailyReportTaskItem, right: DailyReportTaskItem): number {
  return compareNumbers(getHighlightPriority(right), getHighlightPriority(left)) ||
    compareNumbers(getEvidenceStrength(right), getEvidenceStrength(left)) ||
    compareNumbers(left.task.loop_order, right.task.loop_order);
}

function compareAttentionPriority(left: DailyReportTaskItem, right: DailyReportTaskItem): number {
  return compareNumbers(getAttentionPriority(right), getAttentionPriority(left)) ||
    compareNumbers(getEvidenceStrength(right), getEvidenceStrength(left)) ||
    compareNumbers(left.task.loop_order, right.task.loop_order);
}

function compareNumbers(left: number, right: number): number {
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function getHighlightPriority(item: DailyReportTaskItem): number {
  if (item.check?.status === '완료' && hasText(item.check.result_value)) return 5;
  if (item.check?.status === '진행중' && hasText(item.check.result_value)) return 4;
  if (item.check?.status === '완료' && item.completedSteps > 0) return 3;
  if (item.check?.status === '완료') return 2;
  if (item.check?.status === '진행중') return 1;
  return 0;
}

function getAttentionPriority(item: DailyReportTaskItem): number {
  if (item.check?.status === '진행중') return 4;
  if (!item.check || item.check.status === '미완료') return item.isTrained ? 2 : 3;
  if (!item.isTrained) return 1;
  return 0;
}

function getEvidenceStrength(item: DailyReportTaskItem): number {
  let score = 0;
  if (hasText(item.check?.result_value)) score += 3;
  if (item.completedSteps > 0) score += 2;
  if (item.check?.completed_at) score += 2;
  if (item.check?.started_at) score += 1;
  return score;
}

function toInsightEntry(item: DailyReportTaskItem): DailyReportInsightEntry {
  return {
    taskId: item.task.id,
    taskName: item.task.task_name,
    campaignName: item.campaign?.campaign_name ?? '전역 업무',
    category: item.task.category,
    status: item.check?.status ?? '미완료',
    resultValue: item.check?.result_value ?? null,
    isTrained: item.isTrained,
    stepProgressLabel: item.totalSteps > 0 ? `${item.completedSteps}/${item.totalSteps} Step` : null,
    timeRangeLabel: formatTimeRange(item.check?.started_at ?? null, item.check?.completed_at ?? null),
  };
}

function formatTimeRange(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt) return null;
  const start = formatClock(startedAt);
  if (!completedAt) return `${start}~`;
  return `${start}~${formatClock(completedAt)}`;
}

function formatClock(value: string): string {
  const date = new Date(value);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildHeadline({
  completedTasks,
  resultValueCount,
  followUpCount,
}: {
  completedTasks: number;
  resultValueCount: number;
  followUpCount: number;
}): string {
  return `완료 ${completedTasks}건 · 결과 근거 ${resultValueCount}건 · 후속 확인 ${followUpCount}건`;
}
