import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      availableAmount,
      freezeAmount,
      totalAmount,
      upcomingExpensesCount,
      upcomingExpensesTotal,
      outstandingBorrowTotal,
      outstandingLendTotal,
      expensesDetail,
      loansDetail,
      breakdown,
    } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is missing.' }, { status: 500 });
    }

    const systemPrompt = `You are an AI building a compact financial status and liquidity snapshot for a personal dashboard.

You will receive structured financial data and must write EXACTLY 2 sentences in third-person.

Sentence 1 (Possessions & Funds): Describe the user's available funds, mentioning the net available amount (PKR) and any major balances (e.g., in hand, bank, or mobile wallets), noting if any funds are freezed.
Sentence 2 (Expenses & Loans): Summarize upcoming expected expenses (count and total amount) and outstanding loans—specifying both what the user owes to others (borrowed) and what others owe to the user (lent).

Strict rules:
- Exactly 2 sentences. Hard limit.
- Third-person only. Never use "you", "your", "I", or "my".
- Do NOT exceed 2 sentences.
- Use plain text only, no markdown, no bullet points.
- Address user as "User".
`;

    const userPrompt = `Financial summary data:
Total balance: PKR ${totalAmount}
Available balance: PKR ${availableAmount}
Freezed balance: PKR ${freezeAmount}

Breakdown: ${breakdown || 'none'}

Upcoming expected expenses:
Count: ${upcomingExpensesCount}
Total Amount: PKR ${upcomingExpensesTotal}
Details: ${expensesDetail || 'none'}

Outstanding loans:
Total Borrowed (User owes to others): PKR ${outstandingBorrowTotal}
Total Lent (Others owe to user): PKR ${outstandingLendTotal}
Details: ${loansDetail || 'none'}

Write the 2-sentence financial snapshot now.`;

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
      availableAmount,
      freezeAmount,
      totalAmount,
      upcomingExpensesCount,
      upcomingExpensesTotal,
      outstandingBorrowTotal,
      outstandingLendTotal,
    });
  } catch (error) {
    console.error('Error in finance-summary route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
