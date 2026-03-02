import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDailyCheckRecords,
  excludeExistingDailyCheckRecords,
  getSeoulDateContext,
} from './daily-check-generation.ts';

test('buildDailyCheckRecords includes campaign tasks that are default-applicable without explicit config rows', () => {
  const records = buildDailyCheckRecords({
    today: '2026-03-03',
    dayOfWeek: 2,
    campaigns: [
      { id: 'campaign-a', status: 'active' },
      { id: 'campaign-b', status: 'active' },
    ],
    tasks: [
      {
        id: 'task-default-on',
        frequency: 'daily',
        day_of_week: null,
        scope: 'campaign',
        parent_task_id: null,
        is_applicable_default: true,
      },
      {
        id: 'task-default-off',
        frequency: 'daily',
        day_of_week: null,
        scope: 'campaign',
        parent_task_id: null,
        is_applicable_default: false,
      },
      {
        id: 'task-global',
        frequency: 'daily',
        day_of_week: null,
        scope: 'global',
        parent_task_id: null,
        is_applicable_default: true,
      },
      {
        id: 'task-child',
        frequency: 'daily',
        day_of_week: null,
        scope: 'campaign',
        parent_task_id: 'task-default-on',
        is_applicable_default: true,
      },
    ],
    configs: [],
  });

  assert.deepEqual(records, [
    {
      campaign_id: 'campaign-a',
      task_id: 'task-default-on',
      check_date: '2026-03-03',
      status: '미완료',
    },
    {
      campaign_id: 'campaign-b',
      task_id: 'task-default-on',
      check_date: '2026-03-03',
      status: '미완료',
    },
  ]);
});

test('buildDailyCheckRecords respects explicit campaign config overrides and weekly schedule', () => {
  const records = buildDailyCheckRecords({
    today: '2026-03-03',
    dayOfWeek: 2,
    campaigns: [
      { id: 'campaign-a', status: 'active' },
      { id: 'campaign-b', status: 'active' },
      { id: 'campaign-c', status: 'paused' },
    ],
    tasks: [
      {
        id: 'task-weekly',
        frequency: 'weekly',
        day_of_week: [2],
        scope: 'campaign',
        parent_task_id: null,
        is_applicable_default: false,
      },
      {
        id: 'task-monthly',
        frequency: 'monthly',
        day_of_week: null,
        scope: 'campaign',
        parent_task_id: null,
        is_applicable_default: true,
      },
    ],
    configs: [
      { campaign_id: 'campaign-a', task_id: 'task-weekly', is_applicable: true },
      { campaign_id: 'campaign-b', task_id: 'task-weekly', is_applicable: false },
      { campaign_id: 'campaign-a', task_id: 'task-monthly', is_applicable: false },
    ],
    currentDayOfMonth: 1,
  });

  assert.deepEqual(records, [
    {
      campaign_id: 'campaign-a',
      task_id: 'task-weekly',
      check_date: '2026-03-03',
      status: '미완료',
    },
    {
      campaign_id: 'campaign-b',
      task_id: 'task-monthly',
      check_date: '2026-03-03',
      status: '미완료',
    },
  ]);
});

test('getSeoulDateContext uses Asia/Seoul day and date instead of UTC', () => {
  const context = getSeoulDateContext(new Date('2026-03-02T16:59:00.000Z'));
  assert.deepEqual(context, {
    today: '2026-03-03',
    dayOfWeek: 2,
    currentDayOfMonth: 3,
  });
});

test('excludeExistingDailyCheckRecords keeps only records that do not already exist', () => {
  const records = [
    { campaign_id: 'campaign-a', task_id: 'task-1', check_date: '2026-03-03', status: '미완료' as const },
    { campaign_id: 'campaign-a', task_id: 'task-2', check_date: '2026-03-03', status: '미완료' as const },
    { campaign_id: 'campaign-b', task_id: 'task-1', check_date: '2026-03-03', status: '미완료' as const },
  ];

  const filtered = excludeExistingDailyCheckRecords(records, [
    { campaign_id: 'campaign-a', task_id: 'task-2', check_date: '2026-03-03' },
    { campaign_id: null, task_id: 'task-1', check_date: '2026-03-03' },
  ]);

  assert.deepEqual(filtered, [
    { campaign_id: 'campaign-a', task_id: 'task-1', check_date: '2026-03-03', status: '미완료' },
    { campaign_id: 'campaign-b', task_id: 'task-1', check_date: '2026-03-03', status: '미완료' },
  ]);
});
