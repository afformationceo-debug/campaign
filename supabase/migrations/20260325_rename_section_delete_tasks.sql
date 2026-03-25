-- 1. 삭제할 영업 task들의 product_task_defaults 먼저 삭제 (FK 제약)
DELETE FROM product_task_defaults
WHERE workflow_task_id IN (
  SELECT id FROM workflow_tasks
  WHERE section = '영업'
    AND task_name IN (
      '영업관리시스템 RAW DB 등록 및 문의사항 업데이트',
      '영업관리시스템 퍼널 업데이트',
      '계약시 협업상품 및 계약내용 최신화',
      '카카오톡 팀채팅방 개설',
      '카카오톡 회계채팅방 개설',
      '카카오톡 회계자료 전달 및 수령',
      '온보딩자료 포맷대로 요청 (구글드라이브)',
      '온보딩자료 수령시 캠페인 확인',
      'CMS에 캠페인 추가'
    )
);

-- 2. 해당 task들의 campaign_workflow_checks 삭제
DELETE FROM campaign_workflow_checks
WHERE workflow_task_id IN (
  SELECT id FROM workflow_tasks
  WHERE section = '영업'
    AND task_name IN (
      '영업관리시스템 RAW DB 등록 및 문의사항 업데이트',
      '영업관리시스템 퍼널 업데이트',
      '계약시 협업상품 및 계약내용 최신화',
      '카카오톡 팀채팅방 개설',
      '카카오톡 회계채팅방 개설',
      '카카오톡 회계자료 전달 및 수령',
      '온보딩자료 포맷대로 요청 (구글드라이브)',
      '온보딩자료 수령시 캠페인 확인',
      'CMS에 캠페인 추가'
    )
);

-- 3. workflow_tasks에서 해당 task 삭제
DELETE FROM workflow_tasks
WHERE section = '영업'
  AND task_name IN (
    '영업관리시스템 RAW DB 등록 및 문의사항 업데이트',
    '영업관리시스템 퍼널 업데이트',
    '계약시 협업상품 및 계약내용 최신화',
    '카카오톡 팀채팅방 개설',
    '카카오톡 회계채팅방 개설',
    '카카오톡 회계자료 전달 및 수령',
    '온보딩자료 포맷대로 요청 (구글드라이브)',
    '온보딩자료 수령시 캠페인 확인',
    'CMS에 캠페인 추가'
  );

-- 4. CHECK 제약조건 변경: '영업' → 'cms세팅'
ALTER TABLE workflow_tasks DROP CONSTRAINT IF EXISTS workflow_tasks_section_check;
ALTER TABLE workflow_tasks ADD CONSTRAINT workflow_tasks_section_check
  CHECK (section IN ('cms세팅', '온보딩', '인플루언서', '일반고객 CS 대행'));

-- 5. 나머지 '영업' 섹션 task들의 section을 'cms세팅'으로 변경
UPDATE workflow_tasks SET section = 'cms세팅' WHERE section = '영업';
