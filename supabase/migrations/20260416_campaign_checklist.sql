-- 캠페인별 필수 체크리스트 대시보드 (해외환자유치, 중화권 제외)
-- Plan Ref: campaign-checklist-dashboard §3

-- 1. 섹션 (인플루언서 / 일반고객 / 광고차원)
create table checklist_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_theme text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 2. 컬럼 (섹션별 동적)
create table checklist_columns (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references checklist_sections(id) on delete cascade,
  name text not null,
  input_type text not null default 'text' check (input_type in ('text','number','multi_url')),
  helper_text text,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 캠페인 숨김 플래그 (대시보드 삭제 = hide)
create table checklist_campaign_overrides (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  is_hidden boolean not null default false,
  updated_at timestamptz default now()
);

-- 4. 일별 기록
create table checklist_campaign_records (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  column_id uuid not null references checklist_columns(id) on delete cascade,
  record_date date not null,
  value_text text,
  value_urls jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  unique(campaign_id, column_id, record_date)
);

create index idx_ccr_date on checklist_campaign_records(record_date);
create index idx_ccr_campaign_date on checklist_campaign_records(campaign_id, record_date);
create index idx_cc_section on checklist_columns(section_id);

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

-- 시드: 섹션 3개
insert into checklist_sections (name, color_theme, sort_order) values
  ('인플루언서', 'purple', 0),
  ('일반고객', 'emerald', 1),
  ('광고차원', 'amber', 2);

-- 시드: 컬럼
with s_inf as (select id from checklist_sections where name = '인플루언서')
insert into checklist_columns (section_id, name, input_type, helper_text, sort_order)
select s_inf.id, col.name, col.input_type, col.helper_text, col.ord
from s_inf, (values
  ('컨펌대기 인플', 'number', null, 0),
  ('예약확정 인플', 'number', null, 1),
  ('금일 업로드된 후기', 'multi_url', '여러 URL 등록 가능', 2),
  ('방문완료 인플', 'number', null, 3)
) as col(name, input_type, helper_text, ord);

with s_cust as (select id from checklist_sections where name = '일반고객')
insert into checklist_columns (section_id, name, input_type, helper_text, sort_order)
select s_cust.id, col.name, col.input_type, col.helper_text, col.ord
from s_cust, (values
  ('신규예약 고객', 'number', 'f/u 제외', 0),
  ('방문완료 고객', 'number', null, 1),
  ('금일 업로드된 리뷰', 'multi_url', '여러 URL 등록 가능', 2)
) as col(name, input_type, helper_text, ord);

with s_ad as (select id from checklist_sections where name = '광고차원')
insert into checklist_columns (section_id, name, input_type, helper_text, sort_order)
select s_ad.id, col.name, col.input_type, col.helper_text, col.ord
from s_ad, (values
  ('소진 광고비', 'text', null, 0),
  ('현재 집행중인 광고 소재', 'multi_url', '여러 URL 등록 가능', 1)
) as col(name, input_type, helper_text, ord);
