-- 012: 캠페인 유형 구분 (해외마케팅 / 국내챗닥)
-- 기존 캠페인은 모두 '해외마케팅'으로 기본 설정

-- 캠페인 유형
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT '해외마케팅';

-- 국내챗닥 전용 필드
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS chatdoc_onboarding_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chatdoc_roas_target NUMERIC,
  ADD COLUMN IF NOT EXISTS chatdoc_status TEXT DEFAULT '대기';
