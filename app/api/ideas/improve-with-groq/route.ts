import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { value, instructions } = await req.json();

    if (!value || !instructions) {
      return NextResponse.json(
        { error: 'Missing value or instructions' },
        { status: 400 }
      );
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      console.error('❌ Missing GROQ_API_KEY in environment');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful writing assistant. Follow the user instructions exactly and return only the improved text with no extra commentary.',
            },
            {
              role: 'user',
              content: `${instructions}\n\nText: "${value}"`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Groq API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Groq error: ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const output = data?.choices?.[0]?.message?.content?.trim() || '';

    return NextResponse.json({ result: output });
  } catch (error) {
    console.error('🔥 Server Error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
