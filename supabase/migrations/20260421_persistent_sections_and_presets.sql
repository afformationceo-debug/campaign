-- 1) 영속 섹션 플래그 (광고현황: 날짜 변경해도 최신 데이터 유지)
alter table checklist_sections add column if not exists is_persistent boolean default false;
update checklist_sections set is_persistent = true where name = '광고현황';

-- 2) 섹션별 액션 프리셋 (드롭다운 값 CRUD)
create table if not exists checklist_action_presets (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references checklist_sections(id) on delete cascade,
  label text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table checklist_action_presets enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='checklist_action_presets' and policyname='checklist_action_presets_all') then
    create policy "checklist_action_presets_all" on checklist_action_presets for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='checklist_action_presets') then
    alter publication supabase_realtime add table checklist_action_presets;
  end if;
end $$;

-- 광고현황 프리셋 시드
with s as (select id from checklist_sections where name = '광고현황')
insert into checklist_action_presets (section_id, label, sort_order)
select s.id, p.label, p.ord from s, (values
  ('광고소재 교체', 0),
  ('광고모델 구인 필요', 1)
) as p(label, ord)
on conflict do nothing;
