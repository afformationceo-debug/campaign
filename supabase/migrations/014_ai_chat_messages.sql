-- AI 채팅 메시지 저장 테이블
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  dimension TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스: 유저별 최신 메시지 조회
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_created
  ON ai_chat_messages (user_id, created_at DESC);

-- RLS 활성화
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- 본인 메시지만 조회/삽입 가능 (idempotent)
DO $$ BEGIN
  CREATE POLICY "Users can read own chat messages"
    ON ai_chat_messages FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own chat messages"
    ON ai_chat_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own chat messages"
    ON ai_chat_messages FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role은 모든 접근 가능 (API route에서 사용)
DO $$ BEGIN
  CREATE POLICY "Service role full access"
    ON ai_chat_messages FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
