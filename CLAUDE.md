# Campaign Management System - Development Guide

## Project Overview
- **Framework**: Next.js 16 (Turbopack) + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **State Management**: TanStack Query (React Query) + Zustand (sidebar only)
- **UI**: Radix UI + Tailwind CSS + Framer Motion
- **Deployment**: Vercel (auto-deploy on push to main)

## Modification Development Rules

### 1. Pre-Development Analysis
- Read and fully understand the target file(s) before making any changes
- Identify all components, hooks, mutations, and queries affected by the change
- Check for cross-dependencies with other pages/features (grep for shared query keys, types, utils)
- Map out the render tree to understand re-render impact

### 2. Change Scope Minimization
- Only modify what is strictly necessary for the fix/feature
- Do NOT change table rendering, data fetching, or mutation logic unless directly related
- Preserve all existing Supabase queries, optimistic updates, and activity logging
- Keep UI/UX appearance identical unless redesign is requested

### 3. Verification Checklist (Before Push)
- [ ] **TypeScript**: `npx tsc --noEmit` — zero errors on modified files
- [ ] **Build**: `npx next build` — compile success (ignore pre-existing SSR errors on unrelated pages)
- [ ] **Functional**: Verify the specific fix works as intended
- [ ] **Regression**: Confirm other features on the same page still work (filters, inline edit, mutations, etc.)
- [ ] **Backend**: Supabase queries/mutations unchanged or backward-compatible
- [ ] **Deploy**: No env variable changes required (or documented if needed)

### 4. Performance Patterns
- Use `React.memo` for reusable sub-components (InlineTextCell, InlineDateCell, etc.)
- Use uncontrolled inputs (ref + defaultValue) for text fields in heavy dialogs to avoid re-renders
- Extract dialogs/modals into separate memo'd components when they contain form state
- Use `useCallback` for event handlers passed to child components
- Avoid storing transient input state (typing) in parent component state

### 5. Architecture Notes
- Pages are monolithic `'use client'` components under `app/(main)/`
- No dedicated hook files for QA — all logic is inline in page component
- Query keys defined in `lib/utils/query-keys.ts`
- Activity logging via `lib/utils/log-activity.ts` after every mutation
- Motion variants in `lib/utils/motion.ts` (staggerContainer, fadeUpItem)

## Key File Paths
- **QA Management**: `app/(main)/manage/qa/page.tsx`
- **Database Types**: `lib/types/database.ts`
- **Supabase Client**: `lib/supabase/client.ts`
- **Query Keys**: `lib/utils/query-keys.ts`
- **Auth Hook**: `hooks/use-auth.ts`
- **Sidebar Nav**: `components/layout/sidebar.tsx`
- **크몽 응대매뉴얼 페이지**: `app/(main)/manuals/kmong/page.tsx`
- **CS 템플릿 컴포넌트**: `components/manuals/cs-template-viewer.tsx`
- **CS 매뉴얼 DB 마이그레이션**: `supabase/migrations/20260326_cs_manual_playbook.sql`

## CS Manual Playbook (크몽 응대매뉴얼)
- **DB 구조**: `cs_manual_services` → `cs_manual_steps` → `cs_manual_templates` (3단 계층)
- **서비스 카테고리**: 인플루언서 마케팅 / 솔루션 도입 / 앱·웹 개발
- **변수 치환**: `{변수명}` 형태의 플레이스홀더 → 프론트에서 실시간 치환 + 1클릭 복사
- **권한**: 전 직원 조회/수정/삭제 가능 (RLS: authenticated)
- **Query Keys**: `csManual.services`, `csManual.steps(serviceId)`, `csManual.templates(stepId)`

## Environment
- `.env.local` required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Do NOT commit `.env.local` to git
