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

    const today = new Date().toISOString().split('T')[0];
    const defaultMilestones = [
      { title: 'Initial Planning & Setup', description: 'Define core objectives and roadmap', suggestedEndDate: today },
      { title: 'Execution Phase 1', description: 'Begin initial steps and track progress', suggestedEndDate: today },
      { title: 'Mid-way Checkpoint', description: 'Evaluate milestones and adjust targets', suggestedEndDate: today },
      { title: 'Final Review & Goal Completion', description: 'Wrap up final criteria', suggestedEndDate: today },
    ];

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      console.warn('⚠️ Missing or unconfigured GROQ_API_KEY in environment');
      return NextResponse.json({ milestones: defaultMilestones });
    }

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

    const strictSystemPrompt = `${systemPrompt}\n\nCRITICAL FORMATTING INSTRUCTION: You MUST return ONLY a valid, raw JSON array matching the exact schema above. Do NOT include markdown code blocks, backticks (\`\`\`), or any text outside the JSON array brackets.`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [
              { role: 'system', content: strictSystemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 400,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let content: string = data?.choices?.[0]?.message?.content ?? '';
          content = content.replace(/```(?:json)?/gi, '').trim();

          const firstBracket = content.indexOf('[');
          const lastBracket = content.lastIndexOf(']');

          if (firstBracket !== -1 && lastBracket !== -1) {
            const jsonStr = content.slice(firstBracket, lastBracket + 1);
            const milestones = JSON.parse(jsonStr);
            if (Array.isArray(milestones) && milestones.length > 0) {
              return NextResponse.json({ milestones });
            }
          }
        }
      } catch (err) {
        console.warn(`Groq API suggest-milestone attempt ${attempt}/3 exception:`, err);
      }

      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 100));
      }
    }

    return NextResponse.json({ milestones: defaultMilestones });
  } catch (error) {
    console.error('🔥 Server Error:', error);
    return NextResponse.json({ milestones: [
      { title: 'Initial Planning & Setup', description: 'Define core objectives and roadmap', suggestedEndDate: new Date().toISOString().split('T')[0] },
      { title: 'Execution Phase 1', description: 'Begin initial steps and track progress', suggestedEndDate: new Date().toISOString().split('T')[0] },
      { title: 'Mid-way Checkpoint', description: 'Evaluate milestones and adjust targets', suggestedEndDate: new Date().toISOString().split('T')[0] },
      { title: 'Final Review & Goal Completion', description: 'Wrap up final criteria', suggestedEndDate: new Date().toISOString().split('T')[0] },
    ] });
  }
}
