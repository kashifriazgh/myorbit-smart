import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const {
      title,
      description,
      type,

      dueDate,
      overallTargetValue,
      overallTargetUnit,

      existingSteps,
    } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Goal title is required' }, { status: 400 });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      console.error('❌ Missing GROQ_API_KEY in environment');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const today = new Date().toISOString().split('T')[0];
    const existingStepsSummary =
      existingSteps && existingSteps.length > 0
        ? `\nExisting milestones already created:\n${existingSteps.map((s: { title: string; endDate?: string }, i: number) => `  ${i + 1}. "${s.title}" (due: ${s.endDate ?? 'unknown'})`).join('\n')}`
        : '';

    const systemPrompt = `You are a smart goal coach. Suggest practical milestones for the user's specific goal.
Rules:
- Understand WHAT the goal actually is (reading ONE book ≠ reading N books; "run a 5K" means training steps not "run 5 races").
- Milestones must be real sub-tasks or checkpoints toward completing THAT specific goal.
- Dates must be between today (${today}) and the goal due date.
- Return ONLY a valid JSON array. No markdown, no explanation.`;

    const userPrompt = `Goal: "${title}"${description ? ` — ${description}` : ''} | Type: ${type ?? 'general'} | Due: ${dueDate ?? 'none'}${overallTargetValue ? ` | Target: ${overallTargetValue} ${overallTargetUnit ?? ''}` : ''}
${existingStepsSummary}
Suggest 4-5 sequential, specific milestones that directly work toward THIS goal.
[{"title":"...","description":"one sentence","suggestedEndDate":"YYYY-MM-DD"}]`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'groq/compound-mini', messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Groq API error:', response.status, errorText);
      return NextResponse.json({ error: `Groq error: ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    let content: string = data?.choices?.[0]?.message?.content ?? '';

    // Strip any markdown code block wrappers
    content = content.replace(/```(?:json)?/gi, '').trim();

    // Extract the JSON array
    const firstBracket = content.indexOf('[');
    const lastBracket = content.lastIndexOf(']');

    if (firstBracket === -1 || lastBracket === -1) {
      console.error('AI RAW RESPONSE (no array found):', content);
      return NextResponse.json({ error: 'AI returned invalid response', fallback: true }, { status: 200 });
    }

    const jsonStr = content.slice(firstBracket, lastBracket + 1);

    let milestones: { title: string; description: string; suggestedEndDate: string }[];
    try {
      milestones = JSON.parse(jsonStr);
    } catch (err) {
      console.error('AI JSON parse error:', err, 'Raw:', jsonStr);
      return NextResponse.json({ error: 'AI returned invalid JSON', fallback: true }, { status: 200 });
    }

    return NextResponse.json({ milestones });
  } catch (error) {
    console.error('🔥 Server Error:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
