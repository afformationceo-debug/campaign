# Plan: UI Premium Redesign & Performance Optimization

> Feature: `ui-premium-redesign`
> Created: 2026-02-17
> Phase: Plan

---

## 1. 개요

기존 DB, API, 백엔드 로직을 **일절 변경하지 않고** 프론트엔드 UI/UX만 전면 리디자인.
모든 9개 페이지를 사용자 관점에서 더 편리하고, 시각적으로 트렌디하며, 성능이 최적화된 형태로 개선한다.

### 핵심 원칙
- **Zero Backend Change**: DB 스키마, Supabase API, RLS 정책, Edge Function 등 일절 미변경
- **Data Flow 보존**: useQuery 키, mutation 로직, realtime subscription 등 기존 데이터 흐름 유지
- **Progressive Enhancement**: framer-motion 추가로 모션 강화, 기존 tw-animate-css와 공존

---

## 2. 대상 페이지 (9개)

| # | 페이지 | 경로 | 현재 상태 |
|---|--------|------|-----------|
| 1 | 대시보드 | `/dashboard` | 기본 카드 + recharts, 정적 레이아웃 |
| 2 | 담당자별 | `/view/assignee` | 매트릭스 테이블, 글로벌 업무 섹션 |
| 3 | 캠페인별 | `/view/campaign` | 매트릭스 테이블, 세로 텍스트 헤더 |
| 4 | 캠페인 관리 | `/manage/campaigns` | DataTable 기반 CRUD |
| 5 | 행위 관리 | `/manage/tasks` | DataTable 기반 CRUD |
| 6 | Task 적용설정 | `/manage/task-config` | 캠페인별 토글 설정 |
| 7 | 담당자 관리 | `/manage/users` | DataTable 기반 CRUD |
| 8 | 캠페인 세팅 | `/manage/configs` | 개별 세팅 + 매트릭스 뷰 탭 |
| 9 | 활동 로그 | `/logs` | 시간순 로그 리스트 |

---

## 3. 공통 디자인 개선사항

### 3.1 디자인 시스템 업그레이드
- **Glassmorphism 카드**: `backdrop-blur-xl bg-white/70 dark:bg-gray-900/70` 스타일 적용
- **Gradient Accent**: 주요 CTA 버튼에 미세한 그래디언트 (`from-primary to-primary/80`)
- **Micro-interactions**: 모든 클릭/호버에 scale + opacity 트랜지션
- **framer-motion 도입**: 페이지 전환, 리스트 stagger, 카드 등장 애니메이션
- **Typography 개선**: 제목은 더 bold + tracking-tight, 본문은 가독성 최적화
- **Spacing 시스템**: 일관된 gap-4/gap-6 리듬

### 3.2 레이아웃 & 네비게이션
- **Sidebar**: 아이콘 hover tooltip, active 상태 gradient indicator bar
- **Header**: 유저 아바타 드롭다운 개선, breadcrumb 추가
- **Page Transition**: framer-motion `AnimatePresence`로 페이지 간 fade 전환
- **반응형 강화**: 모바일에서 bottom navigation bar 추가 고려

### 3.3 색상 & 테마
- **oklch 팔레트 미세 조정**: 더 선명한 primary, 더 부드러운 secondary
- **Status 색상 강화**: 완료=에메랄드, 진행중=앰버, 미완료=그레이, 해당없음=슬레이트
- **다크모드 개선**: 더 깊은 배경, 더 선명한 보더, 카드 간 계층감

---

## 4. 페이지별 상세 개선 계획

### 4.1 대시보드 (`/dashboard`)
**UX 개선:**
- KPI 카드에 전일 대비 증감 표시 (↑↓ 아이콘 + 색상)
- 차트 hover시 상세 tooltip 강화
- "빠른 액션" 영역: 오늘 미완료 항목 바로 클릭하여 완료 처리
- 담당자별 현황 테이블에 미니 progress bar 추가

**디자인 개선:**
- KPI 카드를 glassmorphism + 아이콘 배경 오버레이
- recharts 커스텀 테마 (그래디언트 fill, 부드러운 곡선)
- 카드 등장 시 stagger 애니메이션
- 섹션별 구분을 subtle gradient divider로
- 전체 레이아웃을 CSS Grid 기반으로 재구성 (auto-fit 반응형)

### 4.2 담당자별 일일 체크 (`/view/assignee`)
**UX 개선:**
- 테이블 헤더 sticky 개선 (스크롤 시 그림자 효과)
- 셀 hover시 해당 행+열 하이라이트 (크로스헤어 효과)
- 담당자 이름 옆에 미니 아바타/이니셜 뱃지
- 완료율 컬럼에 animated circular progress
- 전역 업무 섹션에 체크박스 스타일 대신 카드 스타일

**디자인 개선:**
- 카테고리 그룹 헤더에 미세 gradient background
- StatusCell 호버 시 scale-105 + shadow-lg 트랜지션
- 완료 시 confetti 또는 pulse 효과
- 테이블 border를 얇은 separator로 변경 (더 클린)

### 4.3 캠페인별 전체 행위 체크 (`/view/campaign`)
**UX 개선:**
- 캠페인 행 클릭 시 사이드 패널 슬라이드 인 (상세 정보)
- 필터 바에 "활성 캠페인만" 퀵 토글
- 완료율 100% 캠페인은 시각적으로 구분 (그린 틴트)
- 카테고리별 소계 표시 옵션

**디자인 개선:**
- 세로 텍스트 헤더에 호버 시 가로 팝오버로 전체 이름 표시
- 완료율 셀을 mini donut chart로 변경
- 행 간 zebra striping 대신 hover highlight
- 스크롤 시 좌측 캠페인 열에 그림자 효과

### 4.4 캠페인 관리 (`/manage/campaigns`)
**UX 개선:**
- 카드뷰 / 테이블뷰 토글 제공
- 캠페인 상태별 필터 칩 (active/paused/completed)
- 인라인 수정 (더블클릭으로 즉시 편집)
- 벌크 액션 (여러 캠페인 선택 → 일괄 상태 변경)

**디자인 개선:**
- 카드뷰: 그래디언트 보더 + 상태 indicator dot
- 생성/수정 다이얼로그를 스텝 위저드 형태로
- 상태 뱃지 디자인 개선 (pill shape + icon)

### 4.5 행위 관리 (`/manage/tasks`)
**UX 개선:**
- 드래그 앤 드롭으로 순서 변경
- 카테고리별 그룹핑 뷰 옵션
- 인라인 편집 모드

**디자인 개선:**
- 카테고리 색상 코딩 더 선명하게
- 스코프 뱃지 아이콘 추가 (🌐 전역, 📋 캠페인)
- 행 호버 시 액션 버튼 fade-in

### 4.6 Task 적용설정 (`/manage/task-config`)
**UX 개선:**
- 캠페인 선택 후 토글 변경 시 즉시 반영 확인 toast
- 일괄 적용/해제 버튼
- 변경 사항 카운터 표시

**디자인 개선:**
- Switch 토글 커스텀 스타일 (on: green glow, off: gray)
- 카테고리별 섹션 접기/펼치기 (Accordion)
- 적용/미적용 상태 시각적 대비 강화

### 4.7 담당자 관리 (`/manage/users`)
**UX 개선:**
- 사용자 카드에 담당 캠페인 수, 오늘 완료율 미니 통계
- 프로필 사진/아바타 업로드
- 역할별 권한 시각화

**디자인 개선:**
- 카드 레이아웃 옵션 (아바타 중심)
- 온라인 상태 indicator (초록 점)
- 역할 뱃지 디자인 개선

### 4.8 캠페인 세팅 (`/manage/configs`)
**UX 개선:**
- 매트릭스 뷰에서 셀 클릭 시 인라인 값 편집
- 설정 카테고리별 탭 분리
- 미완료 설정 하이라이트

**디자인 개선:**
- 매트릭스 셀 색상 코딩 강화 (완료: 녹색, 미완료: 적색, 없음: 회색)
- 완료율 프로그레스 바 추가
- 탭 디자인을 pill 스타일로

### 4.9 활동 로그 (`/logs`)
**UX 개선:**
- 타임라인 뷰 옵션 (시간순 세로 타임라인)
- 필터: 액션 타입, 대상 테이블, 사용자별
- 실시간 새 로그 push 알림 (상단에 "N개 새 활동" 배너)
- 변경 전/후 diff를 시각적 비교 (green/red highlight)

**디자인 개선:**
- 타임라인 UI (왼쪽 시간축 + 오른쪽 카드)
- 액션별 아이콘 (생성: +, 수정: ✏️, 삭제: 🗑️)
- 카드 호버 시 expand 애니메이션

---

## 5. 성능 최적화 계획

### 5.1 번들 최적화
- **Dynamic Import**: 각 페이지 컴포넌트 `next/dynamic` lazy loading
- **Tree Shaking**: lucide-react 아이콘 개별 임포트 확인
- **recharts lazy**: 대시보드 차트 컴포넌트만 dynamic import

### 5.2 렌더링 최적화
- **React.memo**: StatusCell, Badge 등 반복 렌더되는 셀 컴포넌트 메모이제이션
- **useMemo/useCallback 검증**: 기존 코드의 불필요한 재계산 제거
- **Virtual Scrolling**: 캠페인 45개 × 태스크 36개 매트릭스에 `@tanstack/react-virtual` 도입
- **Optimistic Updates 강화**: 모든 mutation에 optimistic update 패턴 적용 확인

### 5.3 데이터 페칭 최적화
- **staleTime 조정**: 자주 변하지 않는 데이터(tasks, campaigns)는 5분 stale
- **prefetch**: 사이드바 링크 hover 시 다음 페이지 데이터 prefetch
- **Parallel Queries**: useQueries로 독립 쿼리 병렬 실행

### 5.4 CSS 최적화
- **will-change**: 애니메이션 대상 요소에 GPU 가속 힌트
- **contain**: 매트릭스 셀에 `contain: content` 적용으로 레이아웃 격리
- **Critical CSS**: globals.css에서 사용하지 않는 스타일 제거

---

## 6. 기술 스택 추가

| 패키지 | 용도 | 비고 |
|--------|------|------|
| `framer-motion` | 페이지 전환, 리스트 애니메이션 | ~40KB gzipped |
| `@tanstack/react-virtual` | 대형 매트릭스 가상 스크롤 | ~5KB gzipped |

---

## 7. 구현 순서

| 순서 | 작업 | 예상 범위 | 우선순위 |
|------|------|-----------|----------|
| 1 | 공통 디자인 시스템 (globals.css, 공통 컴포넌트) | 테마, 애니메이션, 레이아웃 | P0 |
| 2 | Sidebar + Header 리디자인 | layout 컴포넌트 | P0 |
| 3 | 대시보드 리디자인 | 가장 첫인상 | P0 |
| 4 | 담당자별 뷰 리디자인 | 핵심 업무 화면 | P0 |
| 5 | 캠페인별 뷰 리디자인 | 핵심 업무 화면 | P0 |
| 6 | 성능 최적화 (virtual scroll, memo, dynamic import) | 전체 | P1 |
| 7 | 캠페인 관리 리디자인 | 관리 화면 | P1 |
| 8 | 행위 관리 + Task 적용설정 리디자인 | 관리 화면 | P1 |
| 9 | 담당자 관리 + 캠페인 세팅 리디자인 | 관리 화면 | P1 |
| 10 | 활동 로그 리디자인 | 부가 화면 | P2 |

---

## 8. 제약 조건

- **절대 불변**: DB 스키마, Supabase API 호출, RLS 정책, Edge Function
- **절대 불변**: useQuery 키 구조, mutation 로직, realtime subscription
- **절대 불변**: 라우팅 구조 (app/(auth), app/(main) 그룹)
- **변경 가능**: 컴포넌트 JSX/TSX, CSS 클래스, 레이아웃 구조, 새 UI 컴포넌트 추가
- **추가 가능**: framer-motion, @tanstack/react-virtual 등 프론트엔드 전용 패키지

---

## 9. 리스크 분석

| 리스크 | 영향 | 대응 |
|--------|------|------|
| framer-motion 번들 사이즈 증가 | 초기 로딩 느려짐 | dynamic import로 lazy load |
| 과도한 애니메이션으로 UX 저하 | 사용자 피로감 | 핵심 인터랙션에만 적용, `prefers-reduced-motion` 존중 |
| virtual scroll 도입 시 기존 sticky 레이아웃 호환 | 매트릭스 깨짐 | 점진적 적용, 폴백 유지 |
| 디자인 변경 중 기능 regression | 기존 기능 동작 불가 | 기능 단위 검증 후 커밋 |

---

## 10. 성공 기준

- [ ] 모든 9개 페이지 리디자인 완료
- [ ] Lighthouse Performance 점수 90+ 유지
- [ ] 기존 모든 기능 정상 동작 (regression 없음)
- [ ] 다크모드 완벽 지원
- [ ] 모바일 반응형 개선
- [ ] framer-motion 페이지 전환 적용
- [ ] 매트릭스 뷰 스크롤 성능 개선
