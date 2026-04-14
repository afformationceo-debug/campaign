-- 체크리스트 섹션명 변경: '광고차원' → '광고현황'
-- checklist_sections.name UNIQUE 제약 때문에 단순 UPDATE로 처리

update checklist_sections
   set name = '광고현황'
 where name = '광고차원';
