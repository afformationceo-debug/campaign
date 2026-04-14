---
feature: campaign-checklist-dashboard
phase: check
analyzed: 2026-04-15
mode: static-only (no server)
---

# Gap 분석: 캠페인별 필수 체크리스트 대시보드

## Context Anchor
| 항목 | 내용 |
|------|------|
| **WHY** | 해외환자유치 캠페인 일일 운영 데이터 SSOT 통합 |
| **SCOPE** | must-check 페이지 하단 신규 섹션 + 4테이블 + 캠페인 자동 연동 + 요약/복사 |
| **SUCCESS** | 자격 캠페인 자동 행 / KST 날짜 기반 저장 / 과거 영속 / 컬럼 CRUD / 카톡 복사 |

---

## 1. Match Rate 요약

| 축 | 점수 | 가중치 | 기여 |
|----|------|--------|------|
| Structural | **100** | 0.2 | 20.0 |
| Functional | **90** | 0.4 | 36.0 |
| Contract | **100** | 0.4 | 40.0 |
| **Overall** | | | **96.0%** ✅ |

> 정적 분석 공식 적용 (서버 미실행). Runtime Verification은 마이그레이션 적용 후 재평가 가능.

---

## 2. Structural Match (100%)

| 산출물 | 기대 | 실제 | 결과 |
|--------|------|------|------|
| 마이그레이션 SQL | 4테이블 + RLS + Realtime + 시드 | `supabase/migrations/20260416_campaign_checklist.sql` | ✅ |
| TypeScript 타입 | ChecklistSection/Column/Record/Override | `lib/types/database.ts:405-443` | ✅ |
| Query Keys | campaignChecklist 그룹 | `lib/utils/query-keys.ts:119-125` | ✅ |
| 메인 컴포넌트 | 테이블+팝오버+요약+관리 | `components/views/campaign-checklist-section.tsx` | ✅ |
| 페이지 통합 | must-check 하단 삽입 | `app/(main)/view/must-check/page.tsx` | ✅ |

---

## 3. Functional Depth (90%)

### 3.1 FR Checklist

| FR | 요구 | 구현 증거 | 상태 |
|----|------|-----------|------|
| **FR-01** 자격 캠페인 자동 연동 | 해외환자유치 + 중화권 제외, 실시간 | `section.tsx:117-136` (2-step 조인 + `.neq`) + `:155-180` (Realtime 구독 6개 테이블) | ✅ Met |
| **FR-02** 섹션/컬럼 + 색상 구분 | 3섹션, 섹션 간 헤더 색 상이 | `section.tsx:38-62` (purple/emerald/amber) + 시드 SQL | ✅ Met |
| **FR-03** 날짜 기반 저장 + 0시 롤오버 + 과거 영속 | record_date 키, 당일 빈 상태 | `section.tsx:87-92` (dateStr) + SQL `unique(campaign_id,column_id,record_date)` + must-check의 KST 날짜 네비 공유 | ✅ Met |
| **FR-04** 팝오버 입력 UX | 호버/클릭 → Textarea/숫자/URL 리스트 | `section.tsx:CellEditor` (465-600, 3분기 처리) | ✅ Met |
| **FR-05** CRUD | 캠페인 삭제 + 컬럼 추가/수정/삭제 | `section.tsx:307-320` (hide mutation) + `:718-770` (ColumnManagementDialog) | ⚠️ Partial |
| **FR-06** 검색/필터 | 텍스트 검색 + 다중 선택 | `section.tsx:194-209` (visibleCampaigns) + `CampaignSelector` (676-730) | ✅ Met |
| **FR-07** 베스트/긴급 요약 | Top3 업로드 + 0예약 긴급 | `section.tsx:226-275` (useMemo 계산) | ✅ Met |
| **FR-08** 카톡 복사 | 섹션명+개행 포맷 | `section.tsx:buildCopyText` (335-363) + 캠페인별/전체 버튼 | ✅ Met |

### 3.2 Success Criteria

| SC | 근거 | 상태 |
|----|------|------|
| SC-01 자동 행 + Realtime 5초 내 | 6개 테이블 subscribe | ✅ Met |
| SC-02 저장 1초 내 | upsert + invalidate (낙관적 업데이트 없음 — 네트워크 RTT에 의존) | ⚠️ Partial |
| SC-03 과거 조회 + 0시 경계 | selectedDate prop 공유 (must-check `getKSTDate`) | ✅ Met |
| SC-04 컬럼 추가 → 즉시 빈 셀 | invalidate → 재렌더 | ✅ Met |
| SC-05 카톡 복사 포맷 | `buildCopyText` 섹션별 개행 | ✅ Met |
| SC-06 베스트/긴급 실시간 재계산 | useMemo([records, columns, sections]) | ✅ Met |
| SC-07 TS 에러 0 | tsc 신규 코드 에러 0 (기존 테스트 파일만 사전존재 에러) | ✅ Met |

**합계**: 6/7 Met, 1/7 Partial

---

## 4. Contract (DB ↔ Code) (100%)

| 필드 | SQL | TypeScript | 일치 |
|------|-----|-----------|------|
| checklist_columns.input_type | CHECK ('text','number','multi_url') | `ChecklistColumnType` union | ✅ |
| checklist_campaign_records.value_urls | jsonb | `string[] \| null` | ✅ |
| unique constraint | (campaign_id, column_id, record_date) | `upsert(onConflict:'campaign_id,column_id,record_date')` | ✅ |
| RLS | authenticated all | — | ✅ |
| Realtime publication | 4 테이블 등록 | subscribe 대상 일치 + campaign_products/campaigns | ✅ |

---

## 5. Gap List (Critical/Important만, 신뢰도 ≥80%)

### ⚠️ IMPORTANT-1: 컬럼 순서 재정렬 UI 부재
- **근거**: Plan FR-05는 "수정" 포함. 시드 sort_order만 존재, 추가 시 append-only. 드래그 재정렬/sort_order 편집 UI 없음.
- **영향**: 컬럼 순서 변경이 불가능해 레이아웃 조정 요구 발생 시 수기 SQL 필요.
- **파일**: `components/views/campaign-checklist-section.tsx:ColumnManagementDialog`
- **권장 수정**: 상/하 이동 버튼 또는 Reorder 드래그 추가.

### ⚠️ IMPORTANT-2: 컬럼 삭제 시 과거 기록 CASCADE 소실
- **근거**: SQL `on delete cascade` → 컬럼 삭제 시 `checklist_campaign_records`의 모든 날짜 기록 소실. Plan §7 리스크에서 soft-delete(`is_archived`) 플래그 검토 항목으로 명시되었으나 Design 단계 생략으로 미결정 상태.
- **영향**: 과거 데이터 영속 요구(FR-03)와 부분 충돌 — 컬럼 단위 영속성 보장 안 됨.
- **현 완화책**: 삭제 confirm 다이얼로그로 경고 ("모든 입력 데이터가 삭제됩니다").
- **권장 수정**: `checklist_columns.is_archived` boolean 추가 + 쿼리 필터링.

### ⚠️ IMPORTANT-3: 낙관적 업데이트 미적용 (SC-02 영향)
- **근거**: `upsertRecord.mutate` → `invalidateQueries`만 호출. onMutate 없음 → 서버 응답 전 UI 반영 없음.
- **영향**: 네트워크 RTT 200~800ms 동안 입력값 프리뷰 지연. SC-02("1초 내") 한계 상황에서 미충족 가능.
- **파일**: `components/views/campaign-checklist-section.tsx:283-304`
- **권장 수정**: onMutate에서 캐시 직접 업데이트 + onError 롤백.

### ℹ️ INFO (참고)
- **INFO-1**: 다중 URL 입력 URL 유효성 검사 없음 (Plan FR-04에서 명시적 요구 없음, placeholder `https://...` 표기만).
- **INFO-2**: `campaign.campaign_name` 외 `client_name` 폴백 1단계 — 빈 문자열 케이스는 `|| '-'` 미적용. 실데이터는 NOT NULL이므로 영향 미미.
- **INFO-3**: 빌드는 기존 테스트 파일 에러만 잔존 (`lib/daily-report/report-insights.test.ts` 등) — 신규 코드 무관, 사전존재.

---

## 6. Decision Record 준수

| 결정(Plan §5) | 구현 준수 |
|--------------|----------|
| `campaign_products` 조인 뷰 | ✅ 2-step 쿼리로 대체(뷰 대신 코드 필터) — 동일 효과, 인덱스 영향 동일 |
| 섹션 테이블화(3개) | ✅ |
| 캠페인 "삭제" = hide 플래그 | ✅ `checklist_campaign_overrides.is_hidden` |
| 다중 URL jsonb 배열 | ✅ |
| KST 0시 롤오버 = 날짜 파라미터 분리 | ✅ selectedDate prop 공유 |
| Realtime 3테이블 구독 | ✅ + campaign_products/campaigns 확장 (자격 목록 동기화 위해) |

모든 주요 결정 준수.

---

## 7. Runtime Verification (미실행)

서버 미실행 + 마이그레이션 미적용 상태. 다음 단계에서 수행 권장:

### L1 — DB/API
1. Supabase Studio에서 `20260416_campaign_checklist.sql` 실행
2. `select * from checklist_sections` → 3행 반환 확인
3. `select * from checklist_columns` → 9행 반환 확인

### L2 — UI 액션
1. `/view/must-check` 접속 → "캠페인별 필수 체크리스트" 섹션 확인
2. 해외환자유치 + 비중화권 캠페인 자동 노출 확인
3. 셀 클릭 → 팝오버 → 텍스트/숫자/URL 저장 → 재조회

### L3 — E2E
1. 캠페인 관리에서 신규 해외환자유치 캠페인 추가 → 대시보드 실시간 반영
2. 날짜 네비 과거로 이동 → 빈 상태 → 입력 → 오늘로 복귀 → 당일 데이터 유지
3. 카톡 복사 → 외부 에디터 붙여넣기 → 포맷 검증

---

## 8. 권장 조치

| 우선순위 | 조치 | 비용 |
|----------|------|------|
| **Critical 없음** | - | - |
| P1 | IMPORTANT-2 soft-delete 전환 (마이그레이션 + 쿼리 필터) | 0.3d |
| P2 | IMPORTANT-3 낙관적 업데이트 | 0.2d |
| P3 | IMPORTANT-1 컬럼 순서 변경 UI | 0.2d |

Match Rate **96%** 이므로 90% 기준 초과. 현 상태로 `/pdca report` 진행 가능하나,
IMPORTANT-2(데이터 영속)는 FR-03 충돌 가능성이 있어 **배포 전 조치 권장**.
