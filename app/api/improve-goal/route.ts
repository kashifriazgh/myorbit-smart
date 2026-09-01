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

    const defaultFallback = {
      isSMART: {
        specific: true,
        measurable: true,
        achievable: true,
        relevant: true,
        timeBound: true,
        summary: 'Goal is clear and action-oriented.',
      },
      needsBreakdown: false,
      milestones: [],
    };

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ result: defaultFallback });
    }

    const strictSystemPrompt = `${systemPrompt}\n\nCRITICAL FORMATTING INSTRUCTION: You MUST return ONLY a valid, raw JSON object matching the exact schema above. Do NOT include markdown code blocks, backticks (\`\`\`), or any text outside the JSON object.`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-20b',
              messages: [
                { role: 'system', content: strictSystemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.1,
              max_tokens: 250,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          let content = data?.choices?.[0]?.message?.content;

          if (content) {
            content = content.replace(/```(?:json)?/gi, '').trim();
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              content = content.slice(firstBrace, lastBrace + 1);
              const parsed = JSON.parse(content);
              if (parsed && typeof parsed === 'object') {
                return NextResponse.json({ result: parsed });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Groq API improve-goal attempt ${attempt}/3 exception:`, err);
      }

      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 100));
      }
    }

    return NextResponse.json({ result: defaultFallback });
  } catch (error) {
    console.error('Error in improve-goal:', error);
    return NextResponse.json({ result: {
      isSMART: {
        specific: true,
        measurable: true,
        achievable: true,
        relevant: true,
        timeBound: true,
        summary: 'Goal setup ready.',
      },
      needsBreakdown: false,
      milestones: [],
    } });
  }
}
