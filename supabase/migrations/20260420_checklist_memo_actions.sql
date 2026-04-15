-- 체크리스트 셀 메모 + 캠페인별 액션아이템
-- Plan Ref: checklist-memo-actions §3

-- 1) records에 메모 컬럼 추가
alter table checklist_campaign_records
  add column if not exists memo text;

-- 2) 캠페인별 액션아이템 (날짜 기반, 로드맵과 동기화)
create table if not exists checklist_campaign_actions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  action_date date not null,
  text text not null,
  sort_order int not null default 0,
  project_task_id uuid references project_tasks(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cca_campaign_date on checklist_campaign_actions(campaign_id, action_date);
create index if not exists idx_cca_date on checklist_campaign_actions(action_date);

alter table checklist_campaign_actions enable row level security;

create policy "checklist_campaign_actions_all" on checklist_campaign_actions
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table checklist_campaign_actions;
