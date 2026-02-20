-- ============================================
-- 어포메이션 CMS - 018: 제품브랜드 캠페인 관리 시스템
-- ============================================

-- ─── 1. campaigns 확장 (기존 테이블, nullable 추가만) ──────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_category TEXT,
  ADD COLUMN IF NOT EXISTS brand_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS brand_phase TEXT DEFAULT '기획';

-- ─── 2. ecommerce_platforms (신규 - 플랫폼 마스터) ─────────────
CREATE TABLE IF NOT EXISTS ecommerce_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name TEXT NOT NULL UNIQUE,
  available_countries TEXT[] NOT NULL,
  platform_url TEXT,
  seller_url TEXT,
  logo_emoji TEXT,
  description TEXT,
  fee_structure TEXT,
  setup_difficulty TEXT DEFAULT '보통',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. platform_manuals (신규 - 매뉴얼/지식베이스) ────────────
CREATE TABLE IF NOT EXISTS platform_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES ecommerce_platforms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  manual_type TEXT DEFAULT '세팅가이드',
  country TEXT,
  author_id UUID REFERENCES users(id),
  is_published BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. campaign_platforms (신규 - 캠페인별 플랫폼 연결) ────────
CREATE TABLE IF NOT EXISTS campaign_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  platform_id UUID REFERENCES ecommerce_platforms(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  setup_status TEXT DEFAULT '미시작',
  shop_url TEXT,
  account_info JSONB DEFAULT '{}',
  assigned_user_id UUID REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, platform_id, country)
);

-- ─── 5. tasks.category CHECK 확장 ──────────────────────────────
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
  CHECK (category IN ('보고','영업','온보딩','발송','CS-인플','CS-고객','CRM','컨텐츠','회계','이커머스'));

-- ─── 6. RLS 정책 ──────────────────────────────────────────────
ALTER TABLE ecommerce_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_select" ON ecommerce_platforms FOR SELECT USING (true);
CREATE POLICY "ep_insert" ON ecommerce_platforms FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "ep_update" ON ecommerce_platforms FOR UPDATE USING (is_admin());
CREATE POLICY "ep_delete" ON ecommerce_platforms FOR DELETE USING (is_admin());

ALTER TABLE platform_manuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_select" ON platform_manuals FOR SELECT USING (true);
CREATE POLICY "pm_insert" ON platform_manuals FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "pm_update" ON platform_manuals FOR UPDATE USING (is_admin());
CREATE POLICY "pm_delete" ON platform_manuals FOR DELETE USING (is_admin());

ALTER TABLE campaign_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select" ON campaign_platforms FOR SELECT USING (true);
CREATE POLICY "cp_insert" ON campaign_platforms FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "cp_update" ON campaign_platforms FOR UPDATE USING (is_admin());
CREATE POLICY "cp_delete" ON campaign_platforms FOR DELETE USING (is_admin());

-- ─── 7. 인덱스 ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaign_platforms_campaign ON campaign_platforms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_platforms_platform ON campaign_platforms(platform_id);
CREATE INDEX IF NOT EXISTS idx_platform_manuals_platform ON platform_manuals(platform_id);

-- ─── 8. 리얼타임 ──────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE ecommerce_platforms;
ALTER PUBLICATION supabase_realtime ADD TABLE platform_manuals;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_platforms;

-- ─── 9. 이커머스 플랫폼 시드 데이터 ────────────────────────────
INSERT INTO ecommerce_platforms (platform_name, available_countries, platform_url, seller_url, logo_emoji, description, fee_structure, setup_difficulty, sort_order)
VALUES
  ('큐텐 재팬 (Qoo10)', ARRAY['일본'], 'https://www.qoo10.jp', 'https://qsm.qoo10.jp', '🇯🇵', '일본 2,400만 회원, 여성 70%, 2030 중심 쇼핑몰', '카테고리별 6~10% + 해외셀러 2% + 이체 150엔/건', '쉬움', 1),
  ('라쿠텐 이치바', ARRAY['일본'], 'https://www.rakuten.co.jp', 'https://marketplace.rakuten.net/', '🏯', '일본 최대 쇼핑몰, 누적 1억 회원, 법인만 입점 가능', '초기 6만엔 + 월 5만엔 + 판매수수료 ~10%', '어려움', 2),
  ('쇼피 (Shopee)', ARRAY['싱가포르','말레이시아','인도네시아','태국','필리핀','베트남','대만','브라질'], 'https://shopee.kr', 'https://seller.shopee.kr/', '🛒', '동남아+대만+브라질, 10억 잠재고객, SIP 기반 입점', '커미션+결제수수료 (SIP 10% 관리비 2025.6 폐지)', '보통', 3),
  ('틱톡샵 (TikTok Shop)', ARRAY['미국','영국','싱가포르','베트남','태국','필리핀','말레이시아'], 'https://www.tiktok.com/shop', 'https://seller-kr.tiktok.com', '🎵', '숏폼 기반 커머스, 코리아-SEA 크로스보더 솔루션', '기본 6% + 크리에이터 제휴 1~10%', '보통', 4),
  ('아마존 글로벌셀링', ARRAY['미국','캐나다','멕시코','일본','영국','독일'], 'https://www.amazon.com', 'https://sell.amazon.co.kr', '📦', '글로벌 최대 이커머스, FBA 물류 시스템', '월 $39.99 + 카테고리별 8~15% + 환율정산 4%', '어려움', 5),
  ('라자다 (Lazada)', ARRAY['싱가포르','말레이시아','인도네시아','태국','필리핀','베트남'], 'https://www.lazada.com', 'https://lazada.kr', '🌏', '동남아 6개국 알리바바 자회사, 크로스보더 셀러 프로그램', '3~6% (신규 입점 시 이용료/보증금 면제)', '쉬움', 6)
ON CONFLICT (platform_name) DO NOTHING;

-- ─── 10. 플랫폼 매뉴얼 시드 데이터 ─────────────────────────────
-- 큐텐 재팬
INSERT INTO platform_manuals (platform_id, title, content, manual_type, country, sort_order)
SELECT id, '큐텐 재팬 입점 세팅가이드',
'## 큐텐 재팬 (Qoo10 Japan) 입점 가이드

### 플랫폼 개요
- 일본 2,400만 회원 보유, 여성 70%, 2030세대 중심
- K-뷰티, K-패션 카테고리 강세

### 입점 절차
1. **판매자 등록**: qoo10.jp 셀러 등록 페이지 접속
2. **이메일/기본정보 입력**: 회사 정보, 연락처 등록
3. **사업자등록증 제출**: 영문 또는 일본어 번역본
4. **심사 대기**: 1~2주 소요
5. **승인 후 상품 등록 시작**

### 필요 서류
- 사업자등록증 (영문/일본어 번역본)
- 대표자 신분증
- 은행 계좌 정보

### 수수료 구조
- 카테고리별 판매 수수료: 6~10%
- 해외셀러 추가 수수료: 2%
- 이체 수수료: 150엔/건
- 정산: Q통장 → 5~15영업일

### 핵심 전략
- **메가와리** (3/6/9/11월) 대형 세일 적극 활용
- 일본어 상품명 필수 (SEO 중요)
- 리뷰 관리가 매출에 직결

### 참고 링크
- [Qoo10 공식 입점 가이드](https://doc.image-qoo10.jp/sqm/JP/Qoo10StoreOpeningGuide_KR.pdf)',
'세팅가이드', '일본', 1
FROM ecommerce_platforms WHERE platform_name = '큐텐 재팬 (Qoo10)';

-- 라쿠텐 이치바
INSERT INTO platform_manuals (platform_id, title, content, manual_type, country, sort_order)
SELECT id, '라쿠텐 이치바 입점 세팅가이드',
'## 라쿠텐 이치바 입점 가이드

### 플랫폼 개요
- 일본 최대 종합 쇼핑몰, 누적 1억+ 회원
- 포인트 시스템 (라쿠텐 포인트)이 강력한 차별점

### 입점 자격
- **법인 사업자만 가능** (개인사업자 불가)
- 한국 법인도 입점 가능하나 절차가 복잡

### 비용 구조
- 초기 등록비: 6만엔
- 월 고정비: 5만엔
- 판매수수료: ~10% (플랜별 상이)

### 물류
- CJ대한통운 연계 가능
- 일본 현지 풀필먼트센터 활용 권장

### 정부지원
- SBA ''렛츠고 재팬'' 프로그램
- 초기비용 최대 450만원 지원 가능

### 참고 링크
- [라쿠텐 한국 셀러 페이지](https://www.rakuten.co.jp/ec/sellinjapan/kr/)',
'세팅가이드', '일본', 1
FROM ecommerce_platforms WHERE platform_name = '라쿠텐 이치바';

-- 쇼피
INSERT INTO platform_manuals (platform_id, title, content, manual_type, country, sort_order)
SELECT id, '쇼피 (Shopee) 입점 세팅가이드',
'## 쇼피 (Shopee) 입점 가이드

### 플랫폼 개요
- 동남아+대만+브라질, 10억 잠재고객
- K-뷰티, K-패션 높은 인기

### 입점 방식
- SIP(Shopee International Platform) 기반
- 한국 셀러 직접 등록 가능 (shopee.kr)

### 수수료
- 등록비/리스팅비: **무료**
- 커미션 + 결제수수료만 부과
- SIP 10% 관리비 2025.6 폐지

### 물류
- SLS(Shopee Logistics Service)
- 한국→동남아 배송 5~10영업일

### 성공사례
- 메디힐: 매출 2,100% 성장
- 베리시: 여성의류 카테고리 1위

### 참고 링크
- [쇼피 코리아 공식](https://shopee.kr/)',
'세팅가이드', NULL, 1
FROM ecommerce_platforms WHERE platform_name = '쇼피 (Shopee)';

-- 틱톡샵
INSERT INTO platform_manuals (platform_id, title, content, manual_type, country, sort_order)
SELECT id, '틱톡샵 (TikTok Shop) 입점 세팅가이드',
'## 틱톡샵 (TikTok Shop) 입점 가이드

### 입점 현황
- 한국에서 직접 입점 불가
- 2025.11 ''코리아-SEA 크로스보더'' 솔루션 출시

### 크로스보더 입점 가능 국가
- 태국, 싱가포르, 베트남, 필리핀, 말레이시아 (동남아 5개국)

### 필요 서류
- 한국 사업자등록증
- 여권
- 국내 주소
- 가상계좌

### 수수료
- 기본 수수료: 6%
- 크리에이터 제휴: 1~10%

### 판매 방식
- 라이브쇼핑
- 쇼퍼블비디오
- 제품 쇼케이스
- 제휴 마케팅

### 참고 링크
- [틱톡샵 코리아-SEA 크로스보더](https://seller-kr.tiktok.com)',
'세팅가이드', NULL, 1
FROM ecommerce_platforms WHERE platform_name = '틱톡샵 (TikTok Shop)';

-- 아마존 글로벌셀링
INSERT INTO platform_manuals (platform_id, title, content, manual_type, country, sort_order)
SELECT id, '아마존 글로벌셀링 입점 세팅가이드',
'## 아마존 글로벌셀링 입점 가이드

### 시장 규모
- 미국 이커머스 40.4% 점유율
- 월 1.5억+ 방문자

### 셀러 등록
1. Amazon Seller Central 접속
2. 사업자등록증 + 신분증 + 은행계좌 제출
3. 비디오 인터뷰 (본인 확인)
4. 승인 후 상품 등록

### 플랜
- Individual: $0.99/건 (소량 판매)
- Professional: $39.99/월 (대량 판매)

### 수수료
- 카테고리별 8~15%
- 환율정산 수수료 4%

### 물류 (FBA)
- Fulfillment by Amazon
- 1~2일 배송 (프라임)
- 미국 입점 시 캐나다/멕시코 동시 판매 가능

### 참고 링크
- [아마존 코리아 공식](https://sell.amazon.co.kr/)',
'세팅가이드', NULL, 1
FROM ecommerce_platforms WHERE platform_name = '아마존 글로벌셀링';

-- 라자다
INSERT INTO platform_manuals (platform_id, title, content, manual_type, country, sort_order)
SELECT id, '라자다 (Lazada) 입점 세팅가이드',
'## 라자다 (Lazada) 입점 가이드

### 시장
- 동남아 6개국 (알리바바 자회사)
- 인도네시아, 말레이시아, 필리핀, 싱가포르, 태국, 베트남

### 입점 방식
- Cross-Border Seller로 현지 법인 불필요
- 7영업일 내 판매 개시 가능

### 수수료
- 카테고리별 3~6%
- 신규 입점 시 이용료/보증금 면제

### 물류
- LGS(Lazada Global Shipping) 원스톱 서비스
- 한국에서 직접 발송 가능

### 장점
- 1회 콘텐츠 업로드 → 6개국 자동 번역 노출
- 알리바바 생태계 (Cainiao 물류) 활용

### 참고 링크
- [라자다 코리아 공식](https://lazada.kr/)',
'세팅가이드', NULL, 1
FROM ecommerce_platforms WHERE platform_name = '라자다 (Lazada)';

-- ─── 11. 이커머스 기본 태스크 시드 ──────────────────────────────
-- loop_order를 기존 최대값 이후로 설정
INSERT INTO tasks (loop_order, task_name, description, category, frequency, is_applicable_default, scope)
SELECT COALESCE(MAX(loop_order), 0) + 1, '주문/CS 확인 (이커머스)', '이커머스 플랫폼 주문 및 CS 확인', '이커머스', 'daily', true, 'campaign'
FROM tasks;

INSERT INTO tasks (loop_order, task_name, description, category, frequency, is_applicable_default, scope)
SELECT COALESCE(MAX(loop_order), 0) + 1, '재고/배송 상태 확인', '이커머스 플랫폼 재고 및 배송 상태 모니터링', '이커머스', 'daily', true, 'campaign'
FROM tasks;

INSERT INTO tasks (loop_order, task_name, description, category, frequency, is_applicable_default, scope)
SELECT COALESCE(MAX(loop_order), 0) + 1, '광고 성과 리뷰', '이커머스 광고 캠페인 성과 분석', '이커머스', 'weekly', true, 'campaign'
FROM tasks;

INSERT INTO tasks (loop_order, task_name, description, category, frequency, is_applicable_default, scope)
SELECT COALESCE(MAX(loop_order), 0) + 1, '인플루언서 콘텐츠 확인', '이커머스 연계 인플루언서 콘텐츠 리뷰', '이커머스', 'weekly', true, 'campaign'
FROM tasks;

INSERT INTO tasks (loop_order, task_name, description, category, frequency, is_applicable_default, scope)
SELECT COALESCE(MAX(loop_order), 0) + 1, '플랫폼별 매출 리포트', '이커머스 플랫폼별 월간 매출 리포트 작성', '이커머스', 'monthly', true, 'campaign'
FROM tasks;

INSERT INTO tasks (loop_order, task_name, description, category, frequency, is_applicable_default, scope)
SELECT COALESCE(MAX(loop_order), 0) + 1, '인플루언서 원고비 정산', '이커머스 연계 인플루언서 원고비 월간 정산', '이커머스', 'monthly', true, 'campaign'
FROM tasks;
