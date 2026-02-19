import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SummaryDimension } from './types';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function today() {
  // 한국 시간(KST) 기준 오늘 날짜 반환
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function defaultRange(): DateRange {
  const t = today();
  return { from: t, to: t };
}

function formatRange(range: DateRange): string {
  if (range.from === range.to) return range.from;
  return `${range.from} ~ ${range.to}`;
}

async function fetchAssigneeContext(range: DateRange) {
  const supabase = getSupabase();

  // 1) 모든 활성 사용자
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .eq('is_active', true);

  // 2) 해당 기간 일일 체크
  let checksQuery = supabase
    .from('daily_checks')
    .select('assigned_user_id, status, task_id, campaign_id, note, result_value');
  if (range.from === range.to) {
    checksQuery = checksQuery.eq('check_date', range.from);
  } else {
    checksQuery = checksQuery.gte('check_date', range.from).lte('check_date', range.to);
  }
  const { data: dailyChecks } = await checksQuery;

  // 3) 이번 달 전체 월간/주간/once 체크 (기간과 별도)
  const monthStart = range.from.substring(0, 7) + '-01';
  const monthEnd = range.to.substring(0, 7) + '-31';
  const { data: monthlyChecks } = await supabase
    .from('daily_checks')
    .select('assigned_user_id, status, task_id, campaign_id')
    .gte('check_date', monthStart)
    .lte('check_date', monthEnd);

  // 4) 업무 배정 (campaign_task_config) - 누가 어떤 업무에 배정되어 있는지
  const { data: taskConfigs } = await supabase
    .from('campaign_task_config')
    .select('task_id, campaign_id, is_applicable, override_assignee')
    .eq('is_applicable', true);

  // 5) 업무 마스터
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, task_name, category, frequency, scope, default_assignees');

  // 6) 캠페인
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name');

  if (!users) return null;

  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]));
  const campMap = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const checks = dailyChecks ?? [];
  const allMonthly = monthlyChecks ?? [];
  const configs = taskConfigs ?? [];

  const byUser = users.map((u) => {
    // 일일 체크 (해당 기간)
    const userChecks = checks.filter((c) => c.assigned_user_id === u.id);
    const total = userChecks.length;
    const completed = userChecks.filter((c) => c.status === '완료').length;
    const inProgress = userChecks.filter((c) => c.status === '진행중').length;
    const pending = userChecks.filter((c) => c.status === '미완료').length;
    const na = userChecks.filter((c) => c.status === '해당없음').length;

    // 월간 체크 (이번 달 전체)
    const userMonthly = allMonthly.filter((c) => c.assigned_user_id === u.id);
    const monthlyTotal = userMonthly.length;
    const monthlyCompleted = userMonthly.filter((c) => c.status === '완료').length;

    // 캠페인별 업무 배정 (campaign_task_config)
    const userConfigs = configs.filter((c) => c.override_assignee === u.id);
    const configCampaignIds = [...new Set(userConfigs.map((c) => c.campaign_id))];
    const configCampaigns = configCampaignIds
      .map((id) => campMap.get(id)?.client_name)
      .filter(Boolean);

    // 체크 기반 캠페인
    const checkCampaignIds = [...new Set(userChecks.filter((c) => c.campaign_id).map((c) => c.campaign_id))];
    const checkCampaigns = checkCampaignIds
      .map((id) => campMap.get(id)?.client_name)
      .filter(Boolean);

    // 모든 담당 캠페인 (중복 제거)
    const allCampaigns = [...new Set([...configCampaigns, ...checkCampaigns])];

    // 전역 업무 (default_assignees에 포함)
    const globalTasks = (tasks ?? [])
      .filter((t) => t.scope === 'global' && t.default_assignees?.includes(u.id))
      .map((t) => ({ task: t.task_name, category: t.category, frequency: t.frequency }));

    // 배정된 캠페인 업무 (빈도별)
    const assignedByFreq: Record<string, number> = {};
    for (const cfg of userConfigs) {
      const task = taskMap.get(cfg.task_id);
      const freq = task?.frequency ?? 'daily';
      assignedByFreq[freq] = (assignedByFreq[freq] || 0) + 1;
    }

    // 미완료 업무 상세
    const pendingTasks = userChecks
      .filter((c) => c.status === '미완료')
      .slice(0, 5)
      .map((c) => {
        const task = taskMap.get(c.task_id);
        const camp = c.campaign_id ? campMap.get(c.campaign_id) : null;
        return {
          task: task?.task_name ?? '?',
          campaign: camp ? camp.client_name : '전역',
          category: task?.category,
        };
      });

    // 아무 업무도 없는 사용자는 제외
    const hasWork = total > 0 || monthlyTotal > 0 || globalTasks.length > 0 || userConfigs.length > 0;
    if (!hasWork) return null;

    return {
      name: u.name,
      dailyChecks: total > 0 ? { total, completed, inProgress, pending, na, rate: Math.round((completed / total) * 100) } : null,
      monthlyChecks: monthlyTotal > 0 ? { total: monthlyTotal, completed: monthlyCompleted, rate: Math.round((monthlyCompleted / monthlyTotal) * 100) } : null,
      assignedCampaigns: allCampaigns,
      assignedTaskCount: userConfigs.length,
      assignedByFrequency: Object.keys(assignedByFreq).length > 0 ? assignedByFreq : undefined,
      globalTasks: globalTasks.length > 0 ? globalTasks : undefined,
      pendingTasks: pendingTasks.length > 0 ? pendingTasks : undefined,
    };
  }).filter(Boolean);

  return { date: formatRange(range), assignees: byUser };
}

async function fetchCampaignContext(range: DateRange) {
  const supabase = getSupabase();
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name, campaign_type, status, phase, target_country, monthly_fixed_cost, cost_per_influencer, influencer_fee_budget')
    .order('campaign_name');

  let checksQuery = supabase
    .from('daily_checks')
    .select('campaign_id, status, assigned_user_id');
  if (range.from === range.to) {
    checksQuery = checksQuery.eq('check_date', range.from);
  } else {
    checksQuery = checksQuery.gte('check_date', range.from).lte('check_date', range.to);
  }
  const { data: checks } = await checksQuery;

  const { data: users } = await supabase
    .from('users')
    .select('id, name');

  if (!campaigns || !checks) return null;

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

  const byStatus = { active: 0, paused: 0, completed: 0 };
  const byPhase = { onboarding: 0, running: 0, scaling: 0 };
  const byType: Record<string, number> = {};

  const list = campaigns.map((c) => {
    if (c.status in byStatus) byStatus[c.status as keyof typeof byStatus]++;
    if (c.phase in byPhase) byPhase[c.phase as keyof typeof byPhase]++;
    byType[c.campaign_type] = (byType[c.campaign_type] || 0) + 1;

    const cChecks = checks.filter((ch) => ch.campaign_id === c.id);
    const total = cChecks.length;
    const done = cChecks.filter((ch) => ch.status === '완료').length;
    const pending = cChecks.filter((ch) => ch.status === '미완료').length;

    // Unique assignees for this campaign
    const assigneeIds = [...new Set(cChecks.map((ch) => ch.assigned_user_id))];
    const assignees = assigneeIds.map((id) => userMap.get(id) ?? '?').filter(Boolean);

    return {
      name: `${c.client_name} - ${c.campaign_name}`,
      type: c.campaign_type,
      status: c.status,
      phase: c.phase,
      country: c.target_country,
      todayRate: total > 0 ? Math.round((done / total) * 100) : null,
      todayTotal: total,
      todayDone: done,
      todayPending: pending,
      assignees: assignees.slice(0, 3),
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

async function fetchDailyContext(range: DateRange) {
  const supabase = getSupabase();

  // 해당 기간 일일 체크
  let checksQuery = supabase
    .from('daily_checks')
    .select('status, task_id, campaign_id, assigned_user_id, note, result_value');
  if (range.from === range.to) {
    checksQuery = checksQuery.eq('check_date', range.from);
  } else {
    checksQuery = checksQuery.gte('check_date', range.from).lte('check_date', range.to);
  }
  const { data: checks } = await checksQuery;

  // 이번 달 전체 체크 (월간/주간 업무 포함)
  const monthStart = range.from.substring(0, 7) + '-01';
  const monthEnd = range.to.substring(0, 7) + '-31';
  const { data: monthlyChecks } = await supabase
    .from('daily_checks')
    .select('status, task_id, campaign_id, assigned_user_id, result_value')
    .gte('check_date', monthStart)
    .lte('check_date', monthEnd);

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, task_name, category, frequency');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name');

  const { data: users } = await supabase
    .from('users')
    .select('id, name');

  if (!tasks || !campaigns) return null;

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const campMap = new Map(campaigns.map((c) => [c.id, c]));
  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

  const dailyList = checks ?? [];
  const total = dailyList.length;
  const completed = dailyList.filter((c) => c.status === '완료').length;
  const inProgress = dailyList.filter((c) => c.status === '진행중').length;
  const pending = dailyList.filter((c) => c.status === '미완료').length;
  const na = dailyList.filter((c) => c.status === '해당없음').length;

  // 월간 체크 통계
  const monthlyList = monthlyChecks ?? [];
  // 월간/주간 업무만 필터 (daily 제외)
  const periodicOnly = monthlyList.filter((c) => {
    const t = taskMap.get(c.task_id);
    return t && (t.frequency === 'monthly' || t.frequency === 'weekly' || t.frequency === 'once' || t.frequency === 'as_needed');
  });
  const periodicTotal = periodicOnly.length;
  const periodicCompleted = periodicOnly.filter((c) => c.status === '완료').length;

  // Category breakdown (일일 기준)
  const byCategory: Record<string, { total: number; done: number }> = {};
  for (const check of dailyList) {
    const task = taskMap.get(check.task_id);
    const cat = task?.category ?? '기타';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, done: 0 };
    byCategory[cat].total++;
    if (check.status === '완료') byCategory[cat].done++;
  }

  const pendingDetails = dailyList
    .filter((c) => c.status === '미완료')
    .slice(0, 20)
    .map((c) => {
      const task = taskMap.get(c.task_id);
      const camp = c.campaign_id ? campMap.get(c.campaign_id) : null;
      const assignee = userMap.get(c.assigned_user_id);
      return {
        task: task?.task_name ?? '?',
        campaign: camp ? camp.client_name : '전역',
        category: task?.category,
        frequency: task?.frequency,
        assignee: assignee ?? '?',
      };
    });

  // 월간/주간 미완료
  const periodicPending = periodicOnly
    .filter((c) => c.status === '미완료')
    .slice(0, 10)
    .map((c) => {
      const task = taskMap.get(c.task_id);
      const camp = c.campaign_id ? campMap.get(c.campaign_id) : null;
      const assignee = userMap.get(c.assigned_user_id);
      return {
        task: task?.task_name ?? '?',
        campaign: camp ? camp.client_name : '전역',
        category: task?.category,
        frequency: task?.frequency,
        assignee: assignee ?? '?',
      };
    });

  const withResults = dailyList
    .filter((c) => c.result_value)
    .slice(0, 15)
    .map((c) => {
      const task = taskMap.get(c.task_id);
      const camp = c.campaign_id ? campMap.get(c.campaign_id) : null;
      return {
        task: task?.task_name ?? '?',
        campaign: camp ? camp.client_name : '전역',
        result: c.result_value,
      };
    });

  return {
    date: formatRange(range),
    daily: { total, completed, inProgress, pending, na, rate: total > 0 ? Math.round((completed / total) * 100) : 0 },
    periodic: periodicTotal > 0 ? { total: periodicTotal, completed: periodicCompleted, rate: Math.round((periodicCompleted / periodicTotal) * 100) } : null,
    byCategory,
    pendingDetails,
    periodicPending: periodicPending.length > 0 ? periodicPending : undefined,
    withResults,
  };
}

async function fetchProjectContext() {
  const supabase = getSupabase();
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

  const byState: Record<string, number> = { '진행전': 0, '진행중': 0, '완료': 0 };
  const list = projects.map((p) => {
    if (p.state in byState) byState[p.state as keyof typeof byState]++;
    const pTasks = tasks.filter((t) => t.project_id === p.id);
    const done = pTasks.filter((t) => t.state === '완료').length;
    const inProgress = pTasks.filter((t) => t.state === '진행중').length;
    const dueSoon = p.due_date && p.due_date <= new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] && p.state !== '완료';

    // Overdue tasks
    const overdueTasks = pTasks.filter(
      (t) => t.due_date && t.due_date < today() && t.state !== '완료'
    ).map((t) => t.title);

    return {
      name: p.project_name,
      state: p.state,
      assignee: p.assignee_id ? userMap.get(p.assignee_id) ?? null : null,
      dueDate: p.due_date,
      dueSoon: !!dueSoon,
      tasksDone: done,
      tasksInProgress: inProgress,
      tasksTotal: pTasks.length,
      rate: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0,
      overdueTasks: overdueTasks.slice(0, 3),
    };
  });

  return { total: projects.length, byState, projects: list };
}

async function fetchQaContext() {
  const supabase = getSupabase();
  const { data: qas } = await supabase
    .from('campaign_qa')
    .select('id, campaign_id, qa_type, content, status, priority, due_date, created_at');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name');

  if (!qas) return { total: 0, byStatus: {}, byPriority: {}, items: [] };

  const campMap = new Map((campaigns ?? []).map((c) => [c.id, `${c.client_name}`]));
  const byStatus: Record<string, number> = { '미해결': 0, '진행중': 0, '해결완료': 0 };
  const byPriority: Record<string, number> = { '긴급': 0, '높음': 0, '보통': 0, '낮음': 0 };

  // Campaign-wise issue distribution
  const byCampaign: Record<string, number> = {};

  for (const qa of qas) {
    if (qa.status in byStatus) byStatus[qa.status as keyof typeof byStatus]++;
    if (qa.priority in byPriority) byPriority[qa.priority as keyof typeof byPriority]++;
    if (qa.status !== '해결완료') {
      const campName = campMap.get(qa.campaign_id) ?? '기타';
      byCampaign[campName] = (byCampaign[campName] || 0) + 1;
    }
  }

  const unresolvedItems = qas
    .filter((q) => q.status !== '해결완료')
    .sort((a, b) => {
      const priorityOrder = { '긴급': 0, '높음': 1, '보통': 2, '낮음': 3 };
      return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 9) -
             (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 9);
    })
    .slice(0, 15)
    .map((q) => ({
      campaign: campMap.get(q.campaign_id) ?? '?',
      type: q.qa_type,
      content: q.content.slice(0, 80),
      priority: q.priority,
      status: q.status,
      dueDate: q.due_date,
    }));

  return { total: qas.length, byStatus, byPriority, byCampaign, items: unresolvedItems };
}

async function fetchConfigContext() {
  const supabase = getSupabase();
  const { data: configs } = await supabase
    .from('campaign_configs')
    .select('campaign_id, config_type, config_key, status');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_name, campaign_name, campaign_type, status, phase');

  if (!configs || !campaigns) return null;

  const campMap = new Map(campaigns.map((c) => [c.id, c]));

  // Group by campaign_type
  const overseas = { total: 0, completed: 0, keys: new Map<string, { done: number; total: number }>(), campaigns: new Map<string, { done: number; total: number }>() };
  const domestic = { total: 0, completed: 0, keys: new Map<string, { done: number; total: number }>(), campaigns: new Map<string, { done: number; total: number }>() };

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

    // Campaign-level aggregation
    const campName = `${camp.client_name} - ${camp.campaign_name}`;
    const campStats = bucket.campaigns.get(campName) ?? { done: 0, total: 0 };
    campStats.total++;
    if (cfg.status === '완료') campStats.done++;
    bucket.campaigns.set(campName, campStats);
  }

  const formatKeys = (m: Map<string, { done: number; total: number }>) =>
    Array.from(m.entries())
      .map(([key, v]) => ({ key, done: v.done, total: v.total, rate: Math.round((v.done / v.total) * 100) }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 10);

  const formatCampaigns = (m: Map<string, { done: number; total: number }>) =>
    Array.from(m.entries())
      .map(([name, v]) => ({ name, done: v.done, total: v.total, rate: Math.round((v.done / v.total) * 100) }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 10);

  return {
    overseas: {
      total: overseas.total,
      completed: overseas.completed,
      rate: overseas.total > 0 ? Math.round((overseas.completed / overseas.total) * 100) : 0,
      lowCompletionKeys: formatKeys(overseas.keys),
      lowCompletionCampaigns: formatCampaigns(overseas.campaigns),
    },
    domestic: {
      total: domestic.total,
      completed: domestic.completed,
      rate: domestic.total > 0 ? Math.round((domestic.completed / domestic.total) * 100) : 0,
      lowCompletionKeys: formatKeys(domestic.keys),
      lowCompletionCampaigns: formatCampaigns(domestic.campaigns),
    },
  };
}

export async function buildContext(dimension: SummaryDimension, range?: DateRange): Promise<string> {
  const r = range ?? defaultRange();
  const rangeLabel = formatRange(r);
  const parts: string[] = [`# 분석 기준: ${rangeLabel}`];

  if (dimension === 'all' || dimension === 'assignee') {
    const data = await fetchAssigneeContext(r);
    if (data) parts.push(`## 담당자별 현황 (${rangeLabel})\n${JSON.stringify(data.assignees, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'campaign') {
    const data = await fetchCampaignContext(r);
    if (data) parts.push(`## 캠페인별 현황 (${rangeLabel})\n전체: ${data.total}개, 상태: ${JSON.stringify(data.byStatus)}, 단계: ${JSON.stringify(data.byPhase)}, 유형: ${JSON.stringify(data.byType)}\n${JSON.stringify(data.campaigns, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'daily') {
    const data = await fetchDailyContext(r);
    if (data) {
      const d = data.daily;
      let section = `## 업무 결과 (${rangeLabel})\n### 일일 업무\n전체: ${d.total}건, 완료: ${d.completed}, 진행중: ${d.inProgress}, 미완료: ${d.pending}, 해당없음: ${d.na}, 완료율: ${d.rate}%`;
      if (data.periodic) {
        section += `\n### 월간/주간 업무 (이번 달)\n전체: ${data.periodic.total}건, 완료: ${data.periodic.completed}, 완료율: ${data.periodic.rate}%`;
      }
      section += `\n카테고리별: ${JSON.stringify(data.byCategory, null, 1)}`;
      section += `\n일일 미완료 상세(담당자 포함): ${JSON.stringify(data.pendingDetails, null, 1)}`;
      if (data.periodicPending) {
        section += `\n월간/주간 미완료(담당자 포함): ${JSON.stringify(data.periodicPending, null, 1)}`;
      }
      section += `\n결과값: ${JSON.stringify(data.withResults, null, 1)}`;
      parts.push(section);
    }
  }

  if (dimension === 'all' || dimension === 'project') {
    const data = await fetchProjectContext();
    if (data) parts.push(`## 프로젝트 로드맵\n전체: ${data.total}개, 상태: ${JSON.stringify(data.byState)}\n${JSON.stringify(data.projects, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'qa') {
    const data = await fetchQaContext();
    parts.push(`## QA/이슈 관리\n전체: ${data.total}건, 상태: ${JSON.stringify(data.byStatus)}, 우선순위: ${JSON.stringify(data.byPriority)}\n캠페인별 미해결: ${JSON.stringify(data.byCampaign, null, 1)}\n미해결 상세(우선순위순): ${JSON.stringify(data.items, null, 1)}`);
  }

  if (dimension === 'all' || dimension === 'config') {
    const data = await fetchConfigContext();
    if (data) parts.push(`## 캠페인 세팅\n해외마케팅: ${data.overseas.completed}/${data.overseas.total} (${data.overseas.rate}%)\n국내챗닥: ${data.domestic.completed}/${data.domestic.total} (${data.domestic.rate}%)\n해외 미완료 항목: ${JSON.stringify(data.overseas.lowCompletionKeys, null, 1)}\n해외 캠페인별: ${JSON.stringify(data.overseas.lowCompletionCampaigns, null, 1)}\n국내 미완료 항목: ${JSON.stringify(data.domestic.lowCompletionKeys, null, 1)}\n국내 캠페인별: ${JSON.stringify(data.domestic.lowCompletionCampaigns, null, 1)}`);
  }

  return parts.join('\n\n');
}
