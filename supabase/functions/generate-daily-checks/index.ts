import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildDailyCheckRecords,
  excludeExistingDailyCheckRecords,
  getSeoulDateContext,
} from '../../../lib/tasks/daily-check-generation.ts';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const { today, dayOfWeek, currentDayOfMonth } = getSeoulDateContext(now);

  // 1. active 캠페인 조회
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id,status')
    .eq('status', 'active');
  if (campaignsError) {
    return new Response(
      JSON.stringify({
        success: false,
        date: today,
        records_attempted: 0,
        records_inserted: 0,
        error: campaignsError.message,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. 전체 Task 조회
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, frequency, day_of_week, scope, parent_task_id, is_applicable_default');
  if (tasksError) {
    return new Response(
      JSON.stringify({
        success: false,
        date: today,
        records_attempted: 0,
        records_inserted: 0,
        error: tasksError.message,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. 캠페인별 적용 Task 조회 (range to bypass 1000 row limit)
  const { data: configs, error: configsError } = await supabase
    .from('campaign_task_config')
    .select('campaign_id, task_id, is_applicable')
    .range(0, 4999);
  if (configsError) {
    return new Response(
      JSON.stringify({
        success: false,
        date: today,
        records_attempted: 0,
        records_inserted: 0,
        error: configsError.message,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const records = buildDailyCheckRecords({
    today,
    dayOfWeek,
    currentDayOfMonth,
    campaigns: campaigns ?? [],
    tasks: tasks ?? [],
    configs: configs ?? [],
  });

  if (records.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        records_attempted: 0,
        records_inserted: 0,
        error: null,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const campaignIds = [...new Set(records.map((record) => record.campaign_id))];
  const taskIds = [...new Set(records.map((record) => record.task_id))];

  const { data: existingRows, error: existingError } = await supabase
    .from('daily_checks')
    .select('campaign_id, task_id, check_date')
    .eq('check_date', today)
    .in('campaign_id', campaignIds)
    .in('task_id', taskIds);

  if (existingError) {
    return new Response(
      JSON.stringify({
        success: false,
        date: today,
        records_attempted: records.length,
        records_inserted: 0,
        error: existingError.message,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const recordsToInsert = excludeExistingDailyCheckRecords(records, existingRows ?? []);
  let insertError: { message?: string } | null = null;

  if (recordsToInsert.length > 0) {
    const { error } = await supabase.from('daily_checks').insert(recordsToInsert);
    insertError = error;
  }

  return new Response(
    JSON.stringify({
      success: !insertError,
      date: today,
      records_attempted: records.length,
      records_inserted: recordsToInsert.length,
      error: insertError?.message,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
