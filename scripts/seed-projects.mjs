import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const supabase = createClient(
  'https://djkcnvxnkgmxromarjnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqa2Nudnhua2dteHJvbWFyam5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwMjc1NCwiZXhwIjoyMDg2ODc4NzU0fQ.E-n7tl1xOrYGsictMlYUwTPpGdOt0RbCNXQl-4eDjJo'
);

// Get users to map assignee names to IDs
const { data: users } = await supabase.from('users').select('id, name');
const userMap = new Map();
if (users) {
  users.forEach(u => userMap.set(u.name, u.id));
}
console.log('Users:', [...userMap.entries()].map(([n,i]) => `${n}=${i.substring(0,8)}`).join(', '));

// Read CSV
const csvContent = readFileSync('2026_어포메이션_로드맵.csv', 'utf-8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true,
});

console.log(`Parsed ${records.length} records from CSV`);

// State mapping
function mapState(s) {
  if (!s) return '미완료';
  const lower = s.trim();
  if (lower === '진행중') return '진행중';
  if (lower === '미완료' || lower === '진행전') return '진행전';
  if (lower === '완료') return '완료';
  return '진행전';
}

// Parse sub-tasks from the value column
function parseSubTasks(value) {
  if (!value) return [];
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, idx) => {
      // Remove leading "0. ", "1. ", "- " etc.
      const cleaned = line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim();
      return { title: cleaned, sort_order: idx };
    })
    .filter(t => t.title.length > 0);
}

// Insert projects and sub-tasks
for (let i = 0; i < records.length; i++) {
  const r = records[i];
  const projectName = r.key?.trim();
  if (!projectName) continue;

  const assigneeId = userMap.get(r.who?.trim()) || null;
  const state = mapState(r.state);
  const dueDate = r['due date']?.trim() || null;

  // Insert project
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      project_name: projectName,
      url: r.url?.trim() || null,
      assignee_id: assigneeId,
      due_date: dueDate,
      state: state,
      memo: r.memo?.trim() || null,
      sort_order: i,
    })
    .select()
    .single();

  if (projErr) {
    console.error(`Failed to insert project "${projectName}":`, projErr.message);
    continue;
  }

  console.log(`+ Project: ${projectName} (${project.id.substring(0, 8)})`);

  // Parse and insert sub-tasks
  const subTasks = parseSubTasks(r.value);
  if (subTasks.length > 0) {
    const tasksToInsert = subTasks.map(t => ({
      project_id: project.id,
      title: t.title,
      state: '진행전',
      assignee_id: assigneeId,
      sort_order: t.sort_order,
    }));

    const { error: taskErr } = await supabase
      .from('project_tasks')
      .insert(tasksToInsert);

    if (taskErr) {
      console.error(`  Failed to insert tasks for "${projectName}":`, taskErr.message);
    } else {
      console.log(`  + ${subTasks.length} sub-tasks`);
    }
  }
}

// Verify
const { data: allProjects } = await supabase.from('projects').select('id, project_name');
const { data: allTasks } = await supabase.from('project_tasks').select('id');
console.log(`\nDone! ${allProjects?.length ?? 0} projects, ${allTasks?.length ?? 0} tasks seeded.`);
