-- ============================================
-- 20260406: Project Roadmap Improvements
-- 1. Priority field for projects and tasks
-- 2. parent_project_id for 3-level hierarchy
-- 3. RLS policy cleanup (all auth CRUD, admin-only delete)
-- ============================================

-- 1. Priority field
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '보통';
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '보통';

-- 2. 3-level hierarchy support
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);

-- 3. assignee_ids array (may already exist from frontend code)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}'::uuid[];

-- Migrate existing assignee_id data
UPDATE projects SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');
UPDATE project_tasks SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');

-- 4. RLS policy cleanup: all authenticated can INSERT/UPDATE, admin-only DELETE
-- Drop potentially conflicting policies
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS project_tasks_insert ON project_tasks;
DROP POLICY IF EXISTS project_tasks_update ON project_tasks;

-- Recreate unified policies
DO $$ BEGIN CREATE POLICY projects_insert_auth ON projects FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY projects_update_auth ON projects FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY project_tasks_insert_auth ON project_tasks FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY project_tasks_update_auth ON project_tasks FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- DELETE policies remain admin-only (from 007)
