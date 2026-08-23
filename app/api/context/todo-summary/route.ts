import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { completedTodos, activeTodos, totalCompletedCount, totalActiveCount } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is missing.' }, { status: 500 });
    }

    // Build completed todos line
    const completedLine =
      completedTodos?.length > 0
        ? completedTodos
            .map(
              (t: { title: string; priority: string; completedAt?: string }) =>
                `"${t.title}" (${t.priority}${t.completedAt ? ', done ' + t.completedAt : ''})`
            )
            .join(', ')
        : 'none';

    // Build active todos line with progress and days passed
    const activeLine =
      activeTodos?.length > 0
        ? activeTodos
            .map(
              (t: {
                title: string;
                priority: string;
                progressPercent: number;
                progressLabel?: string;
                pace?: string | null;
                rescheduleStatus?: string;
                staleness?: string | null;
                daysPassed: number;
                dueDate?: string;
              }) => {
                const metricsParts = [
                  `${t.progressPercent}% done (${t.progressLabel || 'Not Started'})`,
                  `${t.daysPassed} day${t.daysPassed !== 1 ? 's' : ''} in progress`,
                  `${t.priority} priority`,
                  t.dueDate ? `due ${t.dueDate}` : null,
                  t.pace ? `pace: ${t.pace}` : null,
                  t.rescheduleStatus ? `reschedule status: ${t.rescheduleStatus}` : null,
                  t.staleness ? `staleness: ${t.staleness}` : null
                ];
                return `"${t.title}" (${metricsParts.filter(Boolean).join(', ')})`;
              }
            )
            .join(', ')
        : 'none';

    const systemPrompt = `You are an AI building a compact task-status snapshot for a productivity app.

You will receive structured task data and must write EXACTLY 2 sentences in third-person.

Sentence 1 (Completed): Start with "User completed [totalCompletedCount] tasks in the last 30 days." then list the recent completions compactly.
Sentence 2 (Active): Start with "User currently has [totalActiveCount] active tasks;" then list the active ones with their progress and days in progress.

Strict rules:
- Exactly 2 sentences. Hard limit.
- Third-person only. Never "you" or "your".
- Do NOT exceed 2 sentences regardless of how much data is given.
- Include ALL the task titles provided — keep each one short but present.
- No markdown, no bullets, no line breaks. Plain prose only.`;

    const userPrompt = `Total completed (last 30 days): ${totalCompletedCount ?? 0}
Total active: ${totalActiveCount ?? 0}

5 most recent completed tasks:
${completedLine}

5 most recent active tasks (with progress & days in progress):
${activeLine}

Write the 2-sentence task snapshot now.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'groq/compound-mini',
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

    return NextResponse.json({ summary, totalCompletedCount, totalActiveCount });
  } catch (error) {
    console.error('Error in todo-summary route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
