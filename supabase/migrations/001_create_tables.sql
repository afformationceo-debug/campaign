-- ============================================
-- 어포메이션 CMS - 001: 테이블 생성
-- ============================================

-- 1. campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  target_country TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed')),
  phase TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (phase IN ('onboarding', 'running', 'scaling')),
  budget NUMERIC,
  start_date DATE,
  homepage_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_order INTEGER UNIQUE NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  tool TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('보고','영업','온보딩','발송','CS-인플','CS-고객','CRM','컨텐츠','회계')),
  default_assignees TEXT[],
  frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (frequency IN ('daily','weekly','monthly','once','as_needed')),
  day_of_week INTEGER[],
  is_applicable_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member')),
  position TEXT,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. campaign_task_config (핵심)
CREATE TABLE IF NOT EXISTS campaign_task_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  is_applicable BOOLEAN NOT NULL DEFAULT true,
  override_assignee TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, task_id)
);

-- 5. daily_checks
CREATE TABLE IF NOT EXISTS daily_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT '미완료'
    CHECK (status IN ('완료','진행중','미완료','해당없음')),
  assigned_user_id UUID REFERENCES users(id),
  note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, task_id, check_date)
);

-- 6. campaign_configs
CREATE TABLE IF NOT EXISTS campaign_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  config_type TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_value TEXT,
  status TEXT DEFAULT '미완료',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
