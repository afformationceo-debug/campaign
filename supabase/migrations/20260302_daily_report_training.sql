-- ═══════════════════════════════════════════
-- 1) 교육 이수 추적 테이블
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_trained BOOLEAN NOT NULL DEFAULT false,
  trained_at TIMESTAMPTZ,
  trainer_id UUID REFERENCES users(id),
  steps_confirmed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_training_user ON task_training(user_id);
CREATE INDEX idx_task_training_task ON task_training(task_id);

-- ═══════════════════════════════════════════
-- 2) 일일 보고서 테이블
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  summary TEXT,
  issues TEXT,
  tomorrow_plan TEXT,
  status TEXT NOT NULL DEFAULT '미제출' CHECK (status IN ('미제출', '제출완료', '확인완료')),
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_date)
);

CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_daily_reports_user ON daily_reports(user_id);

-- ═══════════════════════════════════════════
-- 3) Step별 완료 추적 테이블
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS step_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_check_id UUID NOT NULL REFERENCES daily_checks(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES task_steps(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  result_value TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(daily_check_id, step_id)
);

CREATE INDEX idx_step_checks_daily ON step_checks(daily_check_id);

-- ═══════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════
ALTER TABLE task_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_training_select" ON task_training FOR SELECT USING (true);
CREATE POLICY "task_training_insert" ON task_training FOR INSERT WITH CHECK (true);
CREATE POLICY "task_training_update" ON task_training FOR UPDATE USING (true);
CREATE POLICY "task_training_delete" ON task_training FOR DELETE USING (true);

CREATE POLICY "daily_reports_select" ON daily_reports FOR SELECT USING (true);
CREATE POLICY "daily_reports_insert" ON daily_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_reports_update" ON daily_reports FOR UPDATE USING (true);
CREATE POLICY "daily_reports_delete" ON daily_reports FOR DELETE USING (true);

CREATE POLICY "step_checks_select" ON step_checks FOR SELECT USING (true);
CREATE POLICY "step_checks_insert" ON step_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "step_checks_update" ON step_checks FOR UPDATE USING (true);
CREATE POLICY "step_checks_delete" ON step_checks FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE task_training;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE step_checks;
