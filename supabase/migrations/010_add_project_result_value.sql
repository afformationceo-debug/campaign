-- ============================================
-- 010: Add result_value to project_tasks
-- ============================================

ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS result_value TEXT;
