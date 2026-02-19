-- AI 채팅방 테이블
CREATE TABLE IF NOT EXISTS ai_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '새 대화',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스: 유저별 최신 채팅방 조회
CREATE INDEX IF NOT EXISTS idx_ai_chat_rooms_user_updated
  ON ai_chat_rooms (user_id, updated_at DESC);

-- ai_chat_messages에 room_id 컬럼 추가
DO $$ BEGIN
  ALTER TABLE ai_chat_messages
    ADD COLUMN room_id UUID REFERENCES ai_chat_rooms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- room_id 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_room
  ON ai_chat_messages (room_id, created_at ASC);

-- RLS 활성화
ALTER TABLE ai_chat_rooms ENABLE ROW LEVEL SECURITY;

-- 본인 채팅방만 조회/생성/수정/삭제 가능
DO $$ BEGIN
  CREATE POLICY "Users can read own chat rooms"
    ON ai_chat_rooms FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own chat rooms"
    ON ai_chat_rooms FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own chat rooms"
    ON ai_chat_rooms FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own chat rooms"
    ON ai_chat_rooms FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role 전체 접근
DO $$ BEGIN
  CREATE POLICY "Service role full access on rooms"
    ON ai_chat_rooms FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_ai_chat_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_chat_rooms SET updated_at = now() WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_chat_room_updated ON ai_chat_messages;
CREATE TRIGGER trg_ai_chat_room_updated
  AFTER INSERT ON ai_chat_messages
  FOR EACH ROW
  WHEN (NEW.room_id IS NOT NULL)
  EXECUTE FUNCTION update_ai_chat_room_updated_at();
