import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://djkcnvxnkgmxromarjnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqa2Nudnhua2dteHJvbWFyam5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwMjc1NCwiZXhwIjoyMDg2ODc4NzU0fQ.E-n7tl1xOrYGsictMlYUwTPpGdOt0RbCNXQl-4eDjJo'
);

// 1. 기존 '진행전' 프로젝트를 '진행중'으로 업데이트
const { data: pendingProjects, error: pe } = await supabase
  .from('projects')
  .update({ state: '진행중' })
  .eq('state', '진행전')
  .select('id');
console.log(`✅ projects: ${pendingProjects?.length ?? 0}건 '진행전' → '진행중' 업데이트`, pe?.message ?? '');

// 2. 기존 '진행전' 하위업무를 '진행중'으로 업데이트
const { data: pendingTasks, error: te } = await supabase
  .from('project_tasks')
  .update({ state: '진행중' })
  .eq('state', '진행전')
  .select('id');
console.log(`✅ project_tasks: ${pendingTasks?.length ?? 0}건 '진행전' → '진행중' 업데이트`, te?.message ?? '');

// 3. 검증 — 남은 '진행전' 확인
const { data: remainProjects } = await supabase.from('projects').select('id').eq('state', '진행전');
const { data: remainTasks } = await supabase.from('project_tasks').select('id').eq('state', '진행전');
console.log(`\n📊 검증:`);
console.log(`  프로젝트 '진행전' 남은 건: ${remainProjects?.length ?? 0}`);
console.log(`  하위업무 '진행전' 남은 건: ${remainTasks?.length ?? 0}`);

// 4. 상태 분포 확인
const { data: allProjects } = await supabase.from('projects').select('state');
const stateCounts = {};
allProjects?.forEach(p => { stateCounts[p.state] = (stateCounts[p.state] || 0) + 1; });
console.log(`\n📊 프로젝트 상태 분포:`, stateCounts);
