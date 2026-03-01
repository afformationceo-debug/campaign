-- ============================================
-- 020: Task Improvements
-- 업무 관리 개선: 우선순위, 소요시간, SOP, 업무단계, 시간추적
-- 기존 데이터/기능에 영향 없는 additive changes만
-- ============================================

-- 1. tasks 테이블에 컬럼 추가 (모두 nullable/default)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT '보통';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes int DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS instruction_url text DEFAULT NULL;

-- 2. daily_checks 테이블에 started_at 추가
ALTER TABLE daily_checks ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT NULL;

-- 3. task_steps 테이블 신규 생성
CREATE TABLE IF NOT EXISTS task_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 1,
  step_name text NOT NULL,
  step_description text,
  tool_url text,
  created_at timestamptz DEFAULT now()
);

-- 4. task_steps 인덱스
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_order ON task_steps(task_id, step_order);

-- 5. task_steps RLS 정책
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_steps_select_authenticated" ON task_steps
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "task_steps_insert_authenticated" ON task_steps
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "task_steps_update_authenticated" ON task_steps
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "task_steps_delete_authenticated" ON task_steps
  FOR DELETE TO authenticated
  USING (true);
