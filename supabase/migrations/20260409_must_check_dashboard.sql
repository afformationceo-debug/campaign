-- 반드시체크리스트 대시보드 테이블
-- 섹션: 영업, 인플루언서, 광고, CS 등
-- 아이템: 각 섹션별 체크리스트 항목
-- 레코드: 일별 체크 기록 + 데이터 입력

-- 1. 섹션 테이블
create table must_check_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 체크리스트 아이템 테이블
create table must_check_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references must_check_sections(id) on delete cascade,
  label text not null,
  has_data_field boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 일별 체크 기록 테이블
create table must_check_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references must_check_items(id) on delete cascade,
  check_date date not null,
  checked boolean not null default false,
  data_value text,
  data_status text not null default 'pending' check (data_status in ('pending', 'filled', 'not_applicable')),
  checked_by uuid references auth.users(id),
  checked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(item_id, check_date)
);

-- 인덱스
create index idx_must_check_items_section on must_check_items(section_id);
create index idx_must_check_records_date on must_check_records(check_date);
create index idx_must_check_records_item_date on must_check_records(item_id, check_date);

-- RLS 활성화
alter table must_check_sections enable row level security;
alter table must_check_items enable row level security;
alter table must_check_records enable row level security;

-- RLS 정책: 인증된 사용자 전체 접근
create policy "must_check_sections_all" on must_check_sections for all to authenticated using (true) with check (true);
create policy "must_check_items_all" on must_check_items for all to authenticated using (true) with check (true);
create policy "must_check_records_all" on must_check_records for all to authenticated using (true) with check (true);

-- Realtime 활성화
alter publication supabase_realtime add table must_check_sections;
alter publication supabase_realtime add table must_check_items;
alter publication supabase_realtime add table must_check_records;

-- 초기 데이터: 영업 섹션
insert into must_check_sections (name, sort_order) values
  ('영업', 0),
  ('인플루언서', 1),
  ('광고', 2),
  ('CS', 3);

-- 영업 아이템
with s as (select id from must_check_sections where name = '영업')
insert into must_check_items (section_id, label, has_data_field, sort_order)
select s.id, item.label, item.has_data, item.ord
from s, (values
  ('이메일 스크래핑 확인', true, 0),
  ('이메일 발송 확인', true, 1),
  ('이메일 회신 확인', true, 2),
  ('카카오톡 채널 발송 확인', true, 3),
  ('카카오톡 채널 회신 확인', true, 4),
  ('폼 등록', true, 5),
  ('캠페인별 액션아이템 전부 확인', true, 6),
  ('PB 제안 확인', true, 7),
  ('CTK 회신 확인', true, 8)
) as item(label, has_data, ord);

-- 인플루언서 아이템
with s as (select id from must_check_sections where name = '인플루언서')
insert into must_check_items (section_id, label, has_data_field, sort_order)
select s.id, item.label, item.has_data, item.ord
from s, (values
  ('인플루언서 스크래핑 체크', true, 0),
  ('인플루언서 DM 발송 체크', true, 1),
  ('인플루언서 이메일 발송 체크', true, 2),
  ('금일 컨펌 대기 인플루언서 체크', true, 3),
  ('금일 후기 업로드 체크 후 광고소재 확인', true, 4)
) as item(label, has_data, ord);

-- 광고 아이템
with s as (select id from must_check_sections where name = '광고')
insert into must_check_items (section_id, label, has_data_field, sort_order)
select s.id, item.label, item.has_data, item.ord
from s, (values
  ('캠페인별 광고 집행현황 체크', true, 0),
  ('캠페인별 광고 턴오프 체크', true, 1),
  ('캠페인별 광고 소재 체크', true, 2),
  ('캠페인별 광고예산 체크', true, 3)
) as item(label, has_data, ord);

-- CS 아이템
with s as (select id from must_check_sections where name = 'CS')
insert into must_check_items (section_id, label, has_data_field, sort_order)
select s.id, item.label, item.has_data, item.ord
from s, (values
  ('금일 일반고객 방문 체크', true, 0)
) as item(label, has_data, ord);
