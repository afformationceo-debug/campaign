-- ============================================
-- 협업상품 관리 + 워크플로우 체크리스트
-- ============================================

-- 1. collaboration_products: 협업상품 마스터
CREATE TABLE IF NOT EXISTS collaboration_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. workflow_tasks: 워크플로우 TASK 마스터 (43개)
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number INTEGER NOT NULL UNIQUE,
  section TEXT NOT NULL CHECK (section IN ('영업', '온보딩', '인플루언서', '일반고객 CS 대행')),
  task_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. product_task_defaults: 협업상품별 디폴트 TASK 맵핑
CREATE TABLE IF NOT EXISTS product_task_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES collaboration_products(id) ON DELETE CASCADE,
  workflow_task_id UUID NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, workflow_task_id)
);

-- 4. campaign_products: 캠페인 ↔ 협업상품 연결 (다대다)
CREATE TABLE IF NOT EXISTS campaign_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES collaboration_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, product_id)
);

-- 5. campaign_workflow_checks: 캠페인×상품×TASK 실제 체크 상태
CREATE TABLE IF NOT EXISTS campaign_workflow_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES collaboration_products(id) ON DELETE CASCADE,
  workflow_task_id UUID NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT '진행전'
    CHECK (status IN ('진행전', '진행중', '완료', '해당없음')),
  note TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, product_id, workflow_task_id)
);

-- ─── Indexes ───
CREATE INDEX idx_campaign_products_campaign ON campaign_products(campaign_id);
CREATE INDEX idx_campaign_products_product ON campaign_products(product_id);
CREATE INDEX idx_campaign_workflow_checks_campaign ON campaign_workflow_checks(campaign_id);
CREATE INDEX idx_campaign_workflow_checks_product ON campaign_workflow_checks(product_id);
CREATE INDEX idx_product_task_defaults_product ON product_task_defaults(product_id);

-- ─── RLS ───
ALTER TABLE collaboration_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_task_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_workflow_checks ENABLE ROW LEVEL SECURITY;

-- Read: 인증된 사용자 전원
CREATE POLICY "collaboration_products_select" ON collaboration_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "workflow_tasks_select" ON workflow_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_task_defaults_select" ON product_task_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_products_select" ON campaign_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_workflow_checks_select" ON campaign_workflow_checks FOR SELECT TO authenticated USING (true);

-- Write: 인증된 사용자 전원 (admin 체크는 앱 레벨)
CREATE POLICY "collaboration_products_insert" ON collaboration_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "collaboration_products_update" ON collaboration_products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "collaboration_products_delete" ON collaboration_products FOR DELETE TO authenticated USING (true);

CREATE POLICY "workflow_tasks_insert" ON workflow_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "workflow_tasks_update" ON workflow_tasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "product_task_defaults_insert" ON product_task_defaults FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "product_task_defaults_update" ON product_task_defaults FOR UPDATE TO authenticated USING (true);
CREATE POLICY "product_task_defaults_delete" ON product_task_defaults FOR DELETE TO authenticated USING (true);

CREATE POLICY "campaign_products_insert" ON campaign_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_products_delete" ON campaign_products FOR DELETE TO authenticated USING (true);

CREATE POLICY "campaign_workflow_checks_insert" ON campaign_workflow_checks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_workflow_checks_update" ON campaign_workflow_checks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "campaign_workflow_checks_delete" ON campaign_workflow_checks FOR DELETE TO authenticated USING (true);

-- ─── Realtime ───
ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_products;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_products;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_workflow_checks;

-- ─── Seed: 워크플로우 TASK 43개 ───
INSERT INTO workflow_tasks (task_number, section, task_name, sort_order) VALUES
-- [영업] 1~13
(1,  '영업', '영업관리시스템 RAW DB 등록 및 문의사항 업데이트', 1),
(2,  '영업', '영업관리시스템 퍼널 업데이트', 2),
(3,  '영업', '계약시 협업상품 및 계약내용 최신화', 3),
(4,  '영업', '카카오톡 팀채팅방 개설', 4),
(5,  '영업', '카카오톡 회계채팅방 개설', 5),
(6,  '영업', '카카오톡 회계자료 전달 및 수령', 6),
(7,  '영업', '온보딩자료 포맷대로 요청 (구글드라이브)', 7),
(8,  '영업', '온보딩자료 수령시 캠페인 확인', 8),
(9,  '영업', 'CMS에 캠페인 추가', 9),
(10, '영업', 'CMS에 캠페인 세팅값 1차 삽입', 10),
(11, '영업', 'CMS에 캠페인 행위관리 적용 및 담당자 배정', 11),
(12, '영업', 'CMS에 협업상품별 프로젝트 추가', 12),
(13, '영업', 'CRM 캠페인 전용 계정 개설 및 매뉴얼 전달', 13),
-- [온보딩] 14~22
(14, '온보딩', '온보딩 점검시트 캠페인 추가', 14),
(15, '온보딩', 'SNS 및 메신저 생성', 15),
(16, '온보딩', 'SNS 및 메신저 기본 게시물 제작 및 상단고정', 16),
(17, '온보딩', '메타광고 연동', 17),
(18, '온보딩', '바이오링크 생성', 18),
(19, '온보딩', '구글맵 세팅', 19),
(20, '온보딩', '홈페이지 세팅', 20),
(21, '온보딩', '온보딩 점검시트 최신화', 21),
(22, '온보딩', 'CMS에 캠페인 세팅값 2차 삽입', 22),
-- [인플루언서] 23~38
(23, '인플루언서', '스카웃매니저 새 캠페인 등록', 23),
(24, '인플루언서', '스카웃매니저 인플 전용 메신저 생성 및 온보딩', 24),
(25, '인플루언서', '스카웃매니저 인플 전용 발송용 계정 생성 및 온보딩', 25),
(26, '인플루언서', '스카웃매니저 인박스 연동', 26),
(27, '인플루언서', '인플 협찬상품 LIST 제작', 27),
(28, '인플루언서', '인플 가이드라인 제작', 28),
(29, '인플루언서', '인플 아웃리치 DM양식 작성', 29),
(30, '인플루언서', '인플 아웃리치 이메일 양식 작성', 30),
(31, '인플루언서', '스카웃매니저 이메일 양식 등록', 31),
(32, '인플루언서', '스카웃매니저 리드 폼 관리 등록', 32),
(33, '인플루언서', 'GeeLark 가상폰 인스타그램 로그인', 33),
(34, '인플루언서', 'DM AUTO 새 캠페인 등록 및 GeeLark 연동', 34),
(35, '인플루언서', 'DM AUTO 아웃리치 DM양식 맵핑', 35),
(36, '인플루언서', '스크래퍼 인플루언서 DB를 DM AUTO에 연동', 36),
(37, '인플루언서', 'DM AUTO DM 자동발송 30건 라이브', 37),
(38, '인플루언서', '스카웃매니저 이메일 수동발송 50건 라이브', 38),
-- [일반고객 CS 대행] 39~43
(39, '일반고객 CS 대행', 'CS어드민 고객사 등록', 39),
(40, '일반고객 CS 대행', 'CS어드민 새 채널 연결', 40),
(41, '일반고객 CS 대행', 'CS어드민 일반고객 전용 메신저 등록', 41),
(42, '일반고객 CS 대행', 'CS어드민 지식베이스 세팅', 42),
(43, '일반고객 CS 대행', 'CS어드민 매크로 등록', 43)
ON CONFLICT (task_number) DO NOTHING;

-- ─── Seed: 협업상품 초기 데이터 ───
INSERT INTO collaboration_products (product_name, sort_order) VALUES
('해외환자유치상품', 1),
('인플루언서 마케팅', 2),
('홈페이지 제작', 3),
('스카웃매니저 커스텀', 4),
('유니파이 결제솔루션', 5),
('Meta 광고 대행', 6),
('일반고객 CS 대행', 7),
('TikTok Shop 운영', 8)
ON CONFLICT (product_name) DO NOTHING;

-- ─── Seed: 디폴트 맵핑 (협업상품별 필요 TASK) ───
-- 해외환자유치상품: 영업(1-13) + 온보딩(14-22)
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = '해외환자유치상품'
  AND wt.task_number BETWEEN 1 AND 22
ON CONFLICT DO NOTHING;

-- 인플루언서 마케팅: 영업(1-13) + 온보딩(14-22) + 인플루언서(23-38)
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = '인플루언서 마케팅'
  AND wt.task_number BETWEEN 1 AND 38
ON CONFLICT DO NOTHING;

-- 홈페이지 제작: 영업(1-13) + 온보딩(14-22)
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = '홈페이지 제작'
  AND wt.task_number BETWEEN 1 AND 22
ON CONFLICT DO NOTHING;

-- 스카웃매니저 커스텀: 영업(1-13) + 인플루언서(23-38)
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = '스카웃매니저 커스텀'
  AND (wt.task_number BETWEEN 1 AND 13 OR wt.task_number BETWEEN 23 AND 38)
ON CONFLICT DO NOTHING;

-- 유니파이 결제솔루션: 영업(1-13)만
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = '유니파이 결제솔루션'
  AND wt.task_number BETWEEN 1 AND 13
ON CONFLICT DO NOTHING;

-- Meta 광고 대행: 영업(1-13) + 온보딩(14-22)
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = 'Meta 광고 대행'
  AND wt.task_number BETWEEN 1 AND 22
ON CONFLICT DO NOTHING;

-- 일반고객 CS 대행: 영업(1-13) + CS대행(39-43)
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = '일반고객 CS 대행'
  AND (wt.task_number BETWEEN 1 AND 13 OR wt.task_number BETWEEN 39 AND 43)
ON CONFLICT DO NOTHING;

-- TikTok Shop 운영: 영업(1-13) + 온보딩(14-22)
INSERT INTO product_task_defaults (product_id, workflow_task_id, is_required)
SELECT cp.id, wt.id, true
FROM collaboration_products cp, workflow_tasks wt
WHERE cp.product_name = 'TikTok Shop 운영'
  AND wt.task_number BETWEEN 1 AND 22
ON CONFLICT DO NOTHING;
