-- ============================================
-- 013: 하위 업무(Sub-Task) 지원
-- ============================================

-- 1. tasks 테이블에 부모-자식 관계 추가
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sub_order INTEGER DEFAULT 0;

-- 2. loop_order UNIQUE 제약 조정
--    서브태스크는 부모의 loop_order를 공유하므로 기존 UNIQUE 제거
--    최상위 태스크만 loop_order UNIQUE 유지
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_loop_order_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_loop_order_toplevel
  ON tasks (loop_order)
  WHERE parent_task_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_subtask_order
  ON tasks (parent_task_id, sub_order)
  WHERE parent_task_id IS NOT NULL;

-- 3. 부모-자식 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- 4. campaign_task_config에 목표 건수 컬럼 추가 (릴스 갯수 등)
ALTER TABLE campaign_task_config
  ADD COLUMN IF NOT EXISTS target_count INTEGER;
