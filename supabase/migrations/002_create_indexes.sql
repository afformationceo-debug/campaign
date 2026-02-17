-- ============================================
-- 어포메이션 CMS - 002: 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_daily_checks_date ON daily_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_daily_checks_campaign ON daily_checks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_daily_checks_task ON daily_checks(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_checks_user ON daily_checks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checks_status ON daily_checks(status);
CREATE INDEX IF NOT EXISTS idx_daily_checks_composite ON daily_checks(check_date, campaign_id, task_id);
CREATE INDEX IF NOT EXISTS idx_ctc_campaign ON campaign_task_config(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ctc_applicable ON campaign_task_config(campaign_id, is_applicable);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_configs_campaign ON campaign_configs(campaign_id);
