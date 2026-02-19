# Plan: 캠페인 유형별 관리 (해외마케팅 / 국내챗닥)

## 1. 배경 및 목표

### 현재 상태
- campaigns 테이블이 **해외마케팅 전용** 필드로만 구성됨
- 필드: client_name, campaign_name, target_country, monthly_fixed_cost, cost_per_influencer, influencer_fee_budget, interpreter_status 등
- "밝은눈안과 강남점" 같은 **국내챗닥** 거래처를 등록할 방법이 없음

### 목표
- 캠페인 유형(`campaign_type`)을 도입하여 **해외마케팅**과 **국내챗닥** 구분
- 유형에 따라 다른 입력 필드를 보여주는 UI
- 국내챗닥 거래처가 많아질 것을 고려한 확장 가능한 설계
- 기존 해외마케팅 캠페인 데이터 무손실 유지

---

## 2. 설계 방향

### 접근법: 단일 테이블 + campaign_type 컬럼

campaigns 테이블에 `campaign_type` 컬럼을 추가하고, 유형별 전용 필드를 nullable 컬럼으로 추가한다.

**이유:**
- 공통 필드가 많음 (client_name, campaign_name, status, start_date 등)
- 별도 테이블 분리 시 JOIN 복잡성 증가, 리스트 뷰에서 통합 표시 어려움
- campaign_configs(세팅) 등 기존 연관 테이블과의 관계 유지 용이

---

## 3. DB 스키마 변경

### 3-1. 새 컬럼 추가 (Migration)

```sql
-- campaign_type: 캠페인 유형 구분
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT '해외마케팅'
  CHECK (campaign_type IN ('해외마케팅', '국내챗닥'));

-- 국내챗닥 전용 필드
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS chatdoc_onboarding_done BOOLEAN DEFAULT FALSE,  -- 온보딩 완료 여부
  ADD COLUMN IF NOT EXISTS chatdoc_roas_target NUMERIC,                    -- ROAS 목표 배수
  ADD COLUMN IF NOT EXISTS chatdoc_status TEXT DEFAULT '대기'              -- 국내챗닥 진행 상태
  CHECK (chatdoc_status IN ('대기', '온보딩중', '운영중', '종료'));

-- 기존 모든 캠페인을 '해외마케팅'으로 backfill (DEFAULT으로 자동 적용)
```

### 3-2. 필드 분류

| 필드 | 해외마케팅 | 국내챗닥 | 공통 |
|------|:---:|:---:|:---:|
| client_name | | | O |
| campaign_name | | | O |
| status (active/paused/completed) | | | O |
| start_date | | | O |
| homepage_url | | | O |
| campaign_type | | | O |
| target_country | O | | |
| monthly_fixed_cost | O | | |
| cost_per_influencer | O | | |
| influencer_fee_budget | O | | |
| interpreter_status | O | | |
| phase (onboarding/running/scaling) | O | | |
| chatdoc_onboarding_done | | O | |
| chatdoc_roas_target | | O | |
| chatdoc_status | | O | |

---

## 4. TypeScript 타입 변경

```typescript
export type CampaignType = '해외마케팅' | '국내챗닥';
export type ChatdocStatus = '대기' | '온보딩중' | '운영중' | '종료';

export interface Campaign {
  // ... 기존 필드 유지 ...
  campaign_type: CampaignType;
  // 국내챗닥 전용
  chatdoc_onboarding_done: boolean | null;
  chatdoc_roas_target: number | null;
  chatdoc_status: ChatdocStatus | null;
}
```

---

## 5. UI 변경

### 5-1. 캠페인 생성/수정 Dialog

- 상단에 **캠페인 유형 선택** 탭 or 라디오 버튼 추가
  - `해외마케팅` (기본값) / `국내챗닥`
- 유형 선택 시 해당 유형의 필드만 표시
- **해외마케팅 선택 시**: 현재와 동일한 필드
- **국내챗닥 선택 시**:
  - client_name, campaign_name (공통)
  - chatdoc_onboarding_done (스위치)
  - chatdoc_roas_target (숫자 입력)
  - start_date (날짜)
  - chatdoc_status (Select: 대기/온보딩중/운영중/종료)
  - homepage_url (선택)

### 5-2. 캠페인 목록 테이블

- `campaign_type` 컬럼 추가 (Badge로 표시: 해외마케팅=blue, 국내챗닥=purple)
- 유형별 필터 추가
- 국내챗닥: 비용 관련 컬럼 대신 ROAS/온보딩 표시
- 인라인 편집도 유형에 맞게 분기

### 5-3. 캠페인 세팅 (campaign_configs)

- 국내챗닥 유형에는 해외마케팅 전용 세팅 항목 미적용
- 추후 국내챗닥 전용 세팅 템플릿 추가 가능

---

## 6. 구현 순서

1. **Migration 작성** - campaign_type, chatdoc_* 컬럼 추가
2. **TypeScript 타입 업데이트** - CampaignType, ChatdocStatus 추가
3. **캠페인 생성/수정 Dialog 수정** - 유형 선택 + 조건부 필드 표시
4. **캠페인 목록 테이블 수정** - 유형 Badge, 필터, 인라인 편집 분기
5. **캠페인 세팅 연동** - 유형별 config 템플릿 분기
6. **빌드 검증**

---

## 7. 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `supabase/migrations/012_add_campaign_type.sql` | 신규 |
| `lib/types/database.ts` | CampaignType, ChatdocStatus 타입, Campaign 인터페이스 확장 |
| `app/(main)/manage/campaigns/page.tsx` | Dialog 유형 선택, 테이블 유형 컬럼/필터, 인라인 편집 분기 |
| `app/(main)/manage/configs/page.tsx` | 유형별 config 템플릿 분기 |
| `components/manage/config-matrix.tsx` | 국내챗닥 캠페인 표시 처리 |
| `components/manage/config-dashboard.tsx` | 유형별 통계 분기 |
