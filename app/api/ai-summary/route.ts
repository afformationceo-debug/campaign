import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { buildContext } from '@/lib/ai/build-context';
import { SYSTEM_PROMPT, DIMENSION_PROMPTS } from '@/lib/ai/system-prompt';
import type { SummaryDimension } from '@/lib/ai/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dimension: SummaryDimension = body.dimension ?? 'all';

    // Build context from database
    const context = await buildContext(dimension);

    if (!context) {
      return new Response(
        JSON.stringify({ error: '데이터를 불러올 수 없습니다.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build user message
    const dimensionHint =
      dimension !== 'all' && DIMENSION_PROMPTS[dimension]
        ? `\n\n${DIMENSION_PROMPTS[dimension]}`
        : '';

    const userMessage = `다음은 현재 시스템 데이터입니다. 분석하여 요약해주세요.${dimensionHint}\n\n${context}`;

    // OpenAI streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: true,
    });

    // Convert to ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
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
