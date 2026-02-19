# AI Summary Feature Plan

## 1. Feature Overview

**Feature Name**: AI 현황 요약 (AI Status Summary)
**Goal**: OpenAI API를 연동하여 시스템 전체 데이터를 분석하고, 담당자별/캠페인별/일일결과/프로젝트/QA/캠페인세팅 등 전방위적 요약을 제공하는 기능

## 2. Problem Statement

현재 대시보드는 차트와 숫자 위주의 정량적 데이터만 표시합니다. 관리자가 "현재 전체 상황이 어떤가?"를 파악하려면 여러 페이지를 직접 돌아다니며 확인해야 합니다. AI가 데이터를 종합 분석하여 자연어 요약을 제공하면, 한눈에 전체 현황을 파악하고 액션 아이템을 도출할 수 있습니다.

## 3. Data Sources (6 dimensions)

### 3-1. 담당자별 (users + daily_checks)
- 각 담당자의 오늘/이번주 업무 완료율
- 미완료 업무 목록, 지연 패턴
- 담당 캠페인 수와 업무 부하

### 3-2. 캠페인별 (campaigns + campaign_task_config + daily_checks)
- 캠페인 상태(active/paused/completed), 단계(onboarding/running/scaling)
- 캠페인별 업무 완료율
- 비용 정보 (월고정비, 인플루언서비용, 원고료예산)

### 3-3. 일일 결과값 (daily_checks with result_value)
- 오늘의 업무 수행 결과 (완료/진행중/미완료 비율)
- result_value가 입력된 주요 결과물
- 특이사항 (해당없음 처리된 업무)

### 3-4. 프로젝트 로드맵 (projects + project_tasks)
- 프로젝트 진행 상태 분포 (진행전/진행중/완료)
- 마감일 임박 프로젝트/업무
- 각 프로젝트 하위 태스크 완료율

### 3-5. QA 관리 (campaign_qa)
- 미해결/진행중/해결완료 현황
- 우선순위별 분포 (긴급/높음/보통/낮음)
- 캠페인별 QA 이슈 집중도

### 3-6. 캠페인 세팅 (campaign_configs)
- 해외마케팅 세팅 완료율 (항목별)
- 국내챗닥 세팅 완료율
- 미완료 세팅 항목 목록

## 4. Architecture

### 4-1. API Route (Server-side)

```
app/api/ai-summary/route.ts
```

- Next.js Route Handler (POST)
- Server-side에서 Supabase service role key로 전체 DB 조회
- OpenAI API 호출 (gpt-4o-mini 또는 gpt-4o)
- Streaming response로 실시간 텍스트 출력

**선택 이유**:
- OpenAI API key는 서버에서만 사용 (클라이언트 노출 방지)
- Service role key로 RLS 우회하여 전체 데이터 접근
- Streaming으로 사용자 대기 시간 최소화

### 4-2. Data Fetching Strategy

```
[Client] POST /api/ai-summary { dimension: 'all' | 'assignee' | 'campaign' | ... }
    ↓
[Server] Supabase 6개 테이블 병렬 조회
    ↓
[Server] 데이터 집계/요약 (raw data → structured summary)
    ↓
[Server] OpenAI Chat Completion (streaming)
    ↓
[Client] ReadableStream으로 실시간 텍스트 렌더링
```

### 4-3. Data Pre-processing (Token 최적화)

OpenAI에 raw DB 데이터를 보내면 토큰이 과다 소모됩니다. 서버에서 먼저 집계한 뒤 구조화된 요약 데이터만 전송합니다:

```typescript
// 예시: 캠페인별 요약 데이터
{
  total_campaigns: 6,
  by_status: { active: 5, paused: 1 },
  by_phase: { onboarding: 1, running: 3, scaling: 2 },
  campaigns: [
    {
      name: "강남라움스마일안과 대만",
      status: "active", phase: "running",
      completion_rate: 85,    // 오늘 기준 업무 완료율
      pending_tasks: ["커뮤니티 확인", "DM 발송"],
      config_completion: 70,  // 세팅 완료율
      cost_summary: "월고정 200만, 인플 50만/건"
    },
    ...
  ]
}
```

## 5. System Prompt Design

```
당신은 Afformation 캠페인 관리 시스템의 AI 분석가입니다.

## 역할
제공된 데이터를 분석하여 현재 운영 상황을 한국어로 요약하고, 실행 가능한 인사이트를 도출합니다.

## 응답 원칙
1. **구체적 수치** 포함: "완료율 85%" 같은 정량적 표현 사용
2. **우선순위** 명시: 긴급/중요한 사항을 먼저 언급
3. **액션 아이템** 제시: "~을 확인하세요", "~에 대응이 필요합니다" 형태
4. **캠페인명/담당자명** 실명 사용: 데이터에 있는 이름 그대로 활용
5. **간결한 구조**: 소제목, 불릿 포인트, 이모지를 활용한 가독성 높은 포맷

## 데이터 해석 기준
- 업무 완료율 90% 이상: 양호
- 업무 완료율 70~89%: 주의 필요
- 업무 완료율 70% 미만: 긴급 대응 필요
- QA 미해결 '긴급' 항목: 즉시 보고
- 프로젝트 마감일 3일 이내: 마감 임박 경고
- 캠페인 세팅 미완료 항목: 온보딩 캠페인 우선

## 응답 포맷

### 📊 전체 현황 요약
(1-2문장 핵심 요약)

### 👥 담당자별 현황
(담당자별 완료율, 주의 필요한 담당자 강조)

### 🏢 캠페인별 현황
(캠페인별 상태, 주요 이슈)

### 📋 오늘의 업무 결과
(완료율, 주요 미완료 업무)

### 🗺️ 프로젝트 로드맵
(진행 상태, 마감 임박 항목)

### ⚠️ QA/이슈 현황
(미해결 이슈, 우선순위별)

### ⚙️ 캠페인 세팅 현황
(완료율, 미완료 핵심 항목)

### 🎯 오늘의 액션 아이템
(우선순위순 할 일 목록)
```

## 6. UI Design

### 6-1. 진입점: 대시보드 AI 요약 버튼

대시보드 상단에 "AI 현황 요약" 버튼을 배치합니다.

```
┌─────────────────────────────────────────────────┐
│  대시보드                    [🤖 AI 현황 요약]  │
│─────────────────────────────────────────────────│
│  (기존 대시보드 내용)                            │
└─────────────────────────────────────────────────┘
```

### 6-2. AI 요약 Sheet (Side Panel)

버튼 클릭 시 오른쪽에서 Sheet(Drawer)가 슬라이드하며 열립니다.

```
┌──────────────────────┬──────────────────────────┐
│                      │  🤖 AI 현황 요약          │
│                      │  ─────────────────────── │
│                      │  📊 전체 현황 요약        │
│  (기존 대시보드)      │  현재 6개 캠페인 운영중...│
│                      │                          │
│                      │  👥 담당자별 현황          │
│                      │  • 김정원: 완료율 92%     │
│                      │  • 이주현: 완료율 78% ⚠️  │
│                      │  ...                     │
│                      │                          │
│                      │  [🔄 다시 분석]           │
└──────────────────────┴──────────────────────────┘
```

### 6-3. 주요 UI 요소

| 요소 | 설명 |
|---|---|
| Sheet (shadcn/ui) | 오른쪽 사이드 패널, 최소 400px 폭 |
| Streaming text | 타이핑 효과로 실시간 텍스트 출력 |
| Markdown 렌더링 | AI 응답의 헤더, 볼드, 리스트 등 렌더링 |
| Dimension 필터 | 전체/담당자별/캠페인별 등 선택 가능 |
| 다시 분석 버튼 | 최신 데이터로 재분석 |
| 로딩 상태 | Skeleton + "데이터를 분석하고 있습니다..." |
| 복사 버튼 | 요약 결과를 클립보드에 복사 |

### 6-4. Dimension 필터 탭

```
┌─────────────────────────────────────────────┐
│ [전체] [담당자] [캠페인] [업무] [프로젝트] [QA] [세팅] │
│─────────────────────────────────────────────│
│ (선택된 dimension에 맞는 AI 요약 표시)        │
└─────────────────────────────────────────────┘
```

- "전체" 선택 시 모든 dimension 종합 요약
- 개별 dimension 선택 시 해당 영역만 심화 분석

## 7. Technical Stack

| 항목 | 선택 | 이유 |
|---|---|---|
| AI Model | OpenAI gpt-4o-mini | 빠른 응답, 저비용, 한국어 우수 |
| API Route | Next.js Route Handler | 서버에서 API key 보호 |
| Streaming | OpenAI streaming + ReadableStream | 실시간 UX |
| Markdown | react-markdown + remark-gfm | AI 응답 렌더링 |
| UI | Sheet (shadcn/ui) | 기존 레이아웃 유지하며 사이드 패널 |
| State | useState + useRef | 간단한 로컬 상태 관리 |

## 8. Environment Variables (추가)

```
OPENAI_API_KEY=sk-...
```

## 9. File Structure

```
app/
  api/
    ai-summary/
      route.ts              # POST handler (streaming)
  (main)/
    dashboard/
      page.tsx              # AI 요약 버튼 추가

components/
  dashboard/
    ai-summary-sheet.tsx    # Sheet UI + streaming 렌더링
    ai-summary-button.tsx   # 트리거 버튼

lib/
  ai/
    build-context.ts        # DB 데이터 → AI context 변환
    system-prompt.ts        # System prompt 상수
    types.ts                # AI 관련 타입 정의
```

## 10. Implementation Order

1. **환경설정**: `.env.local`에 OPENAI_API_KEY 추가, `openai` 패키지 설치
2. **lib/ai/**: system-prompt, build-context, types 작성
3. **API Route**: `app/api/ai-summary/route.ts` - DB 조회 + OpenAI streaming
4. **UI Components**: ai-summary-sheet.tsx, ai-summary-button.tsx
5. **Dashboard 연동**: 대시보드에 버튼 추가
6. **빌드 검증 + 커밋**

## 11. Security Considerations

- OpenAI API key는 서버측(Route Handler)에서만 사용
- Supabase service role key로 DB 조회 (이미 환경변수에 존재)
- 인증된 사용자만 API 호출 가능 (세션 체크)
- Rate limiting 고려 (1분에 최대 3회 등)

## 12. Cost Estimation

| Model | Input (6 dimension 전체) | Output | 예상 비용/회 |
|---|---|---|---|
| gpt-4o-mini | ~3,000 tokens | ~2,000 tokens | ~$0.002 |
| gpt-4o | ~3,000 tokens | ~2,000 tokens | ~$0.025 |

- 하루 10회 사용 가정: gpt-4o-mini 기준 월 $0.6, gpt-4o 기준 월 $7.5
- **권장: gpt-4o-mini** (비용 대비 충분한 품질)

## 13. Acceptance Criteria

- [ ] 대시보드에서 "AI 현황 요약" 버튼 클릭 시 사이드 패널 열림
- [ ] 6개 dimension 데이터가 서버에서 집계되어 AI에 전달됨
- [ ] OpenAI 응답이 streaming으로 실시간 표시됨
- [ ] Markdown 포맷이 올바르게 렌더링됨
- [ ] 개별 dimension 필터 선택 시 해당 영역만 심화 분석
- [ ] 다시 분석 버튼으로 최신 데이터 반영
- [ ] API key가 클라이언트에 노출되지 않음
- [ ] 빌드 성공
