# Plan: Project Roadmap Management

## Feature Name
`project-roadmap` - 프로젝트 로드맵 관리 시스템

## Background
현재 어포메이션 CMS는 캠페인별/담당자별 일일 체크 관리에 특화되어 있음.
그러나 실제 업무에서는 "어포메이션", "영업관리시스템", "스카웃매니저" 등 **대형 프로젝트 단위**로도 관리가 필요.
각 프로젝트에는 하위 업무(sub-task)들이 있고, 담당자/마감일/상태/메모 등이 필요함.
현재 이 데이터는 CSV 파일(`2026_어포메이션_로드맵.csv`)로 관리 중이며, DB화 및 CMS 통합이 필요.

## CSV 데이터 구조 분석
```
| Column   | Description         | Example                              |
|----------|---------------------|--------------------------------------|
| key      | 프로젝트 이름        | 어포메이션, 영업관리시스템              |
| url      | 관련 URL            | https://campaign-chi-dun.vercel.app/ |
| value    | 하위 업무 목록(텍스트) | 0. 백엔드 개발\n1. 프론트엔드 개발...  |
| who      | 담당자              | 지현근                                |
| due date | 마감일              | 2026-02-19                           |
| state    | 상태                | 진행중, 미완료                        |
| memo     | 메모                | 중요 내용 기록                        |
```

## Requirements

### 1. 백엔드 (DB + Migration)
- Supabase에 `projects` 테이블과 `project_tasks` 테이블 생성
- CSV 데이터를 파싱하여 초기 데이터 마이그레이션 (seed)
- RLS 정책: 인증된 사용자 전원 읽기, admin만 쓰기
- Realtime Publication 활성화
- Activity Log 연동

### 2. 양방향 연동
- UI에서 CRUD → Supabase에 즉시 반영
- Supabase에서 직접 변경 → Realtime으로 UI에 즉시 반영
- Optimistic Update 패턴 적용 (기존 패턴 준수)

### 3. UI 뷰 (다중 관점)
- **리스트 뷰**: 프로젝트 카드 목록, 각 카드에 하위 업무 진행률 표시
- **칸반 뷰**: 상태별(진행전/진행중/완료) 칸반 보드
- **테이블 뷰**: 전체 프로젝트+하위업무를 DataTable로 표시
- 모든 뷰에서 CRUD 가능 (추가/수정/삭제)

### 4. 다중 필터링
- 상태 필터: 진행전, 진행중, 완료
- 담당자 필터: 사용자 목록에서 선택
- 프로젝트 필터: 특정 프로젝트만 보기
- 검색: 프로젝트명, 하위업무명 텍스트 검색
- 필터 조합 가능 (AND 조건)

## Data Model

### `projects` 테이블
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  url TEXT,
  assignee_id UUID REFERENCES users(id),
  start_date DATE,
  due_date DATE,
  state TEXT NOT NULL DEFAULT '미완료' CHECK (state IN ('진행전', '진행중', '완료')),
  memo TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `project_tasks` 테이블
```sql
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '미완료' CHECK (state IN ('진행전', '진행중', '완료')),
  assignee_id UUID REFERENCES users(id),
  due_date DATE,
  sort_order INTEGER DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Implementation Steps

### Phase 1: Backend (DB + Migration)
1. SQL 마이그레이션 파일 작성 (`007_create_projects.sql`)
2. TypeScript 타입 정의 (`lib/types/database.ts`)
3. Query Keys 추가 (`lib/utils/query-keys.ts`)
4. CSV 파싱 → seed 스크립트 작성 및 실행
5. Supabase에서 테이블 생성 + RLS + Realtime 활성화

### Phase 2: Hooks & Utilities
6. `use-realtime-projects.ts` 리얼타임 훅
7. `use-realtime-project-tasks.ts` 리얼타임 훅
8. CRUD mutation 훅 작성
9. `logActivity` 연동

### Phase 3: UI Components
10. 사이드바에 "프로젝트 로드맵" 메뉴 추가
11. 프로젝트 리스트 뷰 (카드 기반)
12. 프로젝트 칸반 뷰 (상태별 드래그)
13. 프로젝트 테이블 뷰 (DataTable)
14. 프로젝트 상세 페이지 (하위 업무 CRUD)
15. 다중 필터 UI (상태/담당자/프로젝트/검색)
16. 뷰 전환 토글 (리스트/칸반/테이블)

### Phase 4: Integration & Polish
17. 대시보드에 프로젝트 요약 위젯 추가
18. 활동 로그 연동 확인
19. 반응형 디자인 (모바일 대응)
20. 에러 처리 및 로딩 상태

## Page Structure
```
app/(main)/
  roadmap/
    page.tsx              # 메인 뷰 (리스트/칸반/테이블 전환)
    [projectId]/
      page.tsx            # 프로젝트 상세 (하위 업무 관리)
```

## Sidebar Navigation
```ts
// 새로운 nav group 추가
const projectNav = [
  { href: '/roadmap', label: '프로젝트 로드맵', icon: Map },
];
```

## Success Criteria
- CSV 데이터가 DB에 완전 마이그레이션
- 모든 CRUD 작업이 양방향 실시간 반영
- 3가지 뷰(리스트/칸반/테이블) 모두 정상 작동
- 다중 필터링 정상 작동
- 활동 로그에 모든 변경사항 기록
- 모바일 반응형 지원

## Risk & Mitigation
| Risk | Mitigation |
|------|------------|
| CSV 파싱 오류 | 수동 검증 후 seed 실행 |
| 대량 데이터 성능 | fetchAll 페이지네이션 패턴 적용 |
| 칸반 드래그 복잡도 | 상태 변경 select/click으로 대체 가능 |
| RLS 정책 충돌 | 기존 패턴(is_admin) 그대로 적용 |
