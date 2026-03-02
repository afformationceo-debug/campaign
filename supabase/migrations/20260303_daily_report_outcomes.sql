ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS impact_summary TEXT,
  ADD COLUMN IF NOT EXISTS support_needed TEXT;
