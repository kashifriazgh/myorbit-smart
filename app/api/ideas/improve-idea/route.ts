// /app/api/idea-improve/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { value, instructions, suggestion } = await req.json();

    const API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    let prompt = '';

    if (instructions?.length) {
      const enhancementsList = instructions.join(', ');
      prompt = `
        Improve the following text based on these goals: ${enhancementsList}.
        Add emojis if relevant.

        Text: "${value}"

        Return only the improved version. No explanation needed.
      `;
    } else if (suggestion) {
      prompt = `
        Analyze the following idea:

        Text: "${value}"

        Provide:
        - Productivity potential
        - Accessibility
        - Roadmap to implement
        - Additional improvements
      `;
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    const output =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return NextResponse.json({ result: output });
  } catch (error) {
    console.error('Gemini AI Error:', error);
    return NextResponse.json(
      { error: 'AI processing failed' },
      { status: 500 }
    );
  }
}
