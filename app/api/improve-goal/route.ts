import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { title, dueDate } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // ✅ SHORT + TOKEN-EFFICIENT PROMPT
    const systemPrompt = `
You are a productivity expert.
Return ONLY valid JSON. No extra text.
`;

    const userPrompt = `
Goal: "${title}"
Due: "${dueDate || 'none'}"

Check SMART criteria and suggest breakdown ONLY if needed.

Format:
{
  "isSMART": {
    "specific": boolean,
    "measurable": boolean,
    "achievable": boolean,
    "relevant": boolean,
    "timeBound": boolean,
    "summary": "short"
  },
  "needsBreakdown": boolean,
  "milestones": ["short steps"]
}
`;

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'groq/compound-mini', // ✅ cheapest + best for your use
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2, // more consistent
          max_tokens: 250, // ✅ limit cost
        }),
      },
    );

    const data = await response.json();

    let content = data?.choices?.[0]?.message?.content;

    // ✅ CLEAN RESPONSE (remove unwanted text if AI messes up)
    if (content) {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      content = content.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('AI RAW RESPONSE:', content);
      console.log(err);

      return NextResponse.json(
        {
          error: 'AI returned invalid JSON',
          fallback: true,
        },
        { status: 200 }, // don't break UI
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
