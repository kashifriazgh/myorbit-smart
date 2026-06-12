import { NextRequest, NextResponse } from 'next/server';

interface SampledStreak {
  title: string;
  category: string;
  habitType: string;
  currentStreak: number;
  lastChecked: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      streaks,
      totalCount,
      averageStreak,
      longestStreak,
    } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is missing.' }, { status: 500 });
    }

    const systemPrompt = `You are an AI building a compact habit streak and consistency summary for a user's dashboard.

You will receive structured habit streak data and must write EXACTLY 2 sentences in third-person.

Sentence 1 (Overview & Stats): Summarize the user's active/created habits, mentioning the total count, average streak length, and longest streak achieved.
Sentence 2 (Habits & Highlights): Highlight specific active habits or categories (e.g., health, work, reading) and recent consistency/activity.

Strict rules:
- Exactly 2 sentences. Hard limit.
- Third-person only. Never use "you", "your", "I", or "my".
- Use plain text only, no markdown, no bullet points.
- Address user as "User".
`;

    const userPrompt = `Streak summary data:
Total streaks created: ${totalCount}
Average streak length: ${averageStreak} days/events
Longest streak achieved: ${longestStreak} days/events

Individual Streaks:
${streaks && streaks.length > 0 
  ? (streaks as SampledStreak[]).map((s: SampledStreak) => `- "${s.title}" (${s.habitType}, category: ${s.category}): current streak is ${s.currentStreak} (Last checked: ${s.lastChecked})`).join('\n')
  : 'None'
}

Write the 2-sentence habit/streak snapshot now.`;

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
        temperature: 0.2,
        max_tokens: 180,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Groq API error (${response.status}):`, errorText);
      return NextResponse.json({ error: 'AI service error.' }, { status: 500 });
    }

    const data = await response.json();
    const summary = data?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!summary) {
      return NextResponse.json({ error: 'AI returned empty response.' }, { status: 500 });
    }

    return NextResponse.json({
      summary,
      totalCount,
      averageStreak,
      longestStreak,
    });
  } catch (error) {
    console.error('Error in streak-summary route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
