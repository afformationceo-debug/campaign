import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://djkcnvxnkgmxromarjnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqa2Nudnhua2dteHJvbWFyam5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwMjc1NCwiZXhwIjoyMDg2ODc4NzU0fQ.E-n7tl1xOrYGsictMlYUwTPpGdOt0RbCNXQl-4eDjJo'
);

// 1. 사용자 ID 조회
const { data: users, error: userErr } = await supabase.from('users').select('id, name');
if (userErr) { console.error('사용자 조회 실패:', userErr.message); process.exit(1); }

const userMap = new Map(users.map(u => [u.name, u.id]));
console.log('등록된 사용자:', [...userMap.keys()].join(', '));

const assigneeNames = ['조성준', '이현수'];
const assigneeIds = assigneeNames.map(name => {
  const id = userMap.get(name);
  if (!id) { console.error(`사용자 "${name}"을(를) 찾을 수 없습니다.`); process.exit(1); }
  return id;
});
console.log(`담당자: ${assigneeNames.join(', ')} → ${assigneeIds.map(id => id.substring(0, 8)).join(', ')}`);

// 2. 기존 프로젝트 최대 sort_order 조회
const { data: existing } = await supabase
  .from('projects')
  .select('sort_order')
  .order('sort_order', { ascending: false })
  .limit(1);
const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

// 3. 4개 프로젝트 추가
const projectNames = [
  '플라덴성형외과 영미 캠페인 세팅',
  '플라덴성형외과 대만 캠페인 세팅',
  '리스펙성형외과 영미 캠페인 세팅',
  '리스펙성형외과 대만 캠페인 세팅',
];

for (let i = 0; i < projectNames.length; i++) {
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      project_name: projectNames[i],
      assignee_ids: assigneeIds,
      state: '진행전',
      sort_order: nextOrder + i,
    })
    .select()
    .single();

  if (projErr) {
    console.error(`❌ "${projectNames[i]}" 추가 실패:`, projErr.message);
  } else {
    console.log(`✅ ${project.project_name} (${project.id.substring(0, 8)}...)`);
  }
}

// 4. 결과 확인
const { data: allProjects } = await supabase
  .from('projects')
  .select('project_name, state, assignee_ids')
  .order('sort_order', { ascending: true });
console.log(`\n전체 프로젝트: ${allProjects?.length}개`);
allProjects?.slice(-4).forEach(p => {
  console.log(`  - ${p.project_name} | ${p.state} | 담당자 ${p.assignee_ids?.length ?? 0}명`);
});
