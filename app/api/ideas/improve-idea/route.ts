import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { value, instructions } = await req.json();

    const API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    if (!API_KEY) {
      console.error('❌ Missing GEMINI_API_KEY in environment');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    if (!value || !instructions) {
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
            parts: [{ text: `${instructions}\n\nText: "${value}"` }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Gemini error: ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const output =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return NextResponse.json({ result: output });
  } catch (error) {
    console.error('🔥 Server Error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
