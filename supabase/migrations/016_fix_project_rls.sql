-- ============================================
-- 016: Fix project/project_tasks RLS policies
-- Allow all authenticated users to update (not just admins)
-- so that assignees can enter result_value, change status, etc.
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS project_tasks_update ON project_tasks;

-- Recreate with broader access (all authenticated users can update)
CREATE POLICY projects_update ON projects FOR UPDATE USING (true);
CREATE POLICY project_tasks_update ON project_tasks FOR UPDATE USING (true);
