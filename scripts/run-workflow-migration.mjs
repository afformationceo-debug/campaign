import { readFileSync } from 'fs';
import pg from 'pg';

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqa2Nudnhua2dteHJvbWFyam5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwMjc1NCwiZXhwIjoyMDg2ODc4NzU0fQ.E-n7tl1xOrYGsictMlYUwTPpGdOt0RbCNXQl-4eDjJo';

// Supabase Session Pooler connection using service_role JWT as password
const client = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.djkcnvxnkgmxromarjnf',
  password: SERVICE_ROLE_KEY,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log('Connecting to Supabase PostgreSQL via Session Pooler...');
  await client.connect();
  console.log('✅ Connected!\n');

  // Read the SQL file
  const sql = readFileSync('supabase/migrations/20260322_collaboration_workflow.sql', 'utf-8');

  console.log('Executing migration SQL...');
  await client.query(sql);
  console.log('✅ Migration executed successfully!\n');

  // Verify tables
  const { rows: tables } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('collaboration_products', 'workflow_tasks', 'product_task_defaults', 'campaign_products', 'campaign_workflow_checks')
    ORDER BY table_name
  `);
  console.log('Created tables:');
  tables.forEach(t => console.log(`  ✅ ${t.table_name}`));

  // Verify seed data
  const { rows: products } = await client.query('SELECT product_name FROM collaboration_products ORDER BY sort_order');
  console.log(`\n협업상품 (${products.length}개):`);
  products.forEach(p => console.log(`  - ${p.product_name}`));

  const { rows: taskCount } = await client.query('SELECT count(*) as cnt FROM workflow_tasks');
  console.log(`\n워크플로우 TASK: ${taskCount[0].cnt}개`);

  const { rows: defaultCount } = await client.query('SELECT count(*) as cnt FROM product_task_defaults');
  console.log(`디폴트 맵핑: ${defaultCount[0].cnt}개`);

} catch (err) {
  console.error('❌ Error:', err.message);

  // If pooler fails, try direct connection
  if (err.message.includes('password') || err.message.includes('auth') || err.message.includes('connect')) {
    console.log('\nPooler connection failed. Trying direct connection...');
    const directClient = new pg.Client({
      host: 'db.djkcnvxnkgmxromarjnf.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: SERVICE_ROLE_KEY,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await directClient.connect();
      console.log('✅ Connected via direct connection!\n');
      const sql = readFileSync('supabase/migrations/20260322_collaboration_workflow.sql', 'utf-8');
      await directClient.query(sql);
      console.log('✅ Migration executed successfully!');
      await directClient.end();
    } catch (err2) {
      console.error('❌ Direct connection also failed:', err2.message);
      console.log('\n💡 DB 비밀번호가 필요합니다. Supabase Dashboard > Settings > Database에서 확인해주세요.');
    }
  }
} finally {
  await client.end().catch(() => {});
}
