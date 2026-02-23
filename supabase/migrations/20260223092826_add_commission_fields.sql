-- 캠페인 수수료 필드 추가 (해외마케팅용)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS vat_type TEXT DEFAULT 'VAT별도';
