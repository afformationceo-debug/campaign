import { createClient } from '@supabase/supabase-js';
import type { SummaryDimension } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function today() {
  return new Date().toISOString().split('T')[0];
}

async function fetchAssigneeContext() {
  const { data: users } = await supabase
    .from('users')
    .select('id, name, position, role')
    .eq('is_active', true);

  const { data: checks } = await supabase
    .from('daily_checks')
    .select('assigned_user_id, status, task_id, campaign_id')
    .eq('check_date', today());

  if (!users || !checks) return null;

  const byUser = users.map((u) => {
    const userChecks = checks.filter((c) => c.assigned_user_id === u.id);
    const total = userChecks.length;
    const completed = userChecks.filter((c) => c.status === '완료').length;
    const inProgress = userChecks.filter((c) => c.status === '진행중').length;
    const pending = userChecks.filter((c) => c.status === '미완료').length;
    return {
      name: u.name,
      position: u.position,
      total,
      completed,
      inProgress,
      pending,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }).filter((u) => u.total > 0);

  return { date: today(), assignees: byUser };
}

async function fetchCampaignContext() {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name, campaign_type, status, phase, target_country, monthly_fixed_cost, cost_per_influencer, influencer_fee_budget')
    .order('campaign_name');

  const { data: checks } = await supabase
    .from('daily_checks')
    .select('campaign_id, status')
    .eq('check_date', today());

  if (!campaigns || !checks) return null;

  const byStatus = { active: 0, paused: 0, completed: 0 };
  const byPhase = { onboarding: 0, running: 0, scaling: 0 };
  const byType = { '해외마케팅': 0, '국내챗닥': 0 };

  const list = campaigns.map((c) => {
    byStatus[c.status as keyof typeof byStatus]++;
    byPhase[c.phase as keyof typeof byPhase]++;
    byType[c.campaign_type as keyof typeof byType]++;

    const cChecks = checks.filter((ch) => ch.campaign_id === c.id);
    const total = cChecks.length;
    const done = cChecks.filter((ch) => ch.status === '완료').length;
    return {
      name: `${c.client_name} - ${c.campaign_name}`,
      type: c.campaign_type,
      status: c.status,
      phase: c.phase,
      country: c.target_country,
      todayRate: total > 0 ? Math.round((done / total) * 100) : null,
      todayTotal: total,
      todayDone: done,
      cost: c.monthly_fixed_cost ? `월고정 ${c.monthly_fixed_cost}만` : null,
    };
  });

  return {
    total: campaigns.length,
    byStatus,
    byPhase,
    byType,
    campaigns: list,
  };
}

async function fetchDailyContext() {
  const { data: checks } = await supabase
    .from('daily_checks')
    .select('status, task_id, campaign_id, assigned_user_id, note, result_value')
    .eq('check_date', today());

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, task_name, category, frequency');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name');

  if (!checks || !tasks || !campaigns) return null;

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const campMap = new Map(campaigns.map((c) => [c.id, c]));

  const total = checks.length;
  const completed = checks.filter((c) => c.status === '완료').length;
  const inProgress = checks.filter((c) => c.status === '진행중').length;
  const pending = checks.filter((c) => c.status === '미완료').length;
  const na = checks.filter((c) => c.status === '해당없음').length;

  const pendingDetails = checks
    .filter((c) => c.status === '미완료')
    .slice(0, 15)
    .map((c) => {
      const task = taskMap.get(c.task_id);
      const camp = c.campaign_id ? campMap.get(c.campaign_id) : null;
      return {
        task: task?.task_name ?? '?',
        campaign: camp ? `${camp.client_name}` : '전역',
        category: task?.category,
      };
    });

  const withResults = checks
    .filter((c) => c.result_value)
    .slice(0, 10)
    .map((c) => {
      const task = taskMap.get(c.task_id);
      return {
        task: task?.task_name ?? '?',
        result: c.result_value,
      };
    });

  return {
    date: today(),
    total,
    completed,
    inProgress,
    pending,
    na,
    rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    pendingDetails,
    withResults,
  };
}

async function fetchProjectContext() {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_name, state, due_date, assignee_id')
    .order('sort_order');

  const { data: tasks } = await supabase
    .from('project_tasks')
    .select('project_id, state, title, due_date');

  const { data: users } = await supabase
    .from('users')
    .select('id, name');

  if (!projects || !tasks) return null;

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));
  const todayStr = today();

  const byState = { '진행전': 0, '진행중': 0, '완료': 0 };
  const list = projects.map((p) => {
    byState[p.state as keyof typeof byState]++;
    const pTasks = tasks.filter((t) => t.project_id === p.id);
    const done = pTasks.filter((t) => t.state === '완료').length;
    const dueSoon = p.due_date && p.due_date <= new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] && p.state !== '완료';
    return {
      name: p.project_name,
      state: p.state,
      assignee: p.assignee_id ? userMap.get(p.assignee_id) ?? null : null,
      dueDate: p.due_date,
      dueSoon: !!dueSoon,
      tasksDone: done,
      tasksTotal: pTasks.length,
      rate: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0,
    };
  });

  return { total: projects.length, byState, projects: list };
}

async function fetchQaContext() {
  const { data: qas } = await supabase
    .from('campaign_qa')
    .select('id, campaign_id, qa_type, content, status, priority, due_date');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name');

  if (!qas) return { total: 0, byStatus: {}, byPriority: {}, items: [] };

  const campMap = new Map((campaigns ?? []).map((c) => [c.id, `${c.client_name}`]));
  const byStatus = { '미해결': 0, '진행중': 0, '해결완료': 0 };
  const byPriority = { '긴급': 0, '높음': 0, '보통': 0, '낮음': 0 };

  for (const qa of qas) {
    if (qa.status in byStatus) byStatus[qa.status as keyof typeof byStatus]++;
    if (qa.priority in byPriority) byPriority[qa.priority as keyof typeof byPriority]++;
  }

  const unresolvedItems = qas
    .filter((q) => q.status !== '해결완료')
    .slice(0, 10)
    .map((q) => ({
      campaign: campMap.get(q.campaign_id) ?? '?',
      type: q.qa_type,
      content: q.content.slice(0, 60),
      priority: q.priority,
      status: q.status,
    }));

  return { total: qas.length, byStatus, byPriority, items: unresolvedItems };
}

async function fetchConfigContext() {
  const { data: configs } = await supabase
    .from('campaign_configs')
    .select('campaign_id, config_type, config_key, status');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_type');

  if (!configs || !campaigns) return null;

  const campMap = new Map(campaigns.map((c) => [c.id, c]));

  // Group by campaign_type
  const overseas = { total: 0, completed: 0, keys: new Map<string, { done: number; total: number }>() };
  const domestic = { total: 0, completed: 0, keys: new Map<string, { done: number; total: number }>() };

  for (const cfg of configs) {
    const camp = campMap.get(cfg.campaign_id);
    if (!camp) continue;
    const bucket = camp.campaign_type === '국내챗닥' ? domestic : overseas;
    bucket.total++;
    if (cfg.status === '완료') bucket.completed++;

    const existing = bucket.keys.get(cfg.config_key) ?? { done: 0, total: 0 };
    existing.total++;
    if (cfg.status === '완료') existing.done++;
    bucket.keys.set(cfg.config_key, existing);
  }

  const formatKeys = (m: Map<string, { done: number; total: number }>) =>
    Array.from(m.entries())
      .map(([key, v]) => ({ key, done: v.done, total: v.total, rate: Math.round((v.done / v.total) * 100) }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 10);

  return {
    overseas: {
      total: overseas.total,
      completed: overseas.completed,
      rate: overseas.total > 0 ? Math.round((overseas.completed / overseas.total) * 100) : 0,
      lowCompletionKeys: formatKeys(overseas.keys),
    },
    domestic: {
      total: domestic.total,
      completed: domestic.completed,
      rate: domestic.total > 0 ? Math.round((domestic.completed / domestic.total) * 100) : 0,
      lowCompletionKeys: formatKeys(domestic.keys),
    },
  };
}

export async function buildContext(dimension: SummaryDimension): Promise<string> {
  const parts: string[] = [];

  if (dimension === 'all' || dimension === 'assignee') {
    const data = await fetchAssigneeContext();
    if (data) parts.push(`## 담당자별 현황 (${data.date})\n${JSON.stringify(data.assignees, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'campaign') {
    const data = await fetchCampaignContext();
    if (data) parts.push(`## 캠페인별 현황\n전체: ${data.total}개, 상태: ${JSON.stringify(data.byStatus)}, 단계: ${JSON.stringify(data.byPhase)}, 유형: ${JSON.stringify(data.byType)}\n${JSON.stringify(data.campaigns, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'daily') {
    const data = await fetchDailyContext();
    if (data) parts.push(`## 오늘의 업무 결과 (${data.date})\n전체: ${data.total}건, 완료: ${data.completed}, 진행중: ${data.inProgress}, 미완료: ${data.pending}, 해당없음: ${data.na}, 완료율: ${data.rate}%\n미완료 상세: ${JSON.stringify(data.pendingDetails, null, 1)}\n결과값: ${JSON.stringify(data.withResults, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'project') {
    const data = await fetchProjectContext();
    if (data) parts.push(`## 프로젝트 로드맵\n전체: ${data.total}개, 상태: ${JSON.stringify(data.byState)}\n${JSON.stringify(data.projects, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'qa') {
    const data = await fetchQaContext();
    parts.push(`## QA/이슈 관리\n전체: ${data.total}건, 상태: ${JSON.stringify(data.byStatus)}, 우선순위: ${JSON.stringify(data.byPriority)}\n미해결: ${JSON.stringify(data.items, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'config') {
    const data = await fetchConfigContext();
    if (data) parts.push(`## 캠페인 세팅\n해외마케팅: ${data.overseas.completed}/${data.overseas.total} (${data.overseas.rate}%)\n국내챗닥: ${data.domestic.completed}/${data.domestic.total} (${data.domestic.rate}%)\n해외 미완료 항목: ${JSON.stringify(data.overseas.lowCompletionKeys, null, 1)}\n국내 미완료 항목: ${JSON.stringify(data.domestic.lowCompletionKeys, null, 1)}`);
  }

  return parts.join('\n\n');
}
