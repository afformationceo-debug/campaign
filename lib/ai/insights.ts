import { createClient } from '@supabase/supabase-js';

export interface Insight {
  id: string;
  type: 'risk' | 'anomaly' | 'achievement' | 'recommendation';
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  description: string;
  relatedData: {
    dimension: string;
    entityName?: string;
    metric?: number;
  };
  actionQuestion?: string; // Auto-question when card is clicked
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

export async function generateInsights(): Promise<Insight[]> {
  const supabase = getSupabase();
  const todayStr = today();
  const insights: Insight[] = [];

  // Fetch all needed data in parallel
  const [
    { data: users },
    { data: dailyChecks },
    { data: tasks },
    { data: campaigns },
    { data: projects },
    { data: projectTasks },
    { data: qas },
    { data: configs },
    { data: campaignPlatforms },
  ] = await Promise.all([
    supabase.from('users').select('id, name').eq('is_active', true),
    supabase.from('daily_checks').select('assigned_user_id, status, task_id, campaign_id, note').eq('check_date', todayStr),
    supabase.from('tasks').select('id, task_name, category, frequency'),
    supabase.from('campaigns').select('id, client_name, campaign_name, status'),
    supabase.from('projects').select('id, project_name, state, due_date, assignee_id'),
    supabase.from('project_tasks').select('project_id, state, title, due_date'),
    supabase.from('campaign_qa').select('id, campaign_id, status, priority, content, due_date'),
    supabase.from('campaign_configs').select('campaign_id, config_key, status, created_at'),
    supabase.from('campaign_platforms').select('campaign_id, platform_id, setup_status'),
  ]);

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));
  const campMap = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]));
  const checks = dailyChecks ?? [];

  // ─── 1. Workload imbalance detection ───
  if (users && checks.length > 0) {
    const userCounts: Record<string, number> = {};
    for (const c of checks) {
      if (c.assigned_user_id) {
        userCounts[c.assigned_user_id] = (userCounts[c.assigned_user_id] || 0) + 1;
      }
    }
    const counts = Object.values(userCounts);
    if (counts.length > 1) {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      for (const [userId, count] of Object.entries(userCounts)) {
        if (count >= avg * 2 && avg > 0) {
          const name = userMap.get(userId) ?? '?';
          insights.push({
            id: `workload-${userId}`,
            type: 'recommendation',
            severity: 'warning',
            title: '업무 편중 감지',
            description: `${name}님에게 업무 ${count}건이 집중되어 있습니다 (팀 평균 ${Math.round(avg)}건). 일부 업무 재배분을 검토해보세요.`,
            relatedData: { dimension: 'assignee', entityName: name, metric: count },
            actionQuestion: `${name}님의 업무 상세 현황을 분석해줘`,
          });
        }
      }
    }
  }

  // ─── 2. Project deadline risk ───
  if (projects && projectTasks) {
    const threeDaysLater = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    for (const p of projects) {
      if (p.state === '완료' || !p.due_date) continue;
      if (p.due_date <= threeDaysLater) {
        const pTasks = (projectTasks ?? []).filter((t) => t.project_id === p.id);
        const done = pTasks.filter((t) => t.state === '완료').length;
        const rate = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
        if (rate < 50) {
          const assignee = p.assignee_id ? userMap.get(p.assignee_id) : null;
          const daysLeft = Math.max(0, Math.ceil((new Date(p.due_date).getTime() - Date.now()) / 86400000));
          insights.push({
            id: `deadline-${p.id}`,
            type: 'risk',
            severity: 'critical',
            title: '마감 임박 프로젝트',
            description: `"${p.project_name}" 마감 ${daysLeft}일 남았는데 진행률 ${rate}%입니다.${assignee ? ` (담당: ${assignee}님)` : ''}`,
            relatedData: { dimension: 'project', entityName: p.project_name, metric: rate },
            actionQuestion: `"${p.project_name}" 프로젝트 상세 분석해줘`,
          });
        }
      }
    }
  }

  // ─── 3. Low completion rate today ───
  if (checks.length > 0) {
    const completed = checks.filter((c) => c.status === '완료').length;
    const rate = Math.round((completed / checks.length) * 100);
    if (rate < 70) {
      // Find which categories are dragging down
      const byCat: Record<string, { total: number; done: number }> = {};
      for (const c of checks) {
        const task = taskMap.get(c.task_id);
        const cat = task?.category ?? '기타';
        if (!byCat[cat]) byCat[cat] = { total: 0, done: 0 };
        byCat[cat].total++;
        if (c.status === '완료') byCat[cat].done++;
      }
      const worst = Object.entries(byCat)
        .map(([cat, v]) => ({ cat, rate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 100 }))
        .sort((a, b) => a.rate - b.rate)[0];

      insights.push({
        id: 'low-completion-today',
        type: 'anomaly',
        severity: rate < 50 ? 'critical' : 'warning',
        title: '오늘 완료율 저조',
        description: `오늘 전체 완료율 ${rate}% (${completed}/${checks.length}건).${worst ? ` "${worst.cat}" 카테고리가 ${worst.rate}%로 가장 낮습니다.` : ''}`,
        relatedData: { dimension: 'daily', metric: rate },
        actionQuestion: '오늘 미완료 업무 상세 분석해줘',
      });
    }
  }

  // ─── 4. Urgent QA items ───
  if (qas) {
    const urgentUnresolved = qas.filter((q) => q.priority === '긴급' && q.status !== '해결완료');
    if (urgentUnresolved.length > 0) {
      const items = urgentUnresolved.slice(0, 3).map((q) => {
        const camp = campMap.get(q.campaign_id);
        return camp ? `${camp.client_name}: ${q.content.slice(0, 30)}` : q.content.slice(0, 40);
      });
      insights.push({
        id: 'urgent-qa',
        type: 'risk',
        severity: 'critical',
        title: `긴급 QA ${urgentUnresolved.length}건`,
        description: items.join(' / '),
        relatedData: { dimension: 'qa', metric: urgentUnresolved.length },
        actionQuestion: '긴급 QA 현황 상세 분석해줘',
      });
    }
  }

  // ─── 5. Config bottleneck (stalled > 3 weeks) ───
  if (configs) {
    const threeWeeksAgo = new Date(Date.now() - 21 * 86400000).toISOString().split('T')[0];
    const stalled = configs.filter(
      (c) => c.status !== '완료' && c.created_at && c.created_at.split('T')[0] <= threeWeeksAgo
    );
    if (stalled.length > 0) {
      // Group by campaign
      const byCamp: Record<string, number> = {};
      for (const c of stalled) {
        const camp = campMap.get(c.campaign_id);
        const name = camp?.client_name ?? '기타';
        byCamp[name] = (byCamp[name] || 0) + 1;
      }
      const top = Object.entries(byCamp).sort((a, b) => b[1] - a[1]).slice(0, 2);
      insights.push({
        id: 'config-bottleneck',
        type: 'risk',
        severity: 'warning',
        title: '캠페인 세팅 지연',
        description: `${stalled.length}개 세팅 항목이 3주 이상 미완료. ${top.map(([n, c]) => `${n}(${c}건)`).join(', ')}`,
        relatedData: { dimension: 'config', metric: stalled.length },
        actionQuestion: '캠페인 세팅 지연 원인 분석해줘',
      });
    }
  }

  // ─── 6. Platform setup delay ───
  if (campaignPlatforms) {
    const notStarted = campaignPlatforms.filter((cp) => cp.setup_status === '미시작');
    if (notStarted.length > 3) {
      insights.push({
        id: 'platform-delay',
        type: 'risk',
        severity: 'warning',
        title: '플랫폼 세팅 미시작',
        description: `${notStarted.length}개 플랫폼 세팅이 아직 미시작 상태입니다.`,
        relatedData: { dimension: 'ecommerce', metric: notStarted.length },
        actionQuestion: '플랫폼 세팅 현황 분석해줘',
      });
    }
  }

  // ─── 7. Achievements (positive) ───
  if (checks.length > 0) {
    const completed = checks.filter((c) => c.status === '완료').length;
    const rate = Math.round((completed / checks.length) * 100);
    if (rate >= 95) {
      insights.push({
        id: 'high-completion',
        type: 'achievement',
        severity: 'positive',
        title: '오늘 완료율 우수!',
        description: `전체 완료율 ${rate}% 달성! ${completed}건 완료로 팀이 잘 수행하고 있습니다.`,
        relatedData: { dimension: 'daily', metric: rate },
        actionQuestion: '오늘 잘한 점 상세히 분석해줘',
      });
    }
  }

  // ─── 8. Individual high performers ───
  if (users && checks.length > 0) {
    const userStats: Record<string, { total: number; done: number }> = {};
    for (const c of checks) {
      if (!c.assigned_user_id) continue;
      if (!userStats[c.assigned_user_id]) userStats[c.assigned_user_id] = { total: 0, done: 0 };
      userStats[c.assigned_user_id].total++;
      if (c.status === '완료') userStats[c.assigned_user_id].done++;
    }
    for (const [uid, s] of Object.entries(userStats)) {
      if (s.total >= 5 && s.done === s.total) {
        const name = userMap.get(uid) ?? '?';
        insights.push({
          id: `achiever-${uid}`,
          type: 'achievement',
          severity: 'positive',
          title: `${name}님 완벽 수행`,
          description: `${name}님이 오늘 배정된 ${s.total}건 모두 완료했습니다.`,
          relatedData: { dimension: 'assignee', entityName: name, metric: 100 },
          actionQuestion: `${name}님 업무 현황 상세 분석해줘`,
        });
      }
    }
  }

  // Sort: critical first, then warning, then info/positive
  const severityOrder = { critical: 0, warning: 1, info: 2, positive: 3 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}
