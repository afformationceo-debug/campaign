import { generateInsights } from '@/lib/ai/insights';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const insights = await generateInsights();
    return Response.json({ insights });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message, insights: [] }, { status: 500 });
  }
}
