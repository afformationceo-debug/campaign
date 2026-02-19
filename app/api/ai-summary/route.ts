import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { buildContext, DateRange } from '@/lib/ai/build-context';
import { SYSTEM_PROMPT, DIMENSION_PROMPTS } from '@/lib/ai/system-prompt';
import type { SummaryDimension } from '@/lib/ai/types';

// 한국 시간(KST) 기준 오늘 날짜 반환
function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function detectDateRange(text: string): DateRange | undefined {
  const todayStr = kstToday();
  const today = new Date(todayStr + 'T00:00:00+09:00');
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

  // "일주일" / "7일" / "최근 7일" / "지난 일주일"
  if (/일주일|7일|최근\s*7|지난\s*7/i.test(text)) {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: fmt(from), to: todayStr };
  }
  // "이번 주" / "금주"
  if (/이번\s*주|금주/.test(text)) {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1));
    return { from: fmt(mon), to: todayStr };
  }
  // "지난 3일" / "최근 3일"
  const shortDays = text.match(/(?:지난|최근)\s*(\d+)\s*일/);
  if (shortDays) {
    const n = parseInt(shortDays[1], 10);
    const from = new Date(today);
    from.setDate(from.getDate() - (n - 1));
    return { from: fmt(from), to: todayStr };
  }
  // "이번 달" / "이달" / "한달"
  if (/이번\s*달|이달|한\s*달|1개월/.test(text)) {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(from), to: todayStr };
  }
  // "어제"
  if (/어제/.test(text)) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: fmt(y), to: fmt(y) };
  }
  return undefined;
}

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = await req.json();
    const dimension: SummaryDimension = body.dimension ?? 'all';
    const userId: string | undefined = body.userId;
    const userMessage: string | undefined = body.message;
    const previousMessages: { role: 'user' | 'assistant'; content: string }[] =
      body.history ?? [];

    // Detect date range from user message
    const dateRange = userMessage ? detectDateRange(userMessage) : undefined;

    // Build context from database
    const context = await buildContext(dimension, dateRange);

    if (!context) {
      return new Response(
        JSON.stringify({ error: '데이터를 불러올 수 없습니다.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build dimension hint
    const dimensionHint =
      dimension !== 'all' && DIMENSION_PROMPTS[dimension]
        ? `\n\n${DIMENSION_PROMPTS[dimension]}`
        : '';

    const contextMessage = `다음은 현재 시스템 데이터입니다. 분석하여 요약해주세요.${dimensionHint}\n\n${context}`;

    // Build messages array for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contextMessage },
    ];

    // Add previous conversation history (last 10 exchanges for context)
    const recentHistory = previousMessages.slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current user message if it's a custom message (not a quick action)
    if (userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    // Save user message to DB
    if (userId && userMessage) {
      const supabase = getSupabase();
      await supabase.from('ai_chat_messages').insert({
        user_id: userId,
        role: 'user',
        content: userMessage,
        dimension,
      });
    }

    // OpenAI streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 2000,
      stream: true,
    });

    // Collect full response for DB save
    let fullResponse = '';

    // Convert to ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();

          // Save assistant response to DB after streaming completes
          if (userId) {
            const supabase = getSupabase();
            await supabase.from('ai_chat_messages').insert({
              user_id: userId,
              role: 'assistant',
              content: fullResponse,
              dimension,
            });
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET: Load chat history
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return Response.json({ messages: [] });
    }

    const supabase = getSupabase();
    const { data: messages, error } = await supabase
      .from('ai_chat_messages')
      .select('id, role, content, dimension, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ messages: messages ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

// DELETE: Clear chat history
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return Response.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('ai_chat_messages')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
