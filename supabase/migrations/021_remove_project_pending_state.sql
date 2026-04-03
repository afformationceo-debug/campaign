-- 프로젝트/하위업무에서 '진행전' 상태 제거 → 기본값을 '진행중'으로 변경
-- 기존 '진행전' 데이터를 '진행중'으로 마이그레이션

-- 1. 기존 데이터 업데이트
UPDATE projects SET state = '진행중' WHERE state = '진행전';
UPDATE project_tasks SET state = '진행중' WHERE state = '진행전';

-- 2. projects 테이블: CHECK 제약 변경 + 기본값 변경
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_state_check;
ALTER TABLE projects ADD CONSTRAINT projects_state_check CHECK (state IN ('진행중', '완료'));
ALTER TABLE projects ALTER COLUMN state SET DEFAULT '진행중';

-- 3. project_tasks 테이블: CHECK 제약 변경 + 기본값 변경
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_state_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_state_check CHECK (state IN ('진행중', '완료'));
ALTER TABLE project_tasks ALTER COLUMN state SET DEFAULT '진행중';
