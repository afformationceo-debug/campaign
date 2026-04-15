-- '예약확정 인플' 컬럼을 number → multi_url로 변경
-- URL을 복수 등록하면 그 개수가 자동으로 숫자로 표시되도록 UX 통합

update checklist_columns
   set input_type = 'multi_url',
       helper_text = coalesce(helper_text, 'URL 등록 개수가 숫자'),
       updated_at = now()
 where name = '예약확정 인플';
