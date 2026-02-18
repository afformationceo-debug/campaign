-- Add cost tracking columns to campaigns table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS monthly_fixed_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_per_influencer NUMERIC,
  ADD COLUMN IF NOT EXISTS influencer_fee_budget NUMERIC;

COMMENT ON COLUMN campaigns.monthly_fixed_cost IS '월 고정비용';
COMMENT ON COLUMN campaigns.cost_per_influencer IS '인플루언서 섭외당 비용';
COMMENT ON COLUMN campaigns.influencer_fee_budget IS '인플루언서 원고료 예산';
