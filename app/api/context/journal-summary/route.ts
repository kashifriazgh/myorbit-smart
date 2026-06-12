import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { journals, userName } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is missing.' },
        { status: 500 }
      );
    }

    if (!journals || !Array.isArray(journals) || journals.length === 0) {
      return NextResponse.json(
        { error: 'No journals provided.' },
        { status: 400 }
      );
    }

    // Build a compact representation of journals for AI
    const journalSummaryInput = journals
      .map((j: { date?: string; title?: string; content?: string; mood?: { type?: string; level?: number }; productivityOfTheDay?: string; tags?: string[] }, index: number) => {
        const lines: string[] = [];
        lines.push(`[Entry ${index + 1}] Date: ${j.date || 'unknown'} | Title: ${j.title || 'Untitled'}`);
        if (j.mood?.type) lines.push(`  Mood: ${j.mood.type} (level ${j.mood.level ?? '?'}/10)`);
        if (j.content) lines.push(`  Content: ${j.content.slice(0, 300)}${j.content.length > 300 ? '...' : ''}`);
        if (j.productivityOfTheDay) lines.push(`  Productivity note: ${j.productivityOfTheDay.slice(0, 150)}`);
        if (j.tags?.length) lines.push(`  Tags: ${j.tags.join(', ')}`);
        return lines.join('\n');
      })
      .join('\n\n');

    const systemPrompt = `You are an AI building a compact behavioral snapshot from a user's recent journal entries.

Your task: write EXACTLY 1 to 2 sentences (hard limit) summarizing the user's recent emotional state and dominant behavioral pattern.

Strict rules:
- Maximum 2 sentences. Never exceed this — even if there are many entries.
- Write in THIRD PERSON: e.g. "User has been experiencing..." or "The user showed signs of..."
- Never use "you", "your", or second person at all.
- No bullet points. Plain prose only.
- No JSON, no markdown, no extra commentary.
- Only reflect facts present in the entries. Do not invent details.`;

    const userPrompt = `${userName ? `User name: ${userName}.\n` : ''}Journal entries from last 15 days:\n\n${journalSummaryInput}\n\nWrite a 1–2 sentence third-person behavioral snapshot of this user. Hard limit: 2 sentences maximum.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Groq API error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: 'AI service error. Please try again.' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const summary = data?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!summary) {
      return NextResponse.json({ error: 'AI returned empty response.' }, { status: 500 });
    }

    return NextResponse.json({ summary, journalCount: journals.length });
  } catch (error) {
    console.error('Error in journal-summary route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
