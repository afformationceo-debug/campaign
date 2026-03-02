import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDailyReportInsights,
  buildUserDailyReportItems,
} from './report-insights.ts';
import type {
  Campaign,
  CampaignTaskConfig,
  DailyCheck,
  StepCheck,
  Task,
  TaskStep,
  TaskTraining,
  User,
} from '../types/database.ts';

const user: User = {
  id: 'user-alice',
  name: 'Alice',
  role: 'member',
  position: 'AM',
  email: 'alice@example.com',
  avatar_url: null,
  is_active: true,
  created_at: '2026-03-03T00:00:00.000Z',
};

const campaigns: Campaign[] = [
  {
    id: 'campaign-alpha',
    client_name: 'Alpha Client',
    campaign_name: 'Alpha Launch',
    campaign_type: '해외마케팅',
    target_country: 'JP',
    status: 'active',
    phase: 'running',
    monthly_fixed_cost: null,
    cost_per_influencer: null,
    influencer_fee_budget: null,
    commission_rate: null,
    vat_type: null,
    interpreter_status: null,
    start_date: null,
    homepage_url: null,
    chatdoc_onboarding_done: null,
    chatdoc_roas_target: null,
    chatdoc_status: null,
    target_countries: null,
    product_category: null,
    brand_budget: null,
    brand_phase: null,
    created_at: '2026-03-03T00:00:00.000Z',
    updated_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'campaign-beta',
    client_name: 'Beta Client',
    campaign_name: 'Beta Retention',
    campaign_type: '국내챗닥',
    target_country: 'KR',
    status: 'active',
    phase: 'running',
    monthly_fixed_cost: null,
    cost_per_influencer: null,
    influencer_fee_budget: null,
    commission_rate: null,
    vat_type: null,
    interpreter_status: null,
    start_date: null,
    homepage_url: null,
    chatdoc_onboarding_done: null,
    chatdoc_roas_target: null,
    chatdoc_status: null,
    target_countries: null,
    product_category: null,
    brand_budget: null,
    brand_phase: null,
    created_at: '2026-03-03T00:00:00.000Z',
    updated_at: '2026-03-03T00:00:00.000Z',
  },
];

const tasks: Task[] = [
  {
    id: 'task-global-complete',
    loop_order: 1,
    task_name: '정산 공유',
    description: null,
    tool: null,
    category: '보고',
    default_assignees: ['Alice'],
    frequency: 'daily',
    day_of_week: null,
    is_applicable_default: true,
    scope: 'global',
    parent_task_id: null,
    sub_order: 0,
    priority: '보통',
    estimated_minutes: 20,
    instruction_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'task-campaign-complete',
    loop_order: 2,
    task_name: '광고 세팅 QA',
    description: null,
    tool: null,
    category: '영업',
    default_assignees: ['Alice'],
    frequency: 'daily',
    day_of_week: null,
    is_applicable_default: true,
    scope: 'campaign',
    parent_task_id: null,
    sub_order: 0,
    priority: '보통',
    estimated_minutes: 30,
    instruction_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'task-campaign-progress',
    loop_order: 3,
    task_name: '고객 피드백 반영',
    description: null,
    tool: null,
    category: 'CS-고객',
    default_assignees: ['Bob'],
    frequency: 'daily',
    day_of_week: null,
    is_applicable_default: true,
    scope: 'campaign',
    parent_task_id: null,
    sub_order: 0,
    priority: '높음',
    estimated_minutes: 40,
    instruction_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'task-global-pending',
    loop_order: 4,
    task_name: 'CRM 세그먼트 점검',
    description: null,
    tool: null,
    category: 'CRM',
    default_assignees: ['Alice'],
    frequency: 'daily',
    day_of_week: null,
    is_applicable_default: true,
    scope: 'global',
    parent_task_id: null,
    sub_order: 0,
    priority: '보통',
    estimated_minutes: 15,
    instruction_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'task-skipped',
    loop_order: 5,
    task_name: '숨김 업무',
    description: null,
    tool: null,
    category: '컨텐츠',
    default_assignees: ['Alice'],
    frequency: 'daily',
    day_of_week: null,
    is_applicable_default: true,
    scope: 'campaign',
    parent_task_id: null,
    sub_order: 0,
    priority: '보통',
    estimated_minutes: 10,
    instruction_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
];

const taskConfigs: CampaignTaskConfig[] = [
  {
    id: 'cfg-alpha-complete',
    campaign_id: 'campaign-alpha',
    task_id: 'task-campaign-complete',
    is_applicable: true,
    override_assignee: null,
    note: null,
    target_count: null,
    created_at: '2026-03-03T00:00:00.000Z',
    updated_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'cfg-beta-progress',
    campaign_id: 'campaign-beta',
    task_id: 'task-campaign-progress',
    is_applicable: true,
    override_assignee: 'Alice',
    note: null,
    target_count: null,
    created_at: '2026-03-03T00:00:00.000Z',
    updated_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'cfg-skip',
    campaign_id: 'campaign-alpha',
    task_id: 'task-skipped',
    is_applicable: false,
    override_assignee: null,
    note: null,
    target_count: null,
    created_at: '2026-03-03T00:00:00.000Z',
    updated_at: '2026-03-03T00:00:00.000Z',
  },
];

const checks: DailyCheck[] = [
  {
    id: 'check-global-complete',
    campaign_id: null,
    task_id: 'task-global-complete',
    check_date: '2026-03-03',
    status: '완료',
    assigned_user_id: 'user-alice',
    note: null,
    result_value: '정산표 공유 및 팀 채널 공지',
    started_at: '2026-03-03T00:00:00.000Z',
    completed_at: '2026-03-03T00:30:00.000Z',
    created_at: '2026-03-03T00:00:00.000Z',
    updated_at: '2026-03-03T00:30:00.000Z',
  },
  {
    id: 'check-campaign-complete',
    campaign_id: 'campaign-alpha',
    task_id: 'task-campaign-complete',
    check_date: '2026-03-03',
    status: '완료',
    assigned_user_id: 'user-alice',
    note: null,
    result_value: null,
    started_at: '2026-03-03T01:00:00.000Z',
    completed_at: '2026-03-03T01:20:00.000Z',
    created_at: '2026-03-03T01:00:00.000Z',
    updated_at: '2026-03-03T01:20:00.000Z',
  },
  {
    id: 'check-campaign-progress',
    campaign_id: 'campaign-beta',
    task_id: 'task-campaign-progress',
    check_date: '2026-03-03',
    status: '진행중',
    assigned_user_id: 'user-alice',
    note: null,
    result_value: '고객 검토 회신 대기',
    started_at: '2026-03-03T02:00:00.000Z',
    completed_at: null,
    created_at: '2026-03-03T02:00:00.000Z',
    updated_at: '2026-03-03T02:10:00.000Z',
  },
];

const steps: TaskStep[] = [
  {
    id: 'step-alpha-1',
    task_id: 'task-campaign-complete',
    step_order: 1,
    step_name: '세팅 확인',
    step_description: null,
    tool_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'step-alpha-2',
    task_id: 'task-campaign-complete',
    step_order: 2,
    step_name: '보고',
    step_description: null,
    tool_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'step-beta-1',
    task_id: 'task-campaign-progress',
    step_order: 1,
    step_name: '피드백 수집',
    step_description: null,
    tool_url: null,
    created_at: '2026-03-03T00:00:00.000Z',
  },
];

const stepChecks: StepCheck[] = [
  {
    id: 'step-check-alpha-1',
    daily_check_id: 'check-campaign-complete',
    step_id: 'step-alpha-1',
    is_completed: true,
    result_value: '세팅 검수 완료',
    completed_at: '2026-03-03T01:10:00.000Z',
    created_at: '2026-03-03T01:10:00.000Z',
  },
];

const training: TaskTraining[] = [
  {
    id: 'training-global-complete',
    task_id: 'task-global-complete',
    user_id: 'user-alice',
    is_trained: true,
    trained_at: '2026-03-01T00:00:00.000Z',
    trainer_id: null,
    steps_confirmed: true,
    note: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'training-campaign-complete',
    task_id: 'task-campaign-complete',
    user_id: 'user-alice',
    is_trained: true,
    trained_at: '2026-03-01T00:00:00.000Z',
    trainer_id: null,
    steps_confirmed: true,
    note: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'training-campaign-progress',
    task_id: 'task-campaign-progress',
    user_id: 'user-alice',
    is_trained: true,
    trained_at: '2026-03-01T00:00:00.000Z',
    trainer_id: null,
    steps_confirmed: true,
    note: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  },
];

test('buildUserDailyReportItems includes assigned tasks and campaign overrides', () => {
  const items = buildUserDailyReportItems({
    user,
    tasks,
    checks,
    campaigns,
    taskConfigs,
    steps,
    stepChecks,
    training,
  });

  assert.equal(items.length, 4);
  assert.deepEqual(
    items.map((item) => ({
      taskId: item.task.id,
      campaignId: item.campaign?.id ?? null,
      status: item.check?.status ?? '미완료',
    })),
    [
      { taskId: 'task-global-complete', campaignId: null, status: '완료' },
      { taskId: 'task-global-pending', campaignId: null, status: '미완료' },
      { taskId: 'task-campaign-complete', campaignId: 'campaign-alpha', status: '완료' },
      { taskId: 'task-campaign-progress', campaignId: 'campaign-beta', status: '진행중' },
    ]
  );
});

test('buildDailyReportInsights prioritizes outcome-backed work and attention items', () => {
  const items = buildUserDailyReportItems({
    user,
    tasks,
    checks,
    campaigns,
    taskConfigs,
    steps,
    stepChecks,
    training,
  });

  const insights = buildDailyReportInsights(items);

  assert.equal(insights.completedTasks, 2);
  assert.equal(insights.inProgressTasks, 1);
  assert.equal(insights.pendingTasks, 1);
  assert.equal(insights.resultValueCount, 2);
  assert.equal(insights.completedStepCount, 1);
  assert.equal(insights.totalStepCount, 3);
  assert.equal(insights.activeCampaignCount, 2);

  assert.deepEqual(
    insights.highlightEntries.map((entry) => entry.taskId),
    ['task-global-complete', 'task-campaign-progress', 'task-campaign-complete']
  );

  assert.deepEqual(
    insights.attentionEntries.map((entry) => entry.taskId),
    ['task-campaign-progress', 'task-global-pending']
  );

  assert.equal(insights.headline, '완료 2건 · 결과 근거 2건 · 후속 확인 2건');
});

test('buildUserDailyReportItems uses unclaimed campaign checks when assignee is responsible', () => {
  const items = buildUserDailyReportItems({
    user,
    tasks,
    checks: checks.map((check) =>
      check.id === 'check-campaign-progress'
        ? { ...check, assigned_user_id: null }
        : check
    ),
    campaigns,
    taskConfigs,
    steps,
    stepChecks,
    training,
  });

  const progressItem = items.find((item) => item.task.id === 'task-campaign-progress');
  assert.ok(progressItem);
  assert.equal(progressItem.check?.status, '진행중');
  assert.equal(progressItem.check?.assigned_user_id, null);
});

test('buildUserDailyReportItems does not attribute campaign checks owned by another user', () => {
  const items = buildUserDailyReportItems({
    user,
    tasks,
    checks: checks.map((check) =>
      check.id === 'check-campaign-progress'
        ? { ...check, assigned_user_id: 'user-bob' }
        : check
    ),
    campaigns,
    taskConfigs,
    steps,
    stepChecks,
    training,
  });

  const progressItem = items.find((item) => item.task.id === 'task-campaign-progress');
  assert.ok(progressItem);
  assert.equal(progressItem.check, null);
});
