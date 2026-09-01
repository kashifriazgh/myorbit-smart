import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      onboardingData,
      journalContext,
      todoContext,
      goalContext,
      financeContext,
      streakContext,
      scheduleContext,
    } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is missing.' }, { status: 500 });
    }

    const systemPrompt = `You are an AI generating a master consolidated behavioral profile for a user's productivity dashboard.

Using the user profile and the behavioral contexts of their tasks, goals, journals, finances, habit streaks, and schedules, write a structured consolidated context.
You must adhere strictly to the following 5-line template format:

User: [Name], [Age or Age Group], [Country], [Profession], [Work Style/Type].
Behavior: [Summary of Todo completion rate and planning style] — [Journal frequency, timing, or emotional patterns] — [Active goals status (on track/behind)] — [Top spending/finance characteristics] — [Streak/habit consistency (number of streaks and average/longest streak)] — [Daily schedule density (total schedules count, average schedules per day, and flexible schedules)].
Current focus: [Primary goals/projects or current focus]. Energy: [Peak energy hours description].
Most used: [Estimated most used modules/features (e.g., Tasks, Journal, Goals, Streaks, Schedules)]. Least used: [Estimated least used modules/features (e.g., Shopping, Finance, Budget)].
Quiet hours: [Silence hours/Quiet hours].

Strict Rules:
- Output exactly 5 lines, matching the exact prefix formats shown above (User:, Behavior:, Current focus:, Most used:, Quiet hours:). No extra lines, no markdown bold/italics, no bullet points, no markdown formatting.
- Output ONLY the 5 lines.
- Third-person perspective only. Never address the user as "you" or use "your", "I", or "my". Use "User" or third-person pronouns.
- Address user as "User" or by name if name is known.
`;

    // Extracting onboarding details for prompt
    const name = `${onboardingData?.firstName || ''} ${onboardingData?.lastName || ''}`.trim() || 'User';
    const age = onboardingData?.ageGroup?.value || 'Not specified';
    const country = onboardingData?.country?.value || 'Not specified';
    const profession = onboardingData?.profession?.value || onboardingData?.professionType?.value || 'Not specified';
    const workStyle = onboardingData?.workStyle?.value || 'Not specified';
    const quietHours = onboardingData?.quitHours?.value 
      ? `${onboardingData.quitHours.value[0]}:00 to ${onboardingData.quitHours.value[1]}:00` 
      : 'Not specified';
    const peakHours = onboardingData?.peakHours?.value?.join(', ') || 'Not specified';

    const userPrompt = `Input Data for Consolidated Profile:

User Profile:
- Name: ${name}
- Age Group: ${age}
- Country: ${country}
- Profession: ${profession}
- Work Style: ${workStyle}
- Quiet Hours: ${quietHours}
- Peak Energy Hours: ${peakHours}

Journal Context:
- Summary: ${journalContext?.summary || 'No recent journal summary.'}
- Entries Analyzed: ${journalContext?.journalCount ?? 0}

Todo/Tasks Context:
- Summary: ${todoContext?.summary || 'No recent todo summary.'}
- Total Completed: ${todoContext?.totalCompletedCount ?? 0}
- Total Active: ${todoContext?.totalActiveCount ?? 0}

Goal Context:
- Summary: ${goalContext?.summary || 'No recent goals summary.'}
- Total Completed: ${goalContext?.totalCompletedCount ?? 0}
- Total Active: ${goalContext?.totalActiveCount ?? 0}
- Consistency: ${goalContext?.overallConsistency ?? 100}%
- Check-ins (Last 30 Days): ${goalContext?.checkInsLast30Days ?? 0}

Finance Context:
- Summary: ${financeContext?.summary || 'No recent financial summary.'}
- Available: PKR ${financeContext?.availableAmount ?? 0}
- Freeze: PKR ${financeContext?.freezeAmount ?? 0}
- Total: PKR ${financeContext?.totalAmount ?? 0}
- Upcoming Expenses: ${financeContext?.upcomingExpensesCount ?? 0} (PKR ${financeContext?.upcomingExpensesTotal ?? 0})
- Borrowed: PKR ${financeContext?.outstandingBorrowTotal ?? 0}
- Lent: PKR ${financeContext?.outstandingLendTotal ?? 0}

Streak Context:
- Summary: ${streakContext?.summary || 'No recent streak summary.'}
- Total Streaks: ${streakContext?.totalCount ?? 0}
- Average Streak Length: ${streakContext?.averageStreak ?? 0}
- Longest Streak: ${streakContext?.longestStreak ?? 0}

Schedule Context:
- Summary: ${scheduleContext?.summary || 'No recent schedules summary.'}
- Total Registered: ${scheduleContext?.totalCount ?? 0}
- Average Daily Schedules: ${scheduleContext?.averageDailySchedules ?? 0}
- Flexible Schedules Count: ${scheduleContext?.flexibleCount ?? 0}

Write the 5-line consolidated context now.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 250,
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

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error in consolidated-summary route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
