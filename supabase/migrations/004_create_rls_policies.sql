-- ============================================
-- 어포메이션 CMS - 004: RLS 정책
-- ============================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_task_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 헬퍼: admin 확인
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- campaigns
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT USING (true);
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE USING (is_admin());
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE USING (is_admin());

-- tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (is_admin());
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (is_admin());

-- users
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "users_update" ON users FOR UPDATE USING (is_admin());
CREATE POLICY "users_delete" ON users FOR DELETE USING (is_admin());

-- daily_checks
CREATE POLICY "checks_select" ON daily_checks FOR SELECT USING (true);
CREATE POLICY "checks_insert" ON daily_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "checks_update" ON daily_checks FOR UPDATE
  USING (assigned_user_id = auth.uid() OR is_admin());
CREATE POLICY "checks_delete" ON daily_checks FOR DELETE USING (is_admin());

-- campaign_task_config
CREATE POLICY "ctc_select" ON campaign_task_config FOR SELECT USING (true);
CREATE POLICY "ctc_insert" ON campaign_task_config FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "ctc_update" ON campaign_task_config FOR UPDATE USING (is_admin());
CREATE POLICY "ctc_delete" ON campaign_task_config FOR DELETE USING (is_admin());

-- campaign_configs
CREATE POLICY "cc_select" ON campaign_configs FOR SELECT USING (true);
CREATE POLICY "cc_insert" ON campaign_configs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "cc_update" ON campaign_configs FOR UPDATE USING (is_admin());
CREATE POLICY "cc_delete" ON campaign_configs FOR DELETE USING (is_admin());

-- activity_logs
CREATE POLICY "logs_select" ON activity_logs FOR SELECT USING (is_admin());
CREATE POLICY "logs_insert" ON activity_logs FOR INSERT WITH CHECK (true);
