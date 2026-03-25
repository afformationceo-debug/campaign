-- 워크플로우 Task에 상세매뉴얼 칼럼 추가
ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS manual_text TEXT,
  ADD COLUMN IF NOT EXISTS manual_url TEXT;
