-- Add result_value column to daily_checks table
ALTER TABLE daily_checks ADD COLUMN IF NOT EXISTS result_value text;
