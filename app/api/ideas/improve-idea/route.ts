// /app/api/idea-improve/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { value, instructions } = await req.json();

    const API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const prompt = instructions?.trim();

    if (!prompt || !value) {
      return NextResponse.json(
        { error: 'Missing value or instructions' },
        { status: 400 }
      );
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `
${prompt}

Text: "${value}"
              `.trim(),
              },
            ],
          },
        ],
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
