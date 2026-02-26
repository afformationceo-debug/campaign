-- 온보딩 매뉴얼 섹션 테이블
CREATE TABLE IF NOT EXISTS onboarding_manual_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_number INT NOT NULL,
  section_title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE onboarding_manual_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_manual_sections_select" ON onboarding_manual_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "onboarding_manual_sections_insert" ON onboarding_manual_sections
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "onboarding_manual_sections_update" ON onboarding_manual_sections
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "onboarding_manual_sections_delete" ON onboarding_manual_sections
  FOR DELETE TO authenticated USING (true);

-- updated_at trigger
CREATE TRIGGER set_updated_at_onboarding_manual
  BEFORE UPDATE ON onboarding_manual_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding_manual_sections;
