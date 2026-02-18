import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay(); // 0=일, 1=월, ...

  // 1. active 캠페인 조회
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 'active');

  // 2. 전체 Task 조회
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, frequency, day_of_week');

  // 3. 캠페인별 적용 Task 조회 (range to bypass 1000 row limit)
  const { data: configs } = await supabase
    .from('campaign_task_config')
    .select('campaign_id, task_id')
    .eq('is_applicable', true)
    .range(0, 4999);

  const applicableSet = new Set(
    configs?.map((c: { campaign_id: string; task_id: string }) => `${c.campaign_id}:${c.task_id}`) || []
  );

  // 4. 오늘 수행할 Task 필터링
  const todayTasks = tasks?.filter((t: { frequency: string; day_of_week: number[] | null }) => {
    switch (t.frequency) {
      case 'daily': return true;
      case 'weekly': return t.day_of_week?.includes(dayOfWeek);
      case 'monthly': return new Date().getDate() === 1;
      case 'once': return false; // once tasks are created manually via UI
      case 'as_needed': return false;
      default: return false;
    }
  }) || [];

  // 5. daily_checks INSERT (중복 무시)
  const records: { campaign_id: string; task_id: string; check_date: string; status: string }[] = [];
  for (const campaign of campaigns || []) {
    for (const task of todayTasks) {
      if (applicableSet.has(`${campaign.id}:${task.id}`)) {
        records.push({
          campaign_id: campaign.id,
          task_id: task.id,
          check_date: today,
          status: '미완료',
        });
      }
    }
  }

  const { error } = await supabase
    .from('daily_checks')
    .upsert(records, {
      onConflict: 'campaign_id,task_id,check_date',
      ignoreDuplicates: true,
    });

  return new Response(
    JSON.stringify({
      success: !error,
      date: today,
      records_attempted: records.length,
      error: error?.message,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
