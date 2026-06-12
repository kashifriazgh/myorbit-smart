import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, type, targetValue, unit, dueDate, category, currentDate, userContext } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is missing. Please add it to your .env.local file and restart your dev server.' },
        { status: 500 }
      );
    }

    let systemPrompt = '';
    let prompt = '';
    let maxTokens = 300;

    const todayDate = currentDate || new Date().toISOString().split('T')[0];

    if (action === 'refine-title') {
      if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
      systemPrompt = `You are a helpful AI assistant. Analyze the user's goal title.
If the title is too short, has spelling mistakes, or is poorly phrased, suggest a better, clearer, action-oriented title. Otherwise, return the original title.
The suggested title is for an individual user's personal goal tracker. It must be direct, personal, and action-oriented (e.g., "Gain weight healthily" or "Reach a healthy target weight").
Do NOT include geographic locations (like city or country names), profession, demographics, or third-person broad advice/strategies.
Keep the title concise (maximum 6 words).
Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "isGood": false,
  "suggestedTitle": "A better, clearer version of the title"
}`;
      prompt = `Title: "${title}"`;
      maxTokens = 80;
    } else if (action === 'refine-category') {
      const activeCategory = category || type;
      systemPrompt = `You are a goal analysis assistant. Analyze the goal title and its current category.
Predefined categories & units:
- finance: PKR, USD, EUR, %, transactions, items
- health: kg, lbs, steps, minutes, hours, days, %
- learning: minutes, hours, lessons, chapters, pages, courses
- habit: days, times, streak, weeks
- work: tasks, hours, projects, %, clients
- lifestyle: days, sessions, events, activities, hours

Rules:
1. Evaluate the goal title and match it to the absolute best category from our predefined list. For example, "Lose weight" matches "health", "Learn React" matches "learning", "Save 10k" matches "finance".
2. If the current category is empty, "custom", or is not the best match for the goal title, suggest the correct matching category from our predefined list and a suggested unit. Set "suitable" to false.
3. If the current category matches the goal title well, set "suitable" to true, and suggest the same category and a suggested unit.

Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "suitable": true,
  "suggestedCategory": "health",
  "suggestedUnit": "kg"
}`;
      prompt = `Goal Title: "${title}" | Current Category: "${activeCategory || 'None'}"`;
      maxTokens = 100;
    } else if (action === 'refine-due-date') {
      systemPrompt = `You are a goal analysis assistant. Analyze if the goal due date is suitable.
Current Date is ${todayDate}.
Rules:
1. If the user has not selected a due date (null, empty or "None"), propose a suitable timeframe (e.g. "3 months") with a brief, helpful explanation. Suggest the exact date in YYYY-MM-DD format based on the timeframe from Current Date.
2. If the user has selected a due date, check if it is realistic (e.g. losing 20kg in 1 week is unrealistic). If it is unsuitable, set "dueDateSuitable" to false, suggest a realistic timeframe, and suggest the exact date in YYYY-MM-DD format. If it is suitable, set "dueDateSuitable" to true, and suggest the same user due date.

Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "dueDateSuitable": true,
  "dueDateSuggestion": "3 months (realistic timeframe for habits)",
  "suggestedDate": "YYYY-MM-DD"
}`;
      prompt = `Goal: "${title}" | Category: "${category || type || 'None'}" | Due Date: "${dueDate || 'None'}"`;
      maxTokens = 120;
    } else if (action === 'refine-target-value') {
      systemPrompt = `You are a goal analysis assistant. Determine a reasonable target value, a descriptive label, and the progress metrics configuration for tracking this goal.
Analyze what the user actually wants to achieve from the title (e.g., "Read Clean Code" -> target value 300 pages, "Lose weight" -> target value 5 kg loss or 70 kg).
Rules for Progress Mode (progressMode):
- progressMode is "cumulative" if progress accumulates over time (pages read, km run, money deposited, tasks done).
- progressMode is "current_value" if the user logs a live snapshot reading (weight, account balance, completion rate).
- startValueNeeded is true if progressMode is "current_value". Provide a startValueLabel asking for their current level (e.g., "What is your current weight in kg?").
- direction is "down" for current_value mode where the target is lower than start (weight loss, debt reduction), otherwise "up". For cumulative, direction is null.

Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "targetValueSuggestion": 100,
  "label": "Total pages to read",
  "progressMode": "cumulative",
  "direction": "up",
  "startValueNeeded": false,
  "startValueLabel": null
}`;
      prompt = `Goal: "${title}" | Category: "${category || type}" | Unit: "${unit || 'None'}" | Due Date: "${dueDate || 'None'}"`;
      maxTokens = 150;
    } else if (action === 'refine-tracking') {
      const activeCategory = category || type;
      systemPrompt = `You are a goal analysis assistant. Based on the finalized goal details, recommend the tracking setup.
Analyze:
1. Frequency: should the user log this daily, weekly, bi-weekly (biweekly), or monthly?
2. Method: should they create a detailed "tracker" (recurring logs) or "milestones" (project-like phases)?
Also extract the base action verb and activity verb phrase.

Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "frequency": "daily" | "weekly" | "biweekly" | "monthly",
  "trackingMethod": "tracker" | "milestones",
  "reason": "One short encouraging sentence explaining why.",
  "activityVerb": "read this book",
  "verb": "read"
}`;
      prompt = `Goal: "${title}" | Category: "${activeCategory}" | Unit: "${unit}" | Due Date: "${dueDate || 'None'}" | Target Value: ${targetValue || 'None'}`;
      maxTokens = 150;
    } else {
      // Fallback: Original full smart-nudge behavior
      if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

      systemPrompt = `You are a goal analysis assistant. Given a user's goal details, return a JSON object (no markdown, no extra text) that helps the app understand how to track the goal correctly.

You MUST return ONLY a valid JSON object. Do not include markdown code block formatting or any text outside the JSON.

Response format:
{
  "nudge": "A friendly, short nudge/question asking how the user wants to approach this specific goal (milestones or recurring tracker). Max 25 words. No quotes.",
  "activityVerb": "A short action verb phrase representing the core action (e.g. 'read this book' for 'Read Clean Code', 'run' for 'Run 5km', 'practice guitar').",
  "verb": "A single base action verb (e.g. 'read', 'run', 'practice', 'study', 'work').",
  "suggestedUnit": "A suggested unit of work if not already provided or if the current one is blank (e.g. 'pages', 'km', 'hours', 'minutes').",
  "progressMode": "cumulative" | "current_value",
  "direction": "up" | "down" | null,
  "startValueNeeded": true | false,
  "startValueLabel": "string or null — e.g. 'What is your current weight?'",
  "progressModeAmbiguous": true | false,
  "trackingMethodSuggestion": "tracker" | "milestones",
  "trackingMethodReason": "one short sentence why",
  "targetValueClear": true | false,
  "targetValueSuggestion": "string or null — suggested target value if vague, else null",
  "unitClear": true | false,
  "unitSuggestion": "string or null — suggested unit if unclear, else null",
  "clarifyingQuestion": "string or null — one question if critical details are ambiguous, else null",
  "dueDateSuitable": true | false,
  "dueDateSuggestion": "string or null — if the current due date is unrealistic or unsuitable suggest a more realistic timeframe and specific due date, else null"
}`;

      prompt = `Goal: "${title}"${targetValue ? ` | Target: ${targetValue} ${unit ?? ''}` : ''}${dueDate ? ` | Due: ${dueDate}` : ''}${type ? ` | Type: ${type}` : ''}`;
      maxTokens = 300;
    }

    let contextPrompt = '';
    if (userContext) {
      const { country, city, profession, workStyle, peakHours, aiTone } = userContext;
      const parts = [];
      if (country) parts.push(`located in ${city && city !== 'Other' ? `${city}, ` : ''}${country}`);
      if (profession && profession !== 'Other') parts.push(`works as a ${profession}`);
      if (workStyle) parts.push(`has a ${workStyle} productivity/work style`);
      if (peakHours && peakHours.length > 0) parts.push(`most energetic peak hours are: ${peakHours.join(', ')}`);
      if (aiTone) parts.push(`prefers an AI tone that is ${aiTone}`);
      
      if (parts.length > 0) {
        contextPrompt = `User Profile Context (tailor the suggestions to fit their habits & profile): The user is ${parts.join('; ')}.`;
      }
    }

    if (contextPrompt && action !== 'refine-title') {
      systemPrompt = `${systemPrompt}\n\n${contextPrompt}`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Groq API error (status ${response.status}):`, errorText);
      if (action) {
        let cleanErr = 'AI response failed';
        try {
          const errJson = JSON.parse(errorText);
          if (errJson?.error?.message) cleanErr = errJson.error.message;
        } catch {
          if (errorText) cleanErr = errorText.slice(0, 150);
        }
        return NextResponse.json({ error: cleanErr }, { status: 500 });
      }
      return NextResponse.json({ nudge: null }, { status: 200 });
    }

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content?.trim() ?? '';

    // Strip code blocks if present
    content = content.replace(/```(?:json)?/gi, '').trim();

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch (e) {
      console.error('Failed to parse AI response:', content, e);
      return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in smart-nudge route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
