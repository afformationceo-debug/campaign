-- ============================================
-- 어포메이션 CMS - 005: Realtime 활성화
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE daily_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_task_config;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_configs;
