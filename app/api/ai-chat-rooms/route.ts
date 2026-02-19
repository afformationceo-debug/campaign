import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: 유저의 채팅방 목록 조회
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return Response.json({ rooms: [] });

    const supabase = getSupabase();
    const { data: rooms, error } = await supabase
      .from('ai_chat_rooms')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ rooms: rooms ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

// POST: 새 채팅방 생성
export async function POST(req: NextRequest) {
  try {
    const { userId, title } = await req.json();
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('ai_chat_rooms')
      .insert({ user_id: userId, title: title || '새 대화' })
      .select('id, title, created_at, updated_at')
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ room: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

// PATCH: 채팅방 제목 수정
export async function PATCH(req: NextRequest) {
  try {
    const { roomId, title } = await req.json();
    if (!roomId || !title) return Response.json({ error: 'roomId and title required' }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase
      .from('ai_chat_rooms')
      .update({ title })
      .eq('id', roomId);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

// DELETE: 채팅방 삭제 (메시지도 cascade 삭제)
export async function DELETE(req: NextRequest) {
  try {
    const roomId = req.nextUrl.searchParams.get('roomId');
    if (!roomId) return Response.json({ error: 'roomId required' }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase
      .from('ai_chat_rooms')
      .delete()
      .eq('id', roomId);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
