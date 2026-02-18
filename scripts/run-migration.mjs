import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://djkcnvxnkgmxromarjnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqa2Nudnhua2dteHJvbWFyam5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwMjc1NCwiZXhwIjoyMDg2ODc4NzU0fQ.E-n7tl1xOrYGsictMlYUwTPpGdOt0RbCNXQl-4eDjJo'
);

// Verify tables
const { data: p, error: pe } = await supabase.from('projects').select('id').limit(1);
console.log('projects:', pe ? `ERROR: ${pe.message}` : 'OK (exists)');

const { data: pt, error: pte } = await supabase.from('project_tasks').select('id').limit(1);
console.log('project_tasks:', pte ? `ERROR: ${pte.message}` : 'OK (exists)');
