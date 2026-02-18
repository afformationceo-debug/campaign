-- ============================================
-- 007: Projects & Project Tasks
-- ============================================

-- 프로젝트 상태 타입
-- '진행전' | '진행중' | '완료'

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  url TEXT,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  state TEXT NOT NULL DEFAULT '진행전' CHECK (state IN ('진행전', '진행중', '완료')),
  memo TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '진행전' CHECK (state IN ('진행전', '진행중', '완료')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  sort_order INTEGER DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_state ON projects(state);
CREATE INDEX IF NOT EXISTS idx_projects_assignee ON projects(assignee_id);
CREATE INDEX IF NOT EXISTS idx_projects_due_date ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_state ON project_tasks(state);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON project_tasks(assignee_id);

-- Triggers: auto-update updated_at
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_project_tasks_updated_at ON project_tasks;
CREATE TRIGGER trg_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users
DO $$ BEGIN
  CREATE POLICY projects_select ON projects FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY project_tasks_select ON project_tasks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Write: admin only
DO $$ BEGIN CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (is_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY projects_update ON projects FOR UPDATE USING (is_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY projects_delete ON projects FOR DELETE USING (is_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY project_tasks_insert ON project_tasks FOR INSERT WITH CHECK (is_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY project_tasks_update ON project_tasks FOR UPDATE USING (is_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY project_tasks_delete ON project_tasks FOR DELETE USING (is_admin()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE projects; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
