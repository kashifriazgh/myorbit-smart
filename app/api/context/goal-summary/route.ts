import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      completedGoals,
      activeGoals,
      totalCompletedCount,
      totalActiveCount,
      checkInsLast30Days,
      overallConsistency,
    } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is missing.' }, { status: 500 });
    }

    // Format completed goals list
    const completedLine =
      completedGoals?.length > 0
        ? completedGoals
            .map((g: { title: string; completedAt?: string }) => `"${g.title}"${g.completedAt ? ' (done ' + g.completedAt + ')' : ''}`)
            .join(', ')
        : 'none';

    // Format active goals list with progress, priority, and frequency
    const activeLine =
      activeGoals?.length > 0
        ? activeGoals
            .map(
              (g: {
                title: string;
                progress: number;
                priority: string;
                frequency?: string;
                consistency?: number;
              }) =>
                `"${g.title}" (${g.progress}% progress, ${g.priority} priority${
                  g.frequency ? ', ' + g.frequency + ' check-ins' : ''
                }${g.consistency != null ? ', ' + g.consistency + '% consistency' : ''})`
            )
            .join(', ')
        : 'none';

    const systemPrompt = `You are an AI building a compact goal-status and habit-tracking snapshot for a productivity app.

You will receive structured goals data and must write EXACTLY 2 sentences in third-person.

Sentence 1 (Overview & Completed): Start with "User completed [totalCompletedCount] goals" then compactly mention recent completions, followed by "and currently has [totalActiveCount] active goals."
Sentence 2 (Progress & Frequency): Describe the active goals, their progress, and how frequently progress is updated (e.g. "User updates progress [daily/weekly] with an average consistency of [overallConsistency]% ([checkInsLast30Days] check-ins in the last 30 days).")

Strict rules:
- Exactly 2 sentences. Hard limit.
- Third-person only. Never "you" or "your".
- Do NOT exceed 2 sentences regardless of how much data is given.
- Keep goal details compact.
- No markdown, no bullets, no line breaks. Plain prose only.`;

    const userPrompt = `Total completed goals: ${totalCompletedCount ?? 0}
Total active goals: ${totalActiveCount ?? 0}
Check-ins completed in the last 30 days: ${checkInsLast30Days ?? 0}
Overall check-in consistency: ${overallConsistency != null ? overallConsistency + '%' : 'N/A'}

Completed goals:
${completedLine}

Active goals:
${activeLine}

Write the 2-sentence goal snapshot now.`;

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
      totalCompletedCount,
      totalActiveCount,
      checkInsLast30Days,
      overallConsistency,
    });
  } catch (error) {
    console.error('Error in goal-summary route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
