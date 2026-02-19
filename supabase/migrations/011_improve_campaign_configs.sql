-- ============================================
-- 011: Improve campaign_configs schema
-- Add value_type column for type-aware rendering
-- Add UNIQUE constraint to prevent duplicates
-- Backfill value_type for existing rows
-- ============================================

-- 1. Add value_type column
ALTER TABLE campaign_configs
  ADD COLUMN IF NOT EXISTS value_type TEXT DEFAULT 'text';

-- 2. Add uniqueness constraint (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_campaign_config_key'
  ) THEN
    ALTER TABLE campaign_configs
      ADD CONSTRAINT uq_campaign_config_key
      UNIQUE (campaign_id, config_type, config_key);
  END IF;
END $$;

-- 3. Backfill value_type based on config_key
UPDATE campaign_configs SET value_type = 'url'
WHERE config_key IN (
  '인스타그램 URL', '페이스북 URL', '트위터 URL', '틱톡 URL',
  '고객전용 라인', '고객전용 왓츠앱 링크', '홈페이지 링크', '리틀리 링크',
  '인플루언서 전용 라인 세팅', '인플루언서 전용 왓츠앱 세팅'
);

UPDATE campaign_configs SET value_type = 'status'
WHERE config_key IN (
  'CRM 등록여부', '메신저 채널 연동 여부', '구글맵 세팅여부',
  '리틀리 세팅여부', '스카웃매니저 메신저 연동', '스카웃매니저 캠페인 등록',
  '고객전용 지식베이스 세팅여부', '인플전용 지식베이스 세팅여부'
);

UPDATE campaign_configs SET value_type = 'credentials'
WHERE config_key = '플랫폼별 ID/PW';
