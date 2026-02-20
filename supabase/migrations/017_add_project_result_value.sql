-- ============================================
-- 017: Ensure result_value exists on projects table
-- (may already exist if added manually; IF NOT EXISTS is safe)
-- ============================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS result_value TEXT;
