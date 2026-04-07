-- ============================================
-- 프로덕션 적용 누락 마이그레이션 통합본
-- 적용 위치: Supabase Studio → SQL Editor → 전체 붙여넣고 Run
-- 프로젝트: djkcnvxnkgmxromarjnf
--
-- 포함:
--   1) 021_remove_project_pending_state.sql
--   2) 20260406_project_improvements.sql
--
-- ⚠️ '진행전' 데이터(project_tasks 4건)는 이미 코드 상에서 REST API로 '진행중'으로 정정 완료.
--    이 스크립트는 멱등성 보장 — 재실행 시 안전.
-- ============================================

BEGIN;

-- ─────────────────────────────────────────────
-- (1) 021_remove_project_pending_state.sql
-- ─────────────────────────────────────────────

-- 1.1 잔여 '진행전' 데이터 안전망 (이미 PATCH로 정정됐지만 멱등 보장)
UPDATE projects      SET state = '진행중' WHERE state = '진행전';
UPDATE project_tasks SET state = '진행중' WHERE state = '진행전';

-- 1.2 projects.state CHECK 제약 + 기본값
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_state_check;
ALTER TABLE projects ADD CONSTRAINT projects_state_check CHECK (state IN ('진행중', '완료'));
ALTER TABLE projects ALTER COLUMN state SET DEFAULT '진행중';

-- 1.3 project_tasks.state CHECK 제약 + 기본값
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_state_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_state_check CHECK (state IN ('진행중', '완료'));
ALTER TABLE project_tasks ALTER COLUMN state SET DEFAULT '진행중';

-- ─────────────────────────────────────────────
-- (2) 20260406_project_improvements.sql
-- ─────────────────────────────────────────────

-- 2.1 priority 컬럼
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '보통';
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '보통';

-- 2.2 3단계 계층 (parent_project_id)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);

-- 2.3 assignee_ids 배열
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}'::uuid[];

-- 기존 assignee_id → assignee_ids 마이그레이션 (빈 값만)
UPDATE projects      SET assignee_ids = ARRAY[assignee_id]
  WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');
UPDATE project_tasks SET assignee_ids = ARRAY[assignee_id]
  WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');

-- 2.4 RLS 정책 정리 (인증된 모두 INSERT/UPDATE)
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS project_tasks_insert ON project_tasks;
DROP POLICY IF EXISTS project_tasks_update ON project_tasks;

DO $$ BEGIN CREATE POLICY projects_insert_auth      ON projects      FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY projects_update_auth      ON projects      FOR UPDATE USING (true);      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY project_tasks_insert_auth ON project_tasks FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY project_tasks_update_auth ON project_tasks FOR UPDATE USING (true);      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- ─────────────────────────────────────────────
-- 검증 쿼리 (실행 후 확인)
-- ─────────────────────────────────────────────
-- SELECT state, COUNT(*) FROM projects      GROUP BY state;
-- SELECT state, COUNT(*) FROM project_tasks GROUP BY state;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='projects' AND column_name IN ('priority','parent_project_id','assignee_ids');
