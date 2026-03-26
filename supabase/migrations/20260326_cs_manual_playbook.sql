-- =====================================================
-- CS Manual Playbook (크몽 고객 응대 매뉴얼)
-- 3 tables: services → steps → templates
-- =====================================================

-- 1. 서비스 카테고리 (탭)
CREATE TABLE IF NOT EXISTS cs_manual_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📋',
  punch_label TEXT,
  punch_title TEXT,
  punch_description TEXT,
  punch_gradient TEXT,
  form_fields JSONB DEFAULT '[]',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 퍼널 단계 (OB + STEP 1~N)
CREATE TABLE IF NOT EXISTS cs_manual_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES cs_manual_services(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL DEFAULT 'funnel',
  step_number TEXT NOT NULL,
  title TEXT NOT NULL,
  tag TEXT,
  tag_color TEXT DEFAULT 'orange',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 개별 템플릿 메시지
CREATE TABLE IF NOT EXISTS cs_manual_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES cs_manual_steps(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  tip TEXT,
  sort_order INT DEFAULT 0,
  author_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cs_manual_steps_service ON cs_manual_steps(service_id);
CREATE INDEX idx_cs_manual_templates_step ON cs_manual_templates(step_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_cs_manual_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cs_manual_services_updated
  BEFORE UPDATE ON cs_manual_services
  FOR EACH ROW EXECUTE FUNCTION update_cs_manual_updated_at();

CREATE TRIGGER trg_cs_manual_steps_updated
  BEFORE UPDATE ON cs_manual_steps
  FOR EACH ROW EXECUTE FUNCTION update_cs_manual_updated_at();

CREATE TRIGGER trg_cs_manual_templates_updated
  BEFORE UPDATE ON cs_manual_templates
  FOR EACH ROW EXECUTE FUNCTION update_cs_manual_updated_at();

-- RLS
ALTER TABLE cs_manual_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_manual_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_manual_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_manual_services_select" ON cs_manual_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs_manual_services_insert" ON cs_manual_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cs_manual_services_update" ON cs_manual_services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cs_manual_services_delete" ON cs_manual_services FOR DELETE TO authenticated USING (true);

CREATE POLICY "cs_manual_steps_select" ON cs_manual_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs_manual_steps_insert" ON cs_manual_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cs_manual_steps_update" ON cs_manual_steps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cs_manual_steps_delete" ON cs_manual_steps FOR DELETE TO authenticated USING (true);

CREATE POLICY "cs_manual_templates_select" ON cs_manual_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs_manual_templates_insert" ON cs_manual_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cs_manual_templates_update" ON cs_manual_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cs_manual_templates_delete" ON cs_manual_templates FOR DELETE TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE cs_manual_services;
ALTER PUBLICATION supabase_realtime ADD TABLE cs_manual_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE cs_manual_templates;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Service 1: 인플루언서 마케팅
INSERT INTO cs_manual_services (id, name, icon, punch_label, punch_title, punch_description, punch_gradient, form_fields, sort_order)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  '인플루언서 마케팅', '🏥',
  '아웃바운드 콜드 메시지',
  '아직 해외 인플루언서 마케팅 안 해보셨다면, 지금이 가장 빠른 타이밍입니다.',
  '아래 메시지를 크몽·인스타DM·카카오톡·이메일 등 채널에 맞춰 발송합니다. 핵심은 "우리가 전부 해드린다 + 확인만 하시면 된다"는 메시지입니다.',
  'linear-gradient(135deg, #FF6B35 0%, #E85D2A 100%)',
  '[{"key":"브랜드/병원/매장명","type":"text"},{"key":"희망 국가","type":"text"},{"key":"인플루언서 규모","type":"select","options":["체험단","마이크로","매크로","메가"]},{"key":"희망 인플루언서 수","type":"text"},{"key":"희망 플랫폼","type":"select","options":["Instagram","TikTok","YouTube","샤오홍슈","트위터"]},{"key":"서비스 유형","type":"select","options":["방문형","제품형","둘 다"]},{"key":"업종","type":"text"},{"key":"기타","type":"text"}]',
  0
);

-- Service 2: 마케팅 솔루션 도입
INSERT INTO cs_manual_services (id, name, icon, punch_label, punch_title, punch_description, punch_gradient, form_fields, sort_order)
VALUES (
  'a1000000-0000-0000-0000-000000000002',
  '마케팅 솔루션 도입', '📊',
  '아웃바운드 콜드 메시지',
  '인플루언서 마케팅, 아직 수작업으로 하고 계신가요? 모집부터 발송, 관리까지 한 플랫폼에서.',
  '인플루언서 서치·캠페인 발송·인박스 관리·콘텐츠 수집 — 전부 자동화됩니다. 7일 무료 데모로 직접 경험해보세요. 써보시면 다릅니다.',
  'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
  '[{"key":"사용 국가/시장","type":"text"},{"key":"운영 플랫폼","type":"select","options":["인스타그램","틱톡","유튜브","블로그"]},{"key":"월 캠페인 수","type":"select","options":["1~3개","5개 이상","미정"]},{"key":"필요 기능","type":"select","options":["서치","발송","인박스","콘텐츠","리포트"]},{"key":"현재 운영방식","type":"select","options":["직접 섭외","대행사","없음"]},{"key":"도입 시기","type":"select","options":["즉시","1개월 내","3개월 내","검토 중"]}]',
  1
);

-- Service 3: 앱·웹·플랫폼 개발
INSERT INTO cs_manual_services (id, name, icon, punch_label, punch_title, punch_description, punch_gradient, form_fields, sort_order)
VALUES (
  'a1000000-0000-0000-0000-000000000003',
  '앱·웹·플랫폼 개발', '💻',
  '아웃바운드 콜드 메시지',
  '앱이든 웹이든 플랫폼이든, "이런 거 만들 수 있나요?" 한마디면 됩니다.',
  '기획부터 디자인·개발·배포까지 원스톱으로 진행해드립니다. 벤치마크 없어도, 예산 미정이어도 — 견적부터 먼저 드립니다.',
  'linear-gradient(135deg, #059669 0%, #0D9488 100%)',
  '[{"key":"프로젝트 유형","type":"select","options":["웹사이트","쇼핑몰","플랫폼","앱","관리자페이지","리뉴얼"]},{"key":"벤치마크 URL","type":"text"},{"key":"필요 기능","type":"select","options":["로그인","결제","예약","채팅","관리자","자동화","다국어"]},{"key":"예산 범위","type":"text"},{"key":"희망 런칭 시기","type":"select","options":["1개월 내","2~3개월","미정"]},{"key":"디자인 포함 여부","type":"select","options":["포함","별도 진행","시안 있음"]},{"key":"기타","type":"text"}]',
  2
);

-- =====================================================
-- STEPS + TEMPLATES: 인플루언서 마케팅
-- =====================================================

-- OB: 아웃바운드 첫 컨택
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'outbound', 'OB', '아웃바운드 첫 컨택 — 콜드 메시지', '신규 영업', 'orange', 0);

INSERT INTO cs_manual_templates (step_id, label, content, variables, tip, sort_order) VALUES
('b1000000-0000-0000-0000-000000000001', '✉ 크몽 / 카카오톡 / 이메일용 (풀버전)',
'안녕하세요, {담당자명} 님!
어포메이션 방선준입니다.

{브랜드명} 보고 연락드렸습니다.

요즘 {업종} 쪽에서 해외 인플루언서 마케팅으로
실제 매출을 만들고 계신 곳들이 빠르게 늘고 있어서,
혹시 관심 있으실까 해서 먼저 연락드렸어요.

저희가 하는 일은 심플합니다.
인플루언서 찾고, 섭외하고, 방문 일정까지 전부 잡아드리고
고객사는 확인만 해주시면 됩니다.

해외 마케팅 경험이 없으셔도, 통역이 없으셔도 괜찮습니다.
전 과정을 저희가 대행하고 있어요.

대만·일본·중국·영미권 등 원하시는 국가 어디든 가능하고,
비용도 부담 없이 시작하실 수 있는 구조입니다.

혹시 관심 있으시면 간단히 회신만 주세요.
맞춤으로 안내드리겠습니다 :)',
'[{"key":"담당자명","label":"담당자명","default":"담당자"},{"key":"브랜드명","label":"브랜드명","default":""},{"key":"업종","label":"업종","default":""}]',
'💡 콜드 메시지 핵심: ① 왜 연락했는지 (브랜드명 언급) ② 우리가 뭘 해주는지 (1문장) ③ 고객은 뭘 하면 되는지 (확인만). 3가지만 전달하면 됩니다.',
0),
('b1000000-0000-0000-0000-000000000001', '✉ 인스타 DM / 짧은 채널용 (숏버전)',
'안녕하세요! {브랜드명} 보고 연락드린 어포메이션 방선준입니다.

해외 인플루언서 마케팅에 관심 있으실까 해서요.
인플루언서 섭외부터 방문 일정까지 전부 저희가 진행하고,
고객사는 확인만 해주시면 되는 구조예요.

관심 있으시면 편하게 회신 주세요!
맞춤으로 안내드리겠습니다 :)',
'[{"key":"브랜드명","label":"브랜드명","default":""}]',
NULL, 1);

-- STEP 1: 첫 인바운드 문의
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 'funnel', '1', '첫 인바운드 문의 — 자동응답 + 정보 수집', '첫 응대', 'orange', 1);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000010', '✉ 발송 멘트',
'안녕하세요, 반갑습니다!
어포메이션에서 인플루언서 마케팅을 총괄하고 있는 방선준입니다.

해외 마케팅 경험이 없으셔도 괜찮습니다.
인플루언서 찾고, 연락하고, 섭외하고, 방문 일정 잡는 것까지
저희가 전부 진행해드립니다.

진행 방식도 심플합니다.
저희가 직접 섭외를 완료한 후
인플루언서 예약 정보를 전달드리면
확인만 해주시면 됩니다.

원고비가 별도로 발생하는 인플루언서의 경우에도
섭외 전에 비용을 미리 안내드리기 때문에
부담 없이 결정하시면 됩니다.

서비스는 크게 두 가지 방식으로 진행됩니다.
🏥 방문형 마케팅 — 병원·매장·체험 콘텐츠
📦 제품형 마케팅 — 제품 배송 리뷰 콘텐츠

대만, 일본, 중국, 영미권은 물론이고
원하시는 국가 어디든 진행 가능합니다.

아래 내용만 간단히 남겨주시면
맞춤 컨설팅과 함께 빠르게 안내드리겠습니다 :)
———————————
1. 브랜드/병원/매장명 :
2. 희망 국가 (어디든 가능) :
3. 인플루언서 규모 : 체험단/마이크로/매크로/메가
4. 희망 인플루언서 수 :
5. 희망 플랫폼 : IG/TikTok/YouTube/샤오홍슈/트위터
———————————
잘 모르시면 비워두셔도 됩니다.
나머지는 저희가 맞춰드릴게요.', '[]', 0);

-- STEP 2: 양식 회신 후
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000001', 'funnel', '2', '양식 회신 후 — 확인 + 다음 스텝 안내', '확인 응대', 'blue', 2);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000020', '✉ 발송 멘트',
'전달주신 내용 잘 확인했습니다, 감사합니다!

{브랜드명} 쪽 {타겟국가} 타겟으로 진행 가능하며,
말씀해주신 조건에 맞춰 비용과 진행 방식을 정리해서 안내드리겠습니다.

혹시 특별히 선호하시는 인플루언서 스타일이나
콘텐츠 톤앤매너가 있으시면 미리 말씀해주시면
더 정확하게 안내드릴 수 있어요.

영업일 기준 1~2일 내로 맞춤 안내서를 전달드리겠습니다!',
'[{"key":"브랜드명","label":"브랜드명","default":""},{"key":"타겟국가","label":"타겟국가","default":""}]', 0);

-- STEP 3: 가격 문의
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000001', 'funnel', '3', '가격 문의 — 비용 구조 안내', '가격 문의', 'yellow', 3);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000030', '✉ 발송 멘트',
'비용 관련해서 안내드리겠습니다.

기본 섭외 비용은 건당 {견적}원이며,
희망하시는 등급 및 수량에 따라 조율도 가능합니다.

다만 마이크로~메가 등급 인플루언서의 경우
별도 원고비를 요구하는 경우가 있어요.
이 부분은 섭외 진행 전에 미리 안내드리고,
동의해주신 경우에만 진행하기 때문에
예상치 못한 비용이 발생하는 일은 없습니다.

통역 서비스가 필요하신 경우 별도 비용이 발생하며,
이 부분도 사전에 안내드리고 있습니다.

월 운용 가능한 예산 범위를 말씀해주시면
그 안에서 가장 효과적인 조합으로 제안드릴 수 있어요!',
'[{"key":"견적","label":"견적 금액","default":""}]', 0);

-- STEP 4: 비용 부담
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000040', 'a1000000-0000-0000-0000-000000000001', 'funnel', '4', '"비용이 부담돼요" — 예산 맞춤 제안', '비용 거부', 'red', 4);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000040', '✉ 발송 멘트',
'충분히 이해합니다.
처음 시작하시는 단계에서 비용이 고민되시는 건 당연해요.

그래서 저희는 소규모 테스트부터 가능하도록 설계하고 있습니다.

예를 들어 체험단 등급 {테스트수}명으로 먼저 시작하시고,
반응을 보신 다음에 확대 여부를 결정하시는 방법도 있어요.

이 경우 예산은 {테스트견적} 정도로 진행 가능합니다.

소규모로 시작하더라도 콘텐츠가 쌓이는 건 동일하기 때문에
장기적으로 보면 충분히 효과가 있습니다.

혹시 생각하고 계신 예산 범위를 말씀해주시면
그 안에서 최적의 조합을 제안드릴게요!',
'[{"key":"테스트수","label":"테스트 인원수","default":"3~5"},{"key":"테스트견적","label":"테스트 견적","default":""}]', 0);

-- STEP 5: 효과 의심
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000050', 'a1000000-0000-0000-0000-000000000001', 'funnel', '5', '"효과가 있나요?" — 성과·사례 안내', '효과 의심', 'purple', 5);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000050', '✉ 발송 멘트',
'효과에 대해 궁금하신 거 충분히 이해합니다.
처음 시작하시는 거라 더 신중하실 수밖에 없으시죠.

저희 경험상 체험단~마이크로 등급 인플루언서 10명 정도 섭외 시
실제 매출 견인으로 이어지는 경우가 많았습니다.

인플루언서 마케팅의 장점은
단순 광고가 아니라 실제 경험 기반 콘텐츠가 쌓인다는 점이에요.
한 번 올라간 콘텐츠는 계속 노출되기 때문에
시간이 지날수록 자산처럼 작동합니다.

비슷한 업종에서 진행했던 사례가 궁금하시면
말씀해주세요, 공유드리겠습니다!

첫 진행이시라면 소규모로 테스트하시고
반응을 보시면서 확대하시는 방법을 추천드려요.', '[]', 0);

-- STEP 6: 보류
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000060', 'a1000000-0000-0000-0000-000000000001', 'funnel', '6', '"생각해볼게요 / 내부 논의 필요" — 의사결정 촉진', '보류', 'yellow', 6);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000060', '✉ 발송 멘트',
'네, 물론이죠! 내부적으로 충분히 검토하시는 게 좋습니다.

혹시 내부 보고에 필요한 자료가 있으시면
저희가 정리해서 보내드릴 수 있어요.

예를 들어,
- 서비스 소개서 (진행 방식, 비용 구조 요약)
- 비슷한 업종 진행 사례
- 예상 일정표

이런 자료들 필요하시면 말씀만 해주세요.
원장님(대표님)께 공유하시기 편하게 정리해드리겠습니다.

검토 끝나시면 편하게 연락주세요!
언제든 바로 세팅 가능한 상태입니다.', '[]', 0);

-- STEP 7: 상세 문의 (3 templates)
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000070', 'a1000000-0000-0000-0000-000000000001', 'funnel', '7', '진행 기간 / 통역 / 부가 서비스 문의', '상세 문의', 'blue', 7);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000070', '✉ 진행 기간 문의 시',
'진행 기간 관련해서 안내드립니다.

목표 예약건(인플루언서 방문 예약) 기준으로
보통 {기간} 정도면 섭외가 마무리됩니다.

다만 방문 후 콘텐츠 업로드까지는
인플루언서분들의 방한 일정에 따라 달라지는데,
넉넉히 2~3개월의 리드타임이 있다고 생각해주시면 됩니다.

시작 시점을 말씀해주시면 그에 맞춰 일정표 정리해서 공유드릴게요!',
'[{"key":"기간","label":"섭외 소요 기간","default":"2~4주"}]', 0),
('b1000000-0000-0000-0000-000000000070', '✉ 통역 서비스 문의 시',
'원내에 통역 인력이 없으셔도 걱정 안 하셔도 됩니다.
인플루언서 방문 시 통역 서비스를 별도로 제공해드리고 있어요.

통역 비용은 {통역비용}이며,
방문 일정에 맞춰 통역사를 배정해드립니다.

참고로 한국어가 가능한 인플루언서도 있어서
그런 분들 위주로 섭외를 진행하면
통역 없이도 원활한 소통이 가능하고 비용 절감 효과도 있습니다.

어떤 방식이 더 맞으실지는
상황에 맞춰 저희가 제안드릴게요!',
'[{"key":"통역비용","label":"통역 비용","default":""}]', 1),
('b1000000-0000-0000-0000-000000000070', '✉ 타겟 국가 추가·변경 문의 시',
'{추가국가} 쪽도 당연히 진행 가능합니다!

국가별로 잘 먹히는 플랫폼이 조금씩 다른데,
예를 들어 대만·일본은 Instagram, 중국은 샤오홍슈,
영미권은 TikTok·YouTube가 효과가 좋은 편입니다.

{추가국가} 타겟도 같이 진행해드릴까요?
동시에 진행하면 비용·일정 양쪽으로 효율적이에요!',
'[{"key":"추가국가","label":"추가 국가","default":""}]', 2);

-- STEP 8: 대행사
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000080', 'a1000000-0000-0000-0000-000000000001', 'funnel', '8', '대행사/제3자가 대신 문의한 경우', '대행사', 'purple', 8);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000080', '✉ 발송 멘트',
'안녕하세요, 연락 감사드립니다!

{의뢰사명} 마케팅을 담당하고 계시는 거군요.
대행사분들과도 자주 협업하고 있어서 편하게 진행하시면 됩니다.

진행 구조는 동일합니다.
저희가 인플루언서 섭외를 직접 진행하고,
예약이 확정되면 방문 정보를 공유드리는 방식이에요.

결과 리포트도 전달드리기 때문에
원장님(대표님)께 보고하실 때 활용하시기 좋으실 거예요.

아래 내용만 간단히 전달주시면 바로 세팅 들어가겠습니다!
———————————
1. 의뢰사(병원/매장)명 :
2. 희망 국가 :
3. 희망 인플루언서 규모·수 :
4. 희망 플랫폼 :
5. 월 예산 범위 (미정이면 "협의"로) :
———————————',
'[{"key":"의뢰사명","label":"의뢰사명","default":""}]', 0);

-- STEP 9: 클로징
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000090', 'a1000000-0000-0000-0000-000000000001', 'funnel', '9', '계약 직전 — 최종 클로징', '클로징', 'red', 9);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000090', '✉ 발송 멘트',
'진행 결정해주셔서 감사합니다!

계약은 간단한 업무 협약서 형태로 진행되며,
서명 후 바로 {타겟국가} 타겟 섭외를 시작합니다.

견적 기준으로 총 비용은 {견적}이며,
계약서 초안을 보내드릴 테니 확인 부탁드리겠습니다.

수정이 필요한 부분 있으시면 편하게 말씀해주세요.
확인 완료되시면 바로 서명 진행하고 착수하겠습니다!',
'[{"key":"타겟국가","label":"타겟 국가","default":""},{"key":"견적","label":"견적 금액","default":""}]', 0);

-- STEP 10: 리마인드
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000100', 'a1000000-0000-0000-0000-000000000001', 'funnel', '10', '무응답 / 장기 미결 — 리마인드', '리마인드', 'yellow', 10);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b1000000-0000-0000-0000-000000000100', '✉ 1차 리마인드 (3~5일 후)',
'안녕하세요, 지난번에 인플루언서 마케팅 문의 주셨던 분 맞으시죠? :)

검토가 어떻게 진행되고 계신지 확인차 연락드렸습니다.
혹시 추가로 궁금한 점이 있으시거나
조건을 다시 살펴보고 싶으신 부분이 있으시면
편하게 말씀해주세요.

진행 희망하시면 바로 섭외 시작 가능한 상태입니다!', '[]', 0),
('b1000000-0000-0000-0000-000000000100', '✉ 2차 리마인드 (1~2주 후)',
'안녕하세요! 이전에 해외 인플루언서 마케팅 관련해서 대화 나눴었는데요.

혹시 타이밍이 안 맞으셨거나 다른 고민이 생기셨으면
편하게 말씀해주세요. 조건 조정도 가능합니다.

참고로 지금 {타겟국가} 쪽 인플루언서 섭외 가능 풀이 좋은 상태라
빠른 시작이 유리한 시점이기도 합니다.

언제든 편하게 연락주세요!',
'[{"key":"타겟국가","label":"타겟 국가","default":""}]', 1);

-- =====================================================
-- STEPS + TEMPLATES: 마케팅 솔루션 도입
-- =====================================================

-- OB
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'outbound', 'OB', '아웃바운드 첫 컨택 — 솔루션 도입 제안', '신규 영업', 'orange', 0);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b2000000-0000-0000-0000-000000000001', '✉ 풀버전',
'안녕하세요, {담당자명} 님!
어포메이션 방선준입니다.

{브랜드명}에서 인플루언서 마케팅을 운영하고 계신 걸로 보고 연락드렸습니다.

혹시 인플루언서 서치, DM 발송, 콘텐츠 관리를
아직 수작업으로 진행하고 계신가요?

저희가 운영하고 있는 마케팅 솔루션을 활용하시면
모집부터 발송, 인박스 관리, 콘텐츠 수집, 분석 리포트까지
한 플랫폼에서 자동으로 운영하실 수 있습니다.

현재 7일 무료 데모를 제공하고 있어서,
직접 사용해보신 후 결정하실 수 있어요.

관심 있으시면 편하게 회신 주세요.
맞춤 데모 세팅과 함께 안내드리겠습니다!',
'[{"key":"담당자명","label":"담당자명","default":"담당자"},{"key":"브랜드명","label":"브랜드명","default":""}]', 0),
('b2000000-0000-0000-0000-000000000001', '✉ 숏버전 (DM용)',
'안녕하세요! {브랜드명} 보고 연락드린 어포메이션입니다.

인플루언서 서치·발송·관리를 한 플랫폼에서 운영하실 수 있는
마케팅 솔루션을 제안드리고 싶어서요.

7일 무료 데모 가능합니다 — 관심 있으시면 회신 주세요!',
'[{"key":"브랜드명","label":"브랜드명","default":""}]', 1);

-- STEP 1~5 솔루션
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b2000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 'funnel', '1', '첫 문의 — 니즈 파악 + 양식 수집', '첫 응대', 'orange', 1);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b2000000-0000-0000-0000-000000000010', '✉ 발송 멘트',
'안녕하세요! 솔루션에 관심 가져주셔서 감사합니다 :)

저희 솔루션은 인플루언서 서치부터 캠페인 발송, 인박스 관리, 콘텐츠 수집까지
모든 과정을 하나의 플랫폼에서 운영할 수 있도록 구성되어 있습니다.

도입 전 7일 무료 데모를 제공해드리고 있어서,
직접 사용해보신 후 결정하실 수 있어요!

맞춤 견적 제안을 위해 아래 내용을 알려주시면 도움이 됩니다.
———————————
1. 주로 사용할 국가/시장 :
2. 운영할 플랫폼 : IG/TikTok/YouTube/블로그
3. 월 예상 캠페인 수 :
4. 필요 기능 : 서치/발송/인박스/콘텐츠/리포트
5. 현재 운영 방식 : 직접 섭외/대행사/없음
6. 도입 희망 시기 :
———————————', '[]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b2000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000002', 'funnel', '2', '양식 수신 후 — 데모 제안', '데모 유도', 'blue', 2);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b2000000-0000-0000-0000-000000000020', '✉ 발송 멘트',
'내용 잘 받았습니다! 말씀해주신 조건 바탕으로 검토했습니다.

우선 7일 무료 데모를 먼저 사용해보시길 권장드립니다.
데모 기간 동안 실제 서치/발송/콘텐츠 수집 기능을 직접 경험해보실 수 있어요.

데모 신청 시 아래 정보만 추가로 부탁드립니다.
- 담당자 성함 / 직책
- 회사명 / 브랜드명
- 연락처

데모 계정 세팅 후 접속 링크와 가이드를 바로 발송해드리겠습니다!', '[]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b2000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000002', 'funnel', '3', '기능·견적 상세 문의 — 맞춤 견적 제안', '견적 제안', 'green', 3);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b2000000-0000-0000-0000-000000000030', '✉ 발송 멘트',
'말씀해주신 운영 방식과 필요 기능을 기반으로
맞춤 견적서를 준비해드리겠습니다.

저희 플랜은 사용 국가 수, 캠페인 발송량, 필요 기능 구성에 따라 달라지기 때문에
작성해주신 내용이 정말 큰 도움이 됩니다.

견적서는 영업일 기준 1~2일 내로 발송드릴 예정이며,
궁금한 점은 언제든 편하게 문의 주세요!

필요하시면 시연 미팅도 별도로 진행 가능합니다.', '[]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b2000000-0000-0000-0000-000000000040', 'a1000000-0000-0000-0000-000000000002', 'funnel', '4', '데모 사용 후 — 전환 유도', '클로징', 'red', 4);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b2000000-0000-0000-0000-000000000040', '✉ 발송 멘트',
'데모 사용해보시니 어떠셨나요? :)

불편하거나 추가로 필요한 기능이 있으셨다면 편하게 말씀해주세요.
VOC를 기반으로 기능 개선 로드맵에 반영하거나,
현재 제공 가능한 방식으로 대안을 안내해드리겠습니다.

정식 도입 시 초기 세팅 지원 + 온보딩 가이드를 함께 제공해드리고 있으니,
도입 검토 중이시라면 편하게 말씀 주세요!', '[]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b2000000-0000-0000-0000-000000000050', 'a1000000-0000-0000-0000-000000000002', 'funnel', '5', '무응답 / 장기 미결 — 리마인드', '리마인드', 'yellow', 5);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b2000000-0000-0000-0000-000000000050', '✉ 발송 멘트',
'안녕하세요, 솔루션 도입 문의 주셨던 분 맞으시죠? :)

검토가 어떻게 진행되고 계신지 확인차 연락드렸습니다.
혹시 추가로 궁금한 기능이나 비교하시는 부분이 있으시면
편하게 말씀해주세요.

현재 신규 도입 기업 대상으로 도입 지원 혜택이 있어
빠른 결정이 유리한 시점이기도 합니다!
궁금한 점 있으시면 언제든 연락주세요.', '[]', 0);

-- =====================================================
-- STEPS + TEMPLATES: 앱·웹·플랫폼 개발
-- =====================================================

-- OB
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'outbound', 'OB', '아웃바운드 첫 컨택 — 개발 서비스 제안', '신규 영업', 'orange', 0);

INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000001', '✉ 풀버전',
'안녕하세요, {담당자명} 님!
어포메이션 개발사업부 방선준입니다.

{브랜드명}에서 {프로젝트유형} 관련 니즈가 있으신 걸로 보고
먼저 연락드렸습니다.

저희는 기획부터 디자인·개발·배포까지 원스톱으로 진행하고 있고,
웹사이트, 앱, 플랫폼, 관리자 페이지, 기존 시스템 리뉴얼까지
다양한 프로젝트를 운영해왔습니다.

"대충 이런 기능이 필요한데요" 이 정도만 말씀해주시면
저희가 구조를 잡고 견적서부터 먼저 전달드릴 수 있어요.

벤치마크가 없으셔도, 예산이 미정이셔도 괜찮습니다.
관심 있으시면 편하게 회신 주세요!',
'[{"key":"담당자명","label":"담당자명","default":"담당자"},{"key":"브랜드명","label":"브랜드명","default":""},{"key":"프로젝트유형","label":"프로젝트 유형","default":""}]', 0),
('b3000000-0000-0000-0000-000000000001', '✉ 숏버전 (DM용)',
'안녕하세요! {브랜드명} 보고 연락드린 어포메이션 개발사업부입니다.

앱·웹·플랫폼 개발을 원스톱으로 진행하고 있어요.
필요한 기능만 말씀해주시면 견적부터 먼저 드립니다.

관심 있으시면 편하게 회신 주세요 :)',
'[{"key":"브랜드명","label":"브랜드명","default":""}]', 1);

-- STEP 1~8 개발
INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000003', 'funnel', '1', '첫 문의 — 자동응답 + 의뢰서 수집', '첫 응대', 'orange', 1);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000010', '✉ 발송 멘트',
'안녕하세요, 반갑습니다!
어포메이션 개발사업부 담당입니다.

"대충 이런 게 필요한데 만들 수 있나요?"
이 한마디면 충분합니다.
기획부터 디자인·개발·배포까지 원스톱으로 진행해드리고 있습니다.

💻 웹사이트·랜딩페이지 제작
🛠 웹 플랫폼 개발 (SaaS, 교육, 커머스 등)
📱 앱 개발 (iOS/Android/하이브리드)
📋 관리자(Admin) 페이지 개발
🔄 기존 시스템 리뉴얼·기능 추가

아래 내용만 간단히 남겨주시면
견적과 함께 빠르게 안내드리겠습니다 :)
———————————
1. 프로젝트 유형 : 웹/앱/플랫폼/기타
2. 벤치마크 서비스 : (있으시면 링크)
3. 주요 기능 : (로그인, 결제, 채팅 등)
4. 예산 범위 : (미정이면 "견적 먼저"로 적어주세요)
5. 희망 일정 :
———————————
벤치마크 없어도, 기능만 말씀해주시면
저희가 구조 잡아서 견적부터 드립니다.', '[]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000003', 'funnel', '2', '양식 회신 후 — 확인 + 견적 준비 안내', '견적 준비', 'blue', 2);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000020', '✉ 발송 멘트',
'전달주신 내용 잘 확인했습니다, 감사합니다!

말씀해주신 내용 기준으로 정리하면
{프로젝트유형} 형태로, 주요 기능은 {주요기능}이 포함되는 프로젝트네요.

견적서에는 기능별 개발 범위, 예상 일정, 비용이
항목별로 나뉘어 있어서 한눈에 파악하시기 편하실 거예요.

영업일 기준 2~3일 내로 전달드리겠습니다!

혹시 추가로 넣고 싶으신 기능이나
"이건 꼭 있어야 해요" 하는 부분이 있으시면
미리 말씀해주시면 한 번에 반영해서 드리겠습니다.',
'[{"key":"프로젝트유형","label":"프로젝트 유형","default":""},{"key":"주요기능","label":"주요 기능","default":""}]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000003', 'funnel', '3', '벤치마크 없음 / 예산 미정 응대', '허들 제거', 'yellow', 3);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000030', '✉ 벤치마크 없을 때',
'벤치마크가 없으셔도 전혀 문제없습니다!

오히려 원하시는 기능 위주로 말씀해주시면
저희가 최적의 구조를 제안드릴 수 있어서 더 좋을 때도 많아요.

저희 쪽에서 화면 구성안(와이어프레임)을 간단히 잡아서
견적서와 함께 보내드리겠습니다.

"아 이런 느낌이구나" 하고 그림이 그려지실 거예요.
거기서 수정하고 싶으신 부분 말씀주시면 반영해서 최종안을 만들어드립니다!', '[]', 0),
('b3000000-0000-0000-0000-000000000030', '✉ 예산 미정 / 견적 먼저 요청 시',
'네, 견적 먼저 전달드리겠습니다!

예산이 정해져 있지 않으셔도 괜찮습니다.
저희가 기능 범위 기준으로 견적을 산출해드리고,
거기서 우선순위를 조절하면서 예산에 맞추는 방식으로 진행하면 됩니다.

견적서를 두 가지로 나눠서 드릴게요.
1) {화면1} — 사용자용 서비스 화면
2) {화면2} — 관리자(Admin) 페이지

"이 기능은 빼고, 이건 추가하고" 식으로 조절하시기 편하실 거예요.
영업일 기준 2~3일 내로 전달드릴게요.',
'[{"key":"화면1","label":"화면1 (서비스)","default":"서비스 화면"},{"key":"화면2","label":"화면2 (관리자)","default":"관리자 페이지"}]', 1);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000040', 'a1000000-0000-0000-0000-000000000003', 'funnel', '4', '견적서 전달 — 착수 유도', '클로징', 'red', 4);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000040', '✉ 발송 멘트',
'안녕하세요, {프로젝트명} 견적서 정리해서 보내드립니다.

항목별 개발 범위·예상 일정·비용을 나눠서 구성했습니다.

총 견적: {견적}
예상 개발 기간: {개발기간}

상세 내역은 첨부 파일을 확인해주세요.

"이 기능은 빼도 될 것 같아요" 또는 "이건 추가하고 싶어요"
이런 피드백 편하게 주시면 바로 반영해서 수정본 드리겠습니다.

견적서 확인 후 진행 여부 결정해주시면
다음 스텝으로 상세 기획 미팅을 잡겠습니다.',
'[{"key":"프로젝트명","label":"프로젝트명","default":""},{"key":"견적","label":"견적 금액","default":""},{"key":"개발기간","label":"개발 기간","default":""}]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000050', 'a1000000-0000-0000-0000-000000000003', 'funnel', '5', '기능 추가·변경 요청 응대', '스코프 조율', 'purple', 5);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000050', '✉ 발송 멘트',
'추가 기능 요청 확인했습니다!

{추가기능} 기능은 충분히 구현 가능합니다.
기존 견적에서 해당 기능 추가 시
추가 비용은 약 {추가견적}, 일정은 약 {추가일정} 정도 예상됩니다.

기존 견적서에 반영한 수정본을 바로 드릴까요?
아니면 다른 추가 사항도 함께 정리하신 후 한 번에 반영할까요?

한꺼번에 정리하시는 게 비용·일정 양쪽으로 더 효율적이에요.
추가로 고민 중이신 기능이 있으시면 편하게 물어봐주세요!',
'[{"key":"추가기능","label":"추가 기능","default":""},{"key":"추가견적","label":"추가 견적","default":""},{"key":"추가일정","label":"추가 일정","default":""}]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000060', 'a1000000-0000-0000-0000-000000000003', 'funnel', '6', '"생각해볼게요" — 의사결정 촉진', '보류', 'yellow', 6);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000060', '✉ 발송 멘트',
'네, 물론이죠! 충분히 검토하시는 게 좋습니다.

혹시 내부 보고에 필요한 자료가 있으시면
견적서 외에 서비스 소개서나 포트폴리오도 정리해서 보내드릴 수 있어요.

프로젝트 시작 시기에 따라 개발 일정이 달라질 수 있어서,
희망 런칭일이 있으시다면 역산해서 착수 시점을 잡는 것이 좋습니다.

검토 끝나시면 편하게 연락주세요!
언제든 바로 기획 미팅 세팅 가능합니다.', '[]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000070', 'a1000000-0000-0000-0000-000000000003', 'funnel', '7', '계약 확정 — 착수 안내', '착수', 'green', 7);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000070', '✉ 발송 멘트',
'진행 결정해주셔서 감사합니다!

계약서에는 개발 범위, 일정, 비용, 수정 횟수 등이 명시되어 있어서
양쪽 모두 명확한 기준 하에 진행됩니다.

총 비용은 {견적}이며,
계약서 초안을 보내드릴 테니 확인 부탁드리겠습니다.
수정이 필요한 부분 있으시면 편하게 말씀해주세요.

서명 완료되시면 바로 기획 미팅 일정 잡고
프로젝트 킥오프 하겠습니다!',
'[{"key":"견적","label":"견적 금액","default":""}]', 0);

INSERT INTO cs_manual_steps (id, service_id, section_type, step_number, title, tag, tag_color, sort_order)
VALUES ('b3000000-0000-0000-0000-000000000080', 'a1000000-0000-0000-0000-000000000003', 'funnel', '8', '무응답 / 장기 미결 — 리마인드', '리마인드', 'yellow', 8);
INSERT INTO cs_manual_templates (step_id, label, content, variables, sort_order) VALUES
('b3000000-0000-0000-0000-000000000080', '✉ 발송 멘트 (1차)',
'안녕하세요, 지난번 개발 문의 주셨던 분 맞으시죠? :)

검토가 어떻게 진행되고 계신지 확인차 연락드렸습니다.
견적이나 기능 구성에서 수정이 필요하신 부분이 있으시면
편하게 말씀해주세요.

진행 희망하시면 바로 기획 미팅 세팅 가능합니다!', '[]', 0),
('b3000000-0000-0000-0000-000000000080', '✉ 발송 멘트 (2차)',
'안녕하세요! 이전에 {프로젝트유형} 개발 관련해서 대화 나눴었는데요.

혹시 타이밍이 안 맞으셨거나 다른 고민이 생기셨으면
편하게 말씀해주세요. 견적 조정이나 기능 범위 변경도 가능합니다.

희망 런칭일이 있으시다면 역산해서
착수 시점을 잡아드리는 것도 가능하니 참고해주세요!',
'[{"key":"프로젝트유형","label":"프로젝트 유형","default":""}]', 1);
