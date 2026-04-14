---
feature: campaign-checklist-dashboard
phase: plan
created: 2026-04-15
owner: 지현근
---

# 캠페인별 필수 체크리스트 대시보드 확장

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 반드시체크리스트 대시보드에 해외환자유치 캠페인(중화권 제외)별 일일 운영 지표를 전사 통합 관리할 공간이 없어, 담당자별로 흩어진 데이터를 거래처에 전달할 때 매번 수기 집계·정리하는 비효율 발생 |
| **Solution** | 기존 `view/must-check` 페이지에 캠페인 행 × 3개 섹션(인플루언서/일반고객/광고) × 동적 컬럼 구조의 일일 기록 테이블을 추가. 날짜 기반 저장으로 KST 0시 롤오버 시 초기화, 과거 데이터는 영속. 검색·필터·요약·카톡 복사 기능 포함 |
| **Function UX Effect** | 캠페인 셀 호버 → 팝오버 에디터로 텍스트/다중 URL 입력, 섹션별 헤더 색상 구분, 캠페인 검색 + 다중 선택 필터, 베스트/긴급 자동 분류 카드, 캠페인별 카톡 포맷 1-클릭 복사 |
| **Core Value** | 담당자 집계 시간 제로화(일 30분 → 0분) · 거래처 전달 정확도 향상 · 신규 캠페인 자동 연동으로 관리 누락 방지 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 해외환자유치 캠페인 일일 운영 데이터를 전사 단일 진실 공급원(SSOT)으로 통합해 거래처 보고 효율을 극대화 |
| **WHO** | 캠페인 담당자(입력), 팀장(요약 대시보드 모니터링), 거래처 담당자(카톡 복사 수신) |
| **RISK** | (1) `campaign_products` 조인 필터가 느려 렌더 지연 (2) KST 0시 롤오버 경계 버그 (3) 다중 URL jsonb 저장 시 타입 불일치 (4) 실시간 반영 누락으로 담당자 간 덮어쓰기 |
| **SUCCESS** | ① 자격 캠페인이 자동 행으로 나타남 ② 입력값이 당일 데이터로 저장되고 익일 0시 후 빈 상태로 시작 ③ 과거 날짜 조회 가능 ④ 카톡 복사 포맷이 개행·섹션 스키마명 포함으로 즉시 붙여넣기 가능 ⑤ 컬럼 CRUD 전 직원 가능 |
| **SCOPE** | IN: 기존 must-check 페이지 하단 새 섹션 추가 / 신규 4개 테이블 / 캠페인 자동 연동 / 요약 카드 / 카톡 복사. OUT: 기존 섹션 구조 변경, 권한 세분화, 외부 API 연동, 모바일 전용 레이아웃 |

---

## 1. 요구사항

### 1.1 기능 요구사항 (FR)

- **FR-01 자격 캠페인 자동 연동**: `campaign_products.collaboration_products.product_name = '해외환자유치상품'` AND `campaigns.target_country ≠ '중화권(홍,말,싱)'` 인 캠페인이 자동으로 행으로 표시. 캠페인 관리에서 추가/삭제 시 실시간 반영.
- **FR-02 섹션·컬럼 구조**: 3개 섹션(인플루언서 / 일반고객 / 광고차원). 각 섹션은 동적 컬럼 목록을 가지며 기본 컬럼이 시드로 선입력됨. 동일 섹션 컬럼 헤더는 같은 색, 섹션 간 색 상이.
  - 인플루언서: 컨펌대기 인플, 예약확정 인플, 금일 업로드 후기(다중 URL), 방문완료 인플
  - 일반고객: 신규예약 고객(보조텍스트 "f/u 제외"), 방문완료 고객, 금일 업로드 리뷰(다중 URL)
  - 광고차원: 소진 광고비, 현재 집행중 광고 소재(다중 URL)
- **FR-03 날짜 기반 저장**: 모든 입력은 `(campaign_id, column_id, record_date)` 키로 저장. KST 0시 기준 화면은 당일 빈 상태로 시작. 과거 데이터 영속. 날짜 네비게이터로 과거 조회 가능.
- **FR-04 팝오버 입력 UX**: 셀 호버/클릭 → Popover 열림. 일반 컬럼은 Textarea, 다중 URL 컬럼은 `+` 버튼으로 행 추가·삭제 리스트.
- **FR-05 CRUD**
  - 캠페인 행: 언제든 대시보드에서 삭제 가능(실제 삭제는 아닌 해당 기능 비활성화 플래그 또는 campaign_products 연결 해제 경로 중 택일 — §5 결정사항 참조).
  - 컬럼: 섹션별 추가/수정/삭제. 전 직원 가능.
- **FR-06 검색/필터**: 캠페인명 텍스트 검색 박스 + 다중 선택 칩. 선택된 캠페인만 표시.
- **FR-07 요약 대시보드**
  - **베스트 Top3**: 당일 "금일 업로드 후기" + "금일 업로드 리뷰" URL 개수 합계 내림차순.
  - **긴급**: 일반고객 신규예약=0 OR 인플루언서 신규예약확정=0 (빈 값/0건 모두 해당).
- **FR-08 카톡 복사**: 캠페인별 `[캠페인명]` 뒤에 섹션 스키마명과 컬럼명·값 나열. 섹션 간 빈 줄, 항목별 개행. Clipboard API 사용.

### 1.2 비기능 요구사항 (NFR)

- **성능**: 자격 캠페인 100개 × 컬럼 20개 × 당일 기록 조회를 단일 쿼리로 처리(JOIN 1회, 캐시). 초기 로딩 < 800ms.
- **실시간**: Supabase Realtime으로 `checklist_campaign_records` 변경 시 모든 열람자에게 반영. 채널 cleanup 필수.
- **낙관적 업데이트**: 입력 변경 시 `onMutate`로 즉시 반영 → 실패 시 롤백.
- **접근성**: 팝오버 키보드 내비게이션, aria-label, 대비 4.5:1.
- **보안**: RLS authenticated. 시크릿 클라이언트 노출 없음.

## 2. 스코프

### In-Scope
- `must-check` 페이지 하단 "캠페인별 필수 체크리스트" 섹션 신규 추가 (기존 4개 섹션은 무변경)
- 신규 DB 4테이블 + 마이그레이션
- 섹션/컬럼 관리 UI (섹션은 고정 3개, 컬럼만 CRUD)
- 캠페인 행 자동 연동 (campaign_products 구독 훅 재사용 또는 신규 뷰 쿼리)
- 요약 대시보드 카드 (상단 고정)
- 카톡 복사 유틸

### Out-of-Scope (명시적 제외)
- 기존 `must_check_sections/items/records` 테이블 스키마 변경
- 권한 세분화 (모든 인증 사용자 동일 권한 유지)
- 모바일 전용 반응형 최적화 (기본 반응형만)
- 엑셀 내보내기, PDF 출력
- 카카오톡 API 직접 발송 (클립보드 복사까지만)

## 3. 데이터 모델

신규 테이블 4개 (`supabase/migrations/20260416_campaign_checklist.sql`):

```sql
-- 섹션 (고정 3개지만 확장 가능하도록 테이블화)
create table checklist_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- '인플루언서' | '일반고객' | '광고차원'
  color_theme text not null,          -- 'purple' | 'emerald' | 'amber'
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 컬럼 정의 (섹션별 동적)
create table checklist_columns (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references checklist_sections(id) on delete cascade,
  name text not null,                 -- '컨펌대기 인플', '신규예약 고객', ...
  input_type text not null default 'text' check (input_type in ('text','number','multi_url')),
  helper_text text,                   -- 예: 'f/u 제외'
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 캠페인 제외 플래그 (대시보드에서 삭제 = hide)
create table checklist_campaign_overrides (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  is_hidden boolean not null default false,
  updated_at timestamptz default now()
);

-- 일별 기록 (핵심)
create table checklist_campaign_records (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  column_id uuid not null references checklist_columns(id) on delete cascade,
  record_date date not null,          -- KST 기준 yyyy-mm-dd
  value_text text,                    -- text/number 용 (number는 문자열로 저장 후 파싱)
  value_urls jsonb,                   -- multi_url 용 ['https://...', ...]
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  unique(campaign_id, column_id, record_date)
);

create index idx_ccr_date on checklist_campaign_records(record_date);
create index idx_ccr_campaign_date on checklist_campaign_records(campaign_id, record_date);

-- RLS
alter table checklist_sections enable row level security;
alter table checklist_columns enable row level security;
alter table checklist_campaign_overrides enable row level security;
alter table checklist_campaign_records enable row level security;

create policy "checklist_sections_all" on checklist_sections for all to authenticated using (true) with check (true);
create policy "checklist_columns_all" on checklist_columns for all to authenticated using (true) with check (true);
create policy "checklist_campaign_overrides_all" on checklist_campaign_overrides for all to authenticated using (true) with check (true);
create policy "checklist_campaign_records_all" on checklist_campaign_records for all to authenticated using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table checklist_sections;
alter publication supabase_realtime add table checklist_columns;
alter publication supabase_realtime add table checklist_campaign_records;
alter publication supabase_realtime add table checklist_campaign_overrides;
```

**시드**:
- `checklist_sections`: (인플루언서, purple, 0), (일반고객, emerald, 1), (광고차원, amber, 2)
- `checklist_columns`: 각 섹션별 §1.1 FR-02 기본 컬럼 삽입

## 4. UX / UI

### 4.1 페이지 구조 (must-check page 기준)
```
[기존 4개 섹션 — 영업/인플루언서/광고/CS] (무변경)
────────────────────────────────────────────
[신규] 캠페인별 필수 체크리스트
├ 상단 컨트롤 바: 날짜 피커 + 캠페인 검색 + 다중선택 칩 + 컬럼관리 버튼
├ 요약 카드: 🏆 베스트 Top3 / 🚨 긴급 캠페인 리스트
└ 그리드 테이블
   ├ 행: 자격 캠페인 1개씩
   └ 컬럼: [캠페인명 고정] [인플루언서 섹션(purple)] [일반고객 섹션(emerald)] [광고차원 섹션(amber)]
```

### 4.2 셀 상호작용
- 기본: 값 프리뷰 (짧게 잘라서)
- 클릭: Popover 열림 → Textarea / 숫자 Input / URL 리스트 + 추가 버튼
- Popover 하단: 저장 / 닫기. `cmd+enter` 저장.

### 4.3 헤더 색상
- 인플루언서: `bg-purple-100 text-purple-800`
- 일반고객: `bg-emerald-100 text-emerald-800`
- 광고차원: `bg-amber-100 text-amber-800`
- 컬럼 헤더(같은 섹션): 섹션 색상의 연한 톤

### 4.4 카톡 복사 포맷
```
[강남○○의원]

#인플루언서
- 컨펌대기 인플: 3
- 예약확정 인플: 5
- 금일 업로드된 후기:
  https://...
  https://...
- 방문완료 인플: 2

#일반고객
- 신규예약 고객: 8
- 방문완료 고객: 6
- 금일 업로드된 리뷰:
  https://...

#광고차원
- 소진 광고비: 1,200,000원
- 현재 집행중인 광고 소재:
  https://...
```

## 5. 주요 결정사항 / 트레이드오프

| 결정 | 선택 | 대안 | 근거 |
|------|------|------|------|
| 캠페인 자격 판정 | `campaign_products` 조인 뷰 | DB 플래그 컬럼 추가 | 기존 데이터 변경 없이 조회 가능. 성능은 인덱스로 보완 |
| 섹션 구조 | 테이블화(고정 3개) | 하드코딩 | 향후 섹션 추가 가능성 대비, 비용 낮음 |
| 캠페인 "삭제" | `checklist_campaign_overrides.is_hidden=true` | 실제 캠페인 삭제 | 캠페인 자체 영향 제로. 관리 화면에서 복원 가능 |
| 다중 URL 저장 | `jsonb` 배열 | 별도 테이블 | 쿼리 단순. URL 개수 <10 수준 |
| 0시 롤오버 구현 | 날짜 파라미터로 분리된 조회 | cron 초기화 | 과거 데이터 영속 요구 자연스럽게 충족 |
| 실시간 채널 | Supabase Realtime 3테이블 구독 | 폴링 | 즉시 반영 + 기존 패턴 일치 |

## 6. 성공 기준 (Success Criteria)

- **SC-01**: 중화권 제외 해외환자유치 캠페인이 자동 행으로 표시되고, 캠페인 관리에서 신규 등록 시 5초 이내 대시보드에 반영 (Realtime)
- **SC-02**: 셀 입력 → Popover 저장 → 테이블에 반영까지 1초 이내
- **SC-03**: 날짜 피커를 과거 날짜로 이동하면 그 날짜의 값 조회 가능, 당일 0시 이후 새로 열면 빈 상태 시작
- **SC-04**: 컬럼 추가 → 모든 캠페인 행에 즉시 빈 셀 생성
- **SC-05**: 카톡 복사 버튼 클릭 → 클립보드에 §4.4 포맷으로 저장
- **SC-06**: 베스트 Top3, 긴급 리스트가 실시간 값에 따라 재계산
- **SC-07**: TypeScript 빌드 에러 0, `npx next build` 성공

## 7. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| campaign_products 조인 느림 (캠페인 다수) | 초기 로딩 지연 | DB 뷰 생성 + (campaign_id, product_id) 인덱스 확인 |
| KST 0시 경계 버그 | 잘못된 날짜 저장 | 기존 `getKSTDate` 유틸 재사용 |
| 동시 편집 충돌 | 덮어쓰기 | `upsert` + `updated_at` 비교, Realtime 반영 |
| 컬럼 삭제 시 과거 데이터 손실 | 기록 소실 | ON DELETE CASCADE 대신 soft delete 플래그(`is_archived`) 검토 — Design 단계 확정 |
| 다중 URL 입력 UX 혼란 | 사용 저하 | Popover 내 명확한 +/휴지통 버튼, placeholder URL 예시 제공 |

## 8. 일정 추정

| 단계 | 작업 | 예상 |
|------|------|------|
| Design | 컴포넌트 분할, 쿼리 설계, 뷰 SQL | 0.5d |
| Do-1 | 마이그레이션 + 시드 + Realtime 훅 | 0.5d |
| Do-2 | 대시보드 테이블 + Popover 에디터 | 1.0d |
| Do-3 | 컬럼 관리 다이얼로그 + 캠페인 연동 | 0.5d |
| Do-4 | 요약 카드 + 검색/필터 + 카톡 복사 | 0.5d |
| Check | Gap 분석 + E2E | 0.5d |
| **합계** | | **3.5d** |

## 9. 참조

- 기존 페이지: `app/(main)/view/must-check/page.tsx`
- 기존 마이그레이션: `supabase/migrations/20260409_must_check_dashboard.sql`
- 캠페인 타입: `lib/types/database.ts` (Campaign, CampaignProductWithProduct)
- 캠페인 실시간 훅: `hooks/use-realtime-campaigns.ts`
- Product 조인 예: `app/(main)/manage/campaigns/page.tsx:354`
