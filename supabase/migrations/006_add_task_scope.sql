-- ============================================
-- 어포메이션 CMS - 006: Task scope 추가 (global/campaign)
-- ============================================

-- 1. tasks 테이블에 scope 컬럼 추가
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'campaign'
  CHECK (scope IN ('campaign', 'global'));

-- 2. daily_checks.campaign_id를 nullable로 변경 (global task용)
ALTER TABLE daily_checks
  ALTER COLUMN campaign_id DROP NOT NULL;

-- 3. 기존 UNIQUE 제약 제거 후 재생성
-- campaign scope: (campaign_id, task_id, check_date) - campaign_id NOT NULL
-- global scope: (task_id, check_date, assigned_user_id) - campaign_id IS NULL
ALTER TABLE daily_checks DROP CONSTRAINT IF EXISTS daily_checks_campaign_id_task_id_check_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS daily_checks_campaign_unique
  ON daily_checks (campaign_id, task_id, check_date)
  WHERE campaign_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS daily_checks_global_unique
  ON daily_checks (task_id, check_date, assigned_user_id)
  WHERE campaign_id IS NULL;
