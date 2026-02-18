const ACCESS_TOKEN = 'sbp_cf6d5401dc1ae31f94e0749067d18aa167e85e47';
const PROJECT_REF = 'djkcnvxnkgmxromarjnf';

// Fix the default value
const sql = `
ALTER TABLE projects ALTER COLUMN state SET DEFAULT '진행전';
ALTER TABLE project_tasks ALTER COLUMN state SET DEFAULT '진행전';
`;

const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

console.log('Fix defaults:', response.status);

// Insert the missing project
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://djkcnvxnkgmxromarjnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqa2Nudnhua2dteHJvbWFyam5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwMjc1NCwiZXhwIjoyMDg2ODc4NzU0fQ.E-n7tl1xOrYGsictMlYUwTPpGdOt0RbCNXQl-4eDjJo'
);

const { data, error } = await supabase
  .from('projects')
  .insert({
    project_name: '리그램&멀티채널업로드',
    state: '진행전',
    sort_order: 10,
  })
  .select()
  .single();

console.log('Insert missing project:', error ? error.message : `OK (${data.id.substring(0,8)})`);

// Final count
const { data: allP } = await supabase.from('projects').select('id');
const { data: allT } = await supabase.from('project_tasks').select('id');
console.log(`Total: ${allP?.length} projects, ${allT?.length} tasks`);
