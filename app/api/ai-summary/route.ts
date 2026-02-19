import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { buildContext } from '@/lib/ai/build-context';
import { SYSTEM_PROMPT, DIMENSION_PROMPTS } from '@/lib/ai/system-prompt';
import type { SummaryDimension } from '@/lib/ai/types';

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

    // Build context from database
    const context = await buildContext(dimension);

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
