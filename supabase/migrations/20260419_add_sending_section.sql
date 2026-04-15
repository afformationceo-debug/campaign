-- '발송' 섹션 추가 (인플루언서/일반고객/광고현황 다음)
-- 컬럼: 인스타 DM / 트위터 DM / 틱톡 DM / 전플랫폼 이메일 (모두 number)

insert into checklist_sections (name, color_theme, sort_order) values
  ('발송', 'sky', 3)
on conflict (name) do update
  set color_theme = excluded.color_theme,
      sort_order = excluded.sort_order;

with s as (select id from checklist_sections where name = '발송')
insert into checklist_columns (section_id, name, input_type, helper_text, sort_order)
select s.id, col.name, col.input_type, col.helper_text, col.ord
from s, (values
  ('인스타 DM 발송', 'number', null, 0),
  ('트위터 DM 발송', 'number', null, 1),
  ('틱톡 DM 발송', 'number', null, 2),
  ('전플랫폼 이메일 발송', 'number', null, 3)
) as col(name, input_type, helper_text, ord);
