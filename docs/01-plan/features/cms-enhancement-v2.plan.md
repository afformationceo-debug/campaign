# Plan: CMS Enhancement V2

> 작성일: 2026-02-17
> Feature: cms-enhancement-v2
> Phase: Plan

---

## 1. 개요

어포메이션 CMS의 5가지 핵심 개선사항을 구현한다.

| # | 요구사항 | 우선순위 | 복잡도 |
|---|---------|---------|--------|
| 1 | Task CRUD 반영 검증 + 버그 수정 | 높음 | 낮음 |
| 2 | 캠페인 세팅 매트릭스 뷰 | 중간 | 높음 |
| 3 | 활동로그 한글화 (ID → 실제값) | 중간 | 중간 |
| 4 | 비캠페인 업무(영업/리드) 관리 체계 | 높음 | 높음 |
| 5 | 상태값 4단계 + 담당자별 클릭 버그 수정 | 높음 | 중간 |

---

## 2. 요구사항 상세

### 2-1. Task CRUD → 뷰 자동 반영

**현재 상태:**
- Task 추가/삭제 시 `queryKeys.tasks.all` 캐시만 invalidate
- 뷰 페이지(담당자별/캠페인별)는 `queryKeys.tasks.all`을 사용하므로 React Query 캐시 invalidation으로 자동 반영됨
- 단, Task 삭제 시 해당 task의 `daily_checks`, `campaign_task_config` 잔여 데이터가 남을 수 있음

**계획:**
- Task 삭제 시 관련 `campaign_task_config` 레코드 cascade 삭제 확인 (DB 외래키 설정)
- 뷰 페이지에서 존재하지 않는 task_id 참조 시 graceful 처리
- Task 추가 후 즉시 뷰에 반영되는지 E2E 검증

### 2-2. 캠페인 세팅 매트릭스 뷰

**현재 상태:**
- configs 페이지는 캠페인 하나씩 선택하여 설정하는 방식
- 전체 캠페인 × 설정항목 현황을 한눈에 보기 불가

**계획:**
- 기존 개별 캠페인 세팅 페이지는 유지 (상세 편집용)
- **새 매트릭스 뷰 탭 추가**: 세로축=캠페인, 가로축=config_key (설정항목)
  - 셀에 완료/미완료 상태 표시 (색상 코딩)
  - 셀 클릭 시 인라인 값 편집 또는 상세 팝업
  - config_type별 그룹핑 (카테고리 헤더)
- 매트릭스 뷰의 config_key 목록은 기본 템플릿 16개 항목 기준

### 2-3. 활동로그 한글화

**현재 상태:**
- `user_id` → 사용자명 변환됨 (OK)
- `campaign_id`, `task_id` → UUID 그대로 노출
- `action_type` → 영문 그대로 (upsert, update, insert)
- `target_table` → 영문 테이블명 그대로

**계획:**
- campaigns, tasks 데이터를 로그 페이지에서 함께 fetch
- `new_value`/`old_value` 내의 `campaign_id` → 캠페인명, `task_id` → 업무명 변환
- `target_table` 한글 매핑: `daily_checks` → `일일 체크`, `campaign_task_config` → `업무 적용설정` 등
- `action_type` 한글 매핑: `upsert` → `수정`, `insert` → `생성`, `update` → `수정`, `delete` → `삭제`
- `status` 값은 이미 한글이므로 유지

### 2-4. 비캠페인 업무 (영업/리드) 관리 체계

**현재 상태:**
- "신규 영업 아웃바운드", "신규 리드 확보 확인 및 미팅 일정 조율", "신규 리드 미팅" 등은 캠페인 획득을 위한 업무
- 현재는 모든 task가 캠페인 × task 매트릭스에 매핑되어 있음
- 이런 업무는 특정 캠페인에 속하지 않고, 담당자가 일별로 수행 여부만 체크하면 됨

**계획 - Task에 `scope` 필드 도입:**
- `tasks` 테이블에 `scope` 컬럼 추가: `'campaign'` (기본) | `'global'`
  - `campaign` scope: 기존처럼 캠페인 × task 매트릭스로 관리
  - `global` scope: 캠페인과 무관하게 담당자별 일일 체크만 수행
- **담당자별 뷰**: global 업무는 캠페인 열 없이 별도 섹션으로 표시 (단순 체크리스트)
- **캠페인별 뷰**: global 업무는 표시하지 않음 (캠페인과 무관하므로)
- **DB 변경**: `tasks` 테이블에 `scope TEXT DEFAULT 'campaign'` 추가
- **daily_checks**: global task는 `campaign_id = NULL`로 저장 (별도 체크 레코드)
- **기존 데이터 마이그레이션**: 영업 카테고리의 해당 3개 task를 `scope = 'global'`로 업데이트

### 2-5. 상태값 4단계 + 담당자별 클릭 버그 수정

**현재 상태:**
- `CheckStatus` 타입에 4가지 상태 이미 정의됨: `완료 | 진행중 | 미완료 | 해당없음`
- StatusCell의 클릭 사이클: `미완료 → 진행중 → 완료 → 미완료` (해당없음 제외)
- **담당자별 뷰 클릭 버그**: `assigneeId`가 `null`일 때 (전체 담당자) `useCreateCheck`에 `assigned_user_id: undefined` 전달 → DB에 null로 삽입되어 assignee 필터링 시 누락 가능
- 해당없음 선택 시 완료율 계산에 반영 안 됨

**계획:**
- **클릭 사이클 변경**: `미완료 → 진행중 → 완료 → 해당없음 → 미완료`
  - 해당없음도 사이클에 포함하여 사용자가 직접 선택 가능
- **담당자별 클릭 버그 수정**:
  - `assigneeId`가 null인 경우 현재 로그인 사용자의 ID를 사용하도록 수정
  - `useCreateCheck`의 `assigned_user_id` 파라미터 검증 강화
- **완료율 계산 로직 변경**:
  - `해당없음` 상태는 완료로 간주하여 완료율에 포함
  - 공식: `(완료 + 해당없음) / 전체 applicable` × 100

---

## 3. 구현 순서

| 단계 | 작업 | 예상 파일 | 의존성 |
|------|------|----------|--------|
| **1** | 상태값 4단계 사이클 + 담당자별 클릭 버그 수정 | status-cell.tsx, use-update-check-status.ts, assignee-grid.tsx, campaign-grid.tsx | 없음 |
| **2** | 완료율 계산 로직 (해당없음 = 완료 처리) | assignee-grid.tsx, campaign-grid.tsx, dashboard 관련 | 단계1 |
| **3** | Task CRUD 반영 검증 + graceful 처리 | manage/tasks/page.tsx, 뷰 컴포넌트 | 없음 |
| **4** | 활동로그 한글화 | logs/page.tsx | 없음 |
| **5** | 비캠페인 업무 scope 도입 | DB migration, tasks/page.tsx, assignee-grid.tsx, campaign-grid.tsx | 단계1,2 |
| **6** | 캠페인 세팅 매트릭스 뷰 | manage/configs/page.tsx (or new component) | 없음 |

---

## 4. 영향 범위

### 변경 파일 (예상)
- `components/views/status-cell.tsx` - 상태 사이클 변경
- `hooks/use-update-check-status.ts` - assigned_user_id 처리
- `components/views/assignee-grid.tsx` - 완료율 로직, global task 섹션
- `components/views/campaign-grid.tsx` - 완료율 로직, global task 필터
- `app/(main)/logs/page.tsx` - 한글화 로직
- `app/(main)/manage/configs/page.tsx` - 매트릭스 뷰 추가
- `app/(main)/manage/tasks/page.tsx` - scope 필드 UI
- `lib/types/database.ts` - Task scope 타입 추가
- `supabase/migrations/` - scope 컬럼 추가 마이그레이션

### DB 변경
- `tasks` 테이블: `scope` 컬럼 추가 (`'campaign' | 'global'`, default `'campaign'`)
- `daily_checks` 테이블: `campaign_id` nullable 확인 (global task용)

### 하위 호환성
- 기존 모든 task는 `scope = 'campaign'`으로 유지 (기본값)
- 기존 완료율 계산은 해당없음 제외 → 포함으로 변경 (사용자 요청)

---

## 5. 리스크 및 고려사항

| 리스크 | 대응 |
|--------|------|
| daily_checks의 campaign_id NOT NULL 제약 | global task는 campaign_id를 특수값 or nullable로 처리 |
| scope 변경 시 기존 daily_checks 데이터 정합성 | 마이그레이션 스크립트로 처리 |
| 매트릭스 뷰 성능 (45캠페인 × 16항목) | 가상 스크롤 불필요 (720셀 정도로 적음) |
| 해당없음 = 완료 처리 시 실제 미수행 업무 파악 어려움 | 완료율 표시 시 (완료+해당없음)/전체 형태로 구분 표시 |
