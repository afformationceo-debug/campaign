-- ============================================
-- 어포메이션 CMS - 003: 트리거 생성
-- ============================================

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_daily_checks_updated BEFORE UPDATE ON daily_checks
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_ctc_updated BEFORE UPDATE ON campaign_task_config
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_configs_updated BEFORE UPDATE ON campaign_configs
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- 완료 시각 자동 기록
CREATE OR REPLACE FUNCTION fn_set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = '완료' AND (OLD.status IS NULL OR OLD.status != '완료') THEN
    NEW.completed_at = now();
  ELSIF NEW.status != '완료' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_completed BEFORE UPDATE ON daily_checks
  FOR EACH ROW EXECUTE FUNCTION fn_set_completed_at();

-- 캠페인 생성 시 campaign_task_config 자동 생성
CREATE OR REPLACE FUNCTION fn_create_task_config_for_campaign()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO campaign_task_config (campaign_id, task_id, is_applicable)
  SELECT NEW.id, t.id, t.is_applicable_default
  FROM tasks t;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaign_created AFTER INSERT ON campaigns
  FOR EACH ROW EXECUTE FUNCTION fn_create_task_config_for_campaign();

-- Task 추가 시 모든 active 캠페인에 config 자동 생성
CREATE OR REPLACE FUNCTION fn_create_config_for_new_task()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO campaign_task_config (campaign_id, task_id, is_applicable)
  SELECT c.id, NEW.id, NEW.is_applicable_default
  FROM campaigns c
  WHERE c.status = 'active';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_created AFTER INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_create_config_for_new_task();
