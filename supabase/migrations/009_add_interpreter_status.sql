-- Add interpreter assignment status column to campaigns table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS interpreter_status TEXT DEFAULT '통역 필요 없음';

COMMENT ON COLUMN campaigns.interpreter_status IS '통역사배치여부';
