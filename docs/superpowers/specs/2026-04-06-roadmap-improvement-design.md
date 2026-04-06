# Roadmap Page Improvement Design

> Date: 2026-04-06
> Status: Approved
> Approach: B (Modular Decomposition + Feature Addition)

## 1. Problem Statement

The roadmap page (`app/(main)/roadmap/page.tsx`, 1700 lines) has these critical issues:

1. **Vercel deployment error**: `window.alert()`, `toLocaleString()` cause SSR/hydration failures
2. **Two-level hierarchy only**: Project -> Task limits organizing complex multi-phase projects
3. **Poor content visibility**: Memo/result fields truncated at 11px, project context hidden behind popups
4. **No deadline warnings**: No visual urgency signals for overdue or imminent deadlines
5. **Status confusion**: Completed and in-progress items mixed without clear visual separation
6. **No assignee board view**: Can't see "what is each person responsible for?" at a glance
7. **RLS policy conflict**: Migration 007 (admin only) vs 016 (allow all) creates inconsistent permissions
8. **Monolithic component**: 1700-line single file is unmaintainable

## 2. Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hierarchy depth | 3 levels (Project -> Sub-Project -> Task) | Matches real data (CSV shows 3-level structure). Uses `parent_project_id` on existing `projects` table |
| Board view style | Kanban + Tree (per assignee) | Each assignee column shows project cards; expand reveals sub-project tree with tasks |
| Deadline alerts | Color badges + top summary banner | Overdue=red, 3-day=yellow, OK=green. Banner shows counts with clickable items |
| Permissions | All authenticated users can CRUD. Delete = admin only | CEO confirmed. RLS policies unified |
| Approach | Modular decomposition | Split 1700-line monolith into ~10 focused components (200-400 lines each) |

## 3. Database Schema Changes

### 3.1 New Migration: Add parent_project_id

```sql
-- Safe migration: ADD COLUMN with NULL default, no existing data affected
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);

-- Constraint: max 2 levels of nesting (root -> sub only, no sub-sub-projects)
-- Enforced in application code, not DB constraint (simpler migration)
```

**Backward compatibility**: All existing projects have `parent_project_id = NULL`, making them root-level projects. No data modification needed.

### 3.2 RLS Policy Cleanup

Current state analysis:
- 007 created: `projects_insert` (admin), `projects_update` (admin), `projects_delete` (admin)
- 016 dropped `projects_update` and recreated with `USING (true)` — but INSERT is still admin-only

```sql
-- Drop ALL existing write policies to start clean
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS project_tasks_insert ON project_tasks;
DROP POLICY IF EXISTS project_tasks_update ON project_tasks;

-- Unified policies: all authenticated can INSERT/UPDATE, admin-only DELETE
-- SELECT already allows all (from 007, unchanged)
CREATE POLICY projects_insert_auth ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY projects_update_auth ON projects FOR UPDATE USING (true);
-- Keep existing projects_delete from 007 (is_admin())

CREATE POLICY project_tasks_insert_auth ON project_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY project_tasks_update_auth ON project_tasks FOR UPDATE USING (true);
-- Keep existing project_tasks_delete from 007 (is_admin())
```

### 3.3 assignee_ids Column Addition + Consolidation

The `assignee_ids` column may not exist in the actual DB (only in TypeScript types). Migration ensures it exists:

```sql
-- Add assignee_ids array column if not exists
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}'::uuid[];

-- Migrate existing assignee_id data into assignee_ids
UPDATE projects SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');
UPDATE project_tasks SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');

-- Add trigger to auto-sync: assignee_id = assignee_ids[1] when assignee_ids changes
CREATE OR REPLACE FUNCTION fn_sync_assignee_id() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_ids IS NOT NULL AND array_length(NEW.assignee_ids, 1) > 0 THEN
    NEW.assignee_id = NEW.assignee_ids[1];
  ELSE
    NEW.assignee_id = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_sync_assignee ON projects;
CREATE TRIGGER trg_projects_sync_assignee BEFORE INSERT OR UPDATE OF assignee_ids ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_sync_assignee_id();

DROP TRIGGER IF EXISTS trg_project_tasks_sync_assignee ON project_tasks;
CREATE TRIGGER trg_project_tasks_sync_assignee BEFORE INSERT OR UPDATE OF assignee_ids ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_sync_assignee_id();
```

Application code:
- Read: check `assignee_ids` first, fall back to `[assignee_id]` if empty
- Write: always write to `assignee_ids`; DB trigger auto-syncs `assignee_id`

### 3.4 TypeScript Type Updates

Update `lib/types/database.ts`:
```typescript
export interface Project {
  // ... existing fields ...
  parent_project_id: string | null;  // NEW: for 3-level hierarchy
  assignee_ids: string[];            // ensure this exists
}
```

Update `hooks/use-project-mutations.ts`:
- Add `parent_project_id?: string | null` to `CreateProjectInput` and `UpdateProjectInput`
- Add `assignee_ids?: string[]` to both input types

### 3.5 Nesting Depth Validation

Max nesting depth (root -> sub) enforced in `useProjectTree` hook:
```typescript
// In useProjectTree: when building tree, skip any project whose parent 
// itself has a parent (would be 3rd level = too deep)
// In UI: hide "Add Sub-Project" button on sub-projects
```

## 4. Component Architecture

### 4.1 File Structure

```
app/(main)/roadmap/
  page.tsx                      -- Data fetching shell (~250 lines)
  [projectId]/page.tsx          -- Project detail (keep, fix errors)

components/roadmap/
  roadmap-header.tsx            -- Title + stats + AI button
  roadmap-deadline-banner.tsx   -- Overdue/imminent deadline warnings (NEW)
  roadmap-filters.tsx           -- Search, state/assignee filters, view toggle
  roadmap-bulk-actions.tsx      -- Bulk action bar (appears on selection)

  views/
    card-view.tsx               -- Card grid (extracted from monolith)
    kanban-view.tsx             -- Status-based kanban (extracted)
    table-view.tsx              -- Table with inline edit (extracted)
    grouped-view.tsx            -- Multi-level grouped table (extracted)
    board-view.tsx              -- Assignee board with kanban+tree (NEW)

  shared/
    project-tree-item.tsx       -- 3-level tree renderer (Root->Sub->Task) (NEW)
    inline-cells.tsx            -- InlineTextCell, InlineDateCell, InlineMemoCell
    expandable-text-cell.tsx    -- ExpandableTextCell (popup editor)
    project-form-dialog.tsx     -- Create/edit project dialog
    delete-confirm-dialog.tsx   -- Delete confirmation (shows project name!)
    project-detail-panel.tsx    -- Expanded project summary panel (NEW)

hooks/
  use-project-tree.ts           -- Builds 3-level tree from flat project list (NEW)
  use-deadline-alerts.ts        -- Calculates deadline status per project/task (NEW)
  use-project-mutations.ts      -- Existing (minor fixes: remove window.alert)
  use-realtime-projects.ts      -- Existing (no changes)
```

### 4.2 Data Flow

```
page.tsx (shell)
  ├── useQuery: projects (flat list)
  ├── useQuery: projectTasks (all tasks)
  ├── useQuery: users
  ├── useProjectTree(projects) -> { rootProjects, subProjectsByParent, tasksByProject }
  ├── useDeadlineAlerts(projects, tasks) -> { overdue, imminent, ok, banner }
  │
  ├── <RoadmapHeader stats={stats} />
  ├── <RoadmapDeadlineBanner alerts={alerts} />
  ├── <RoadmapFilters ... />
  ├── <RoadmapBulkActions ... /> (conditional)
  │
  └── Switch viewMode:
      ├── 'cards'   -> <CardView ... />
      ├── 'kanban'  -> <KanbanView ... />
      ├── 'table'   -> <TableView ... />
      ├── 'grouped' -> <GroupedView ... />
      └── 'board'   -> <BoardView ... />   (NEW)
```

### 4.3 useProjectTree Hook

```typescript
interface ProjectTreeNode {
  project: Project;
  subProjects: ProjectTreeNode[];  // children with parent_project_id = this.id
  tasks: ProjectTask[];            // from project_tasks table
  stats: {
    totalTasks: number;
    completedTasks: number;
    progressPct: number;
    deepTotalTasks: number;         // including sub-project tasks
    deepCompletedTasks: number;
  };
}

function useProjectTree(projects: Project[], tasks: ProjectTask[]): {
  roots: ProjectTreeNode[];        // parent_project_id = null
  flatMap: Map<string, ProjectTreeNode>;
}
```

### 4.4 useDeadlineAlerts Hook

```typescript
interface DeadlineAlert {
  id: string;
  name: string;
  dueDate: string;
  type: 'project' | 'task';
  status: 'overdue' | 'imminent' | 'ok';  // overdue: past, imminent: <= 3 days
  daysRemaining: number;
}

function useDeadlineAlerts(projects: Project[], tasks: ProjectTask[]): {
  overdue: DeadlineAlert[];
  imminent: DeadlineAlert[];
  ok: DeadlineAlert[];
  counts: { overdue: number; imminent: number; ok: number };
}
```

## 5. View Mode Designs

### 5.1 Board View (NEW - Assignee Kanban + Tree)

Layout: horizontal columns, one per assignee (+ "Unassigned" column).

Each column contains:
- Assignee name + avatar + project count badge
- Project cards (root-level only), sorted by sort_order
- Each card shows: project name, progress bar, deadline badge, memo preview (2 lines)
- Click/expand card -> shows sub-project tree with tasks inline

```
┌─────────────────┬─────────────────┬─────────────────┐
│ 지현근 (3)       │ 김서연 (2)       │ 미지정 (1)       │
├─────────────────┼─────────────────┼─────────────────┤
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │
│ │📁 어포메이션  │ │ │📁 마케팅캠페인│ │ │📁 매뉴얼정리 │ │
│ │ ██░░ 40%    │ │ │ █░░░ 25%    │ │ │ ░░░░ 0%     │ │
│ │ 🔴 2일 지남  │ │ │ 🟡 내일마감  │ │ │              │ │
│ │ 메모: 두가지 │ │ │              │ │ │              │ │
│ │ 관점에서...  │ │ │              │ │ │              │ │
│ │             │ │ │              │ │ │              │ │
│ │ ▾ 펼치기     │ │ │              │ │ │              │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
│ ┌─────────────┐ │ ┌─────────────┐ │                 │
│ │📁 영업시스템  │ │ │📁 리포트     │ │                 │
│ │ ████ 100% ✅│ │ │ ░░░░ 0%     │ │                 │
│ └─────────────┘ │ └─────────────┘ │                 │
│ ┌─────────────┐ │                 │                 │
│ │📁 스카웃매니저│ │                 │                 │
│ │ ██░░ 50%    │ │                 │                 │
│ └─────────────┘ │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

Expanded card shows sub-project tree:
```
│ ┌─────────────────────────┐ │
│ │📁 어포메이션 CMS         │ │
│ │ ██░░ 40% · 🔴 2일 지남   │ │
│ │                          │ │
│ │  📂 백엔드 개발           │ │
│ │    ✅ DB 스키마 설계      │ │
│ │    🔄 API 엔드포인트 구현  │ │
│ │    🔄 RLS 정책 적용       │ │
│ │                          │ │
│ │  📂 프론트엔드 개발        │ │
│ │    🔄 로드맵 페이지 개선   │ │
│ │    ⏳ 대시보드 리디자인     │ │
│ │                          │ │
│ │  📂 배포/인프라            │ │
│ │    ✅ Vercel 설정         │ │
│ └─────────────────────────┘ │
```

### 5.2 Existing Views - Changes

**Grouped View (table)**: Add project detail panel when expanded.

When a project row is expanded:
1. Show **project summary panel** (memo, result_value, URL in readable format)
2. Below that, show sub-projects (if 3-level) or tasks (if 2-level)

```
┌──────────────────────────────────────────────────────┐
│ ▾ 어포메이션 CMS  | 진행중 | 지현근 | 40% | ...      │
├──────────────────────────────────────────────────────┤
│ 📝 메모:                                             │
│ [두가지 관점]                                         │
│ 1. 행위별-담당자별 관리 프로세스 정립 후 교육             │
│ 2. 캠페인별-행위별 관리 프로세스 정립 후 교육             │
│                                                      │
│ 📊 결과: 실제 데이터 전부 마이그레이션 완료              │
│ 🔗 campaign-chi-dun.vercel.app                       │
├──────────────────────────────────────────────────────┤
│   📂 백엔드 개발                                      │
│     1. ✅ DB 스키마 설계                               │
│     2. 🔄 API 엔드포인트 구현                          │
│   📂 프론트엔드 개발                                   │
│     1. 🔄 로드맵 페이지 개선                           │
│   + 새 하위업무 추가...                                │
└──────────────────────────────────────────────────────┘
```

**Card View**: Expand memo display from `line-clamp-2` to `line-clamp-4`, font from 11px to 12px.

**Table View**: Remove "시간" column (low value), widen memo/result columns from 14% to 20%.

## 6. Error Fixes

All fixes happen naturally during modular decomposition:

| Error | Root Cause | Fix |
|-------|-----------|-----|
| Vercel "Application error" | `window.alert()` in SSR context | Replace with toast notification (Radix Toast or inline feedback) |
| Hydration mismatch | `toLocaleString('ko-KR')` differs server/client | Use `date-fns` `format()` for consistent output |
| Silent mutation failures | `onError` only does `console.error` | Add toast error notifications + retry UI |
| SPA navigation break | `<a href>` instead of `next/link` | Use `next/link` for `/roadmap/[id]` links |
| Undefined projectId query | `useParams` returns undefined on first render | Add `enabled: !!projectId` to useQuery |
| Delete without context | Delete dialog shows generic "삭제하시겠습니까?" | Include project/task name in confirmation |

## 7. Deadline Banner Design

Component: `roadmap-deadline-banner.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ 마감 지남 3건  │  🟡 3일 이내 2건  │  ✅ 여유 8건          │
│                                                             │
│ 🔴 어포메이션 CMS · 2일 지남    🟡 영업시스템 · 내일 마감     │
│ 🔴 스카웃매니저 · 5일 지남       🟡 매뉴얼 정리 · 3일 남음    │
│ 🔴 CS매뉴얼 · 1일 지남                                      │
└─────────────────────────────────────────────────────────────┘
```

- Collapsible (default: expanded if overdue > 0, collapsed if all OK)
- Each item is clickable -> scrolls to or highlights that project
- Badge colors applied to project rows/cards throughout all views

## 8. State Management

No new state management library needed. Continue using:
- **TanStack Query**: Server state (projects, tasks, users)
- **React useState**: View state (filters, expanded, selected)
- **URL params**: Persist view mode and filters in URL search params (NEW)

New: persist `viewMode`, `groupBys`, `showCompleted` in URL search params so refresh preserves user's view preferences.

## 9. Migration Safety

**Principle**: All migrations are additive. No column drops, no data modifications, no constraint changes on existing data.

Migration execution order:
1. `20260406_add_parent_project_id.sql` - ADD COLUMN (nullable, no default change)
2. `20260406_add_assignee_ids.sql` - ADD assignee_ids column + sync trigger + data migration
3. `20260406_fix_rls_policies.sql` - DROP all conflicting write policies, CREATE unified ones

**Rollback plan**: 
- 022: `ALTER TABLE projects DROP COLUMN parent_project_id;`
- 023: Re-run original 007 + 016 policies

**Testing**: 
- Verify existing projects load correctly (parent_project_id = NULL)
- Verify existing CRUD operations still work
- Verify RLS: authenticated users can INSERT/UPDATE, only admin can DELETE

## 10. Implementation Priority

| Priority | Task | Files | Effort |
|----------|------|-------|--------|
| P0 | Fix Vercel deployment error | page.tsx, [projectId]/page.tsx | Small |
| P0 | RLS policy cleanup | New migration SQL | Small |
| P1 | Decompose monolith into components | 10+ new files | Medium |
| P1 | Add parent_project_id + useProjectTree | Migration + hook | Medium |
| P1 | Project detail panel (content visibility) | project-detail-panel.tsx | Small |
| P2 | Deadline banner | roadmap-deadline-banner.tsx, use-deadline-alerts.ts | Small |
| P2 | Board view (assignee kanban+tree) | board-view.tsx, project-tree-item.tsx | Medium |
| P3 | URL param persistence | page.tsx (useSearchParams) | Small |
| P3 | Table column optimization | table-view.tsx | Small |

## 11. Out of Scope

These were identified during analysis but deferred:
- Gantt chart / timeline view (can be added as a future view mode)
- Project dependencies / blockedBy relationships
- Touch/mobile drag-and-drop (current HTML5 drag is desktop-only)
- Virtualized rendering for 100+ projects (optimize if performance issue confirmed)
- Real-time presence indicators
