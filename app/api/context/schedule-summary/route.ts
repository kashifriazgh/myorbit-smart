import { NextRequest, NextResponse } from 'next/server';

interface SampledSchedule {
  title: string;
  isFlexible?: boolean;
  startTime: string;
  endTime: string;
  duration?: number;
  priority?: string;
  objective?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      schedules,
      totalCount,
      averageDailySchedules,
      flexibleCount,
    } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is missing.' }, { status: 500 });
    }

    const systemPrompt = `You are an AI generating a compact schedules and daily density summary for a user's dashboard.

You will receive structured schedules data and must write EXACTLY 2 sentences in third-person.

Sentence 1 (Density & Average): Summarize the user's daily schedule density, mentioning their average schedules of a day (daily schedules average over the last 20 days), total count, and flexible daily schedules count.
Sentence 2 (Objectives & Highlights): Highlight specific recurring themes/objectives (e.g., fitness, study, learning, work) and temporal focus (such as morning focus or afternoon tasks) based on their schedule list.

Strict rules:
- Exactly 2 sentences. Hard limit.
- Third-person only. Never use "you", "your", "I", or "my".
- Use plain text only, no markdown formatting, no bullet points.
- Address user as "User".
`;

    const userPrompt = `Schedules context data:
Total schedules registered: ${totalCount}
Average daily schedules (20-day window): ${averageDailySchedules} schedules/day
Flexible/Daily schedules active: ${flexibleCount}

Sample of upcoming/recent schedules:
${schedules && schedules.length > 0
  ? (schedules as SampledSchedule[]).map((s: SampledSchedule) => 
      `- "${s.title}" (${s.isFlexible ? 'Flexible' : `${s.startTime}-${s.endTime}`}, objective: ${s.objective || 'none'}, priority: ${s.priority || 'medium'}, duration: ${s.duration || 0}m)`
    ).join('\n')
  : 'None'
}

Write the 2-sentence daily schedules snapshot now.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
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
      averageDailySchedules,
      flexibleCount,
    });
  } catch (error) {
    console.error('Error in schedule-summary route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
