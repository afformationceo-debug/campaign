-- 전역 업무 타임슬롯: daily_checks에 시작/종료 시간 컬럼 추가
-- 30분 단위 시간대 (예: '09:00', '10:30', '15:00')를 TEXT로 저장
ALTER TABLE daily_checks
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT;

-- 인덱스: 타임슬롯이 설정된 레코드 빠른 조회
CREATE INDEX IF NOT EXISTS idx_daily_checks_timeslot
  ON daily_checks (task_id, assigned_user_id)
  WHERE start_time IS NOT NULL;
