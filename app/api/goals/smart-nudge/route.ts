import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, type, targetValue, unit, dueDate, category, currentDate, userContext } = body;

    const fallbackRefineTitle = {
      isGood: true,
      suggestedTitle: title || '',
      intent: 'custom',
      progressTrackingType: 'accumulative',
      direction: null,
      progressMode: 'cumulative',
      suggestedCategory: 'custom',
      suggestedUnit: 'units',
      targetValueSuggestion: null,
      startingValueSuggestion: 0,
      dueDateSuggestion: null,
      timeFrameSuggestion: null,
      startValueNeeded: false,
      trackingMethodSuggestion: 'milestones',
      verb: 'achieve',
      activityVerb: 'complete goal',
    };

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      if (action === 'refine-title') {
        return NextResponse.json(fallbackRefineTitle);
      }
      if (action === 'evaluate-milestone-contribution') {
        return NextResponse.json({
          role: 'contributive',
          contributionAmount: 10,
          reason: 'Default fallback contribution evaluation.',
        });
      }
      return NextResponse.json({ nudge: null }, { status: 200 });
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

In addition to refining the title, evaluate and suggest the best configuration metrics for this goal:
- intent: a short single verb or core intent extracted from the goal (e.g. "save" for saving money, "read" for reading books, "lose" for weight loss, "gain" for weight gain, "learn" for learning skill).
- progressTrackingType: "accumulative" (progress moves in ONE direction UP, e.g. saving money, reading pages, lessons) or "opposes" (progress can move UP or DOWN relative to a starting baseline e.g. weight loss starting 80kg to 70kg, weight gain 60kg to 70kg).
- direction: "UP" or "DOWN" (when progressTrackingType is "opposes", e.g. weight loss is "DOWN", weight gain is "UP", or null if accumulative).
- progressMode: "cumulative" or "current_value".
- suggestedCategory: one of: "finance", "health", "learning", "habit", "work", "lifestyle", "custom".
- suggestedSubcategory: suggested subcategory string (e.g. "Saving", "Fitness", "Reading", "Career", "Travel", "Build Habit").
- suggestedUnit: a measurement unit suitable for the goal (e.g. "kg", "PKR", "pages", "hours", "tasks").
- targetValueSuggestion: a suggested number target if none is specified or if it's vague (otherwise null).
- startingValueSuggestion: a suggested starting baseline number (e.g. 80 for weight loss 80kg -> 60kg, 60 for weight gain, or 0 for saving/accumulative).
- dueDateSuggestion: a suggested due date in YYYY-MM-DD format parsed from the title. (Calculate it relative to the provided Today's Date. E.g. if the title contains "in next 3 months" or "in 3 months", calculate the date exactly 3 months after Today's Date. Return in YYYY-MM-DD format. If no timeframe is mentioned in the title, return null).
- timeFrameSuggestion: a readable calculated duration string (e.g. "30 days", "3 months") or null.
- startValueNeeded: true if progressTrackingType is "opposes" or progressMode is "current_value", otherwise false.
- startValueLabel: a brief prompt label asking for their current level (e.g. "What is your current weight in kg?") or null.
- trackingMethodSuggestion: "tracker" (frequent status logging) or "milestones" (project-like phases/checkpoints).
- verb: a single base action verb (e.g. "read", "run", "practice", "study", "work").
- activityVerb: a short action verb phrase (e.g. "read this book", "run", "practice guitar").
- reason: a short encouraging sentence explaining why this tracking setup is recommended.

Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "isGood": false,
  "suggestedTitle": "...",
  "intent": "save" | "read" | "lose" | "gain" | "learn" | "visit" | "custom",
  "progressTrackingType": "accumulative" | "opposes",
  "direction": "UP" | "DOWN" | null,
  "progressMode": "cumulative" | "current_value",
  "suggestedCategory": "finance" | "health" | "learning" | "habit" | "work" | "lifestyle" | "custom",
  "suggestedUnit": "...",
  "targetValueSuggestion": 100,
  "startingValueSuggestion": 0,
  "dueDateSuggestion": "YYYY-MM-DD" | null,
  "timeFrameSuggestion": "30 days" | null,
  "startValueNeeded": false,
  "startValueLabel": "...",
  "trackingMethodSuggestion": "tracker" | "milestones",
  "verb": "...",
  "activityVerb": "...",
  "reason": "..."
}`;
      prompt = `Title: "${title}"\nToday's Date: "${todayDate}"`;
      maxTokens = 450;
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
    } else if (action === 'evaluate-milestone-contribution') {
      const { goalTitle, goalTarget, goalUnit, milestoneTitle, milestoneType } = body;
      systemPrompt = `You are a precision productivity assistant evaluating a goal milestone.
Main Goal Title: "${goalTitle || 'Goal'}" | Target: ${goalTarget || 0} ${goalUnit || 'units'}
Milestone Activity: "${milestoneTitle || title || ''}" | Type: "${milestoneType || 'manual'}"

Rules:
1. Determine if this milestone is "contributive" (directly adds numerical value to the ${goalUnit || 'units'} target upon completion) or "supportive" (helps achieve the goal without adding numerical ${goalUnit || 'units'} progress).
2. If contributive, estimate/extract the numerical amount it contributes towards ${goalUnit || 'units'}.

Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "role": "contributive" | "supportive",
  "contributionAmount": 10,
  "reason": "Short explanation"
}`;
    } else if (action === 'recommend-milestone-type') {
      const { subcategory, measurementType } = body;
      systemPrompt = `You are an expert productivity coach. Analyze the given goal details and recommend the absolute best milestone type for this goal.
Available milestone types:
- "schedule": Sync with calendar events. Best for time-bound activities, exercise/fitness sessions, routine study blocks, or sleep consistency.
- "todo": Sync with task checklists. Best for actionable tasks, project deliverables, skill exercises, or reading chapters.
- "finance_source": Sync with wallet / fund source. Best for monetary savings, debt pay-off, income targets, investments, or spending limits.
- "manual": Manual checkpoint. Best for custom milestones or general progress entries.

Provide your response strictly in the following JSON format without any markdown or code blocks:
{
  "recommendedMilestoneType": "schedule" | "todo" | "finance_source" | "manual",
  "reason": "One short, clear sentence explaining why this milestone type fits this goal best."
}`;
      prompt = `Goal Title: "${title}" | Category: "${category || type || 'custom'}" | Subcategory: "${subcategory || 'None'}" | Unit: "${unit || 'units'}" | MeasurementType: "${measurementType || 'qty'}" | Target: ${targetValue || 'None'}`;
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

    const getFallbackForAction = () => {
      if (action === 'refine-title') {
        return fallbackRefineTitle;
      }
      if (action === 'evaluate-milestone-contribution') {
        return {
          role: 'contributive',
          contributionAmount: 10,
          reason: 'Evaluated based on activity metrics.',
        };
      }
      if (action === 'refine-category') {
        return {
          suitable: true,
          suggestedCategory: category || type || 'custom',
          suggestedUnit: 'units',
        };
      }
      if (action === 'refine-due-date') {
        return {
          dueDateSuitable: true,
          dueDateSuggestion: null,
          suggestedDate: dueDate || null,
        };
      }
      if (action === 'refine-target-value') {
        return {
          targetValueSuggestion: targetValue || 100,
          label: 'Target Value',
          progressMode: 'cumulative',
          direction: 'up',
          startValueNeeded: false,
          startValueLabel: null,
        };
      }
      return { nudge: null };
    };

    if (!GROQ_API_KEY) {
      return NextResponse.json(getFallbackForAction(), { status: 200 });
    }

    systemPrompt = `${systemPrompt}\n\nCRITICAL FORMATTING INSTRUCTION: You MUST return ONLY a valid, raw JSON object matching the exact schema above. Do NOT include markdown code blocks, backticks (\`\`\`), or any text outside the JSON boundaries.`;

    if (contextPrompt && action !== 'refine-title') {
      systemPrompt = `${systemPrompt}\n\n${contextPrompt}`;
    }

    let fewShotMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (action === 'refine-title') {
      fewShotMessages = [
        {
          role: 'user',
          content: 'Title: "Save 100,000 PKR for laptop"\nToday\'s Date: "2026-09-01"',
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            isGood: true,
            suggestedTitle: "Save 100,000 PKR for laptop",
            intent: "save",
            progressTrackingType: "accumulative",
            direction: null,
            progressMode: "cumulative",
            suggestedCategory: "finance",
            suggestedUnit: "PKR",
            targetValueSuggestion: 100000,
            startingValueSuggestion: 0,
            dueDateSuggestion: null,
            timeFrameSuggestion: null,
            startValueNeeded: false,
            startValueLabel: null,
            trackingMethodSuggestion: "milestones",
            verb: "save",
            activityVerb: "save money",
            reason: "Targeting an accumulation savings goal is best tracked with milestones or fund balance."
          }),
        },
        {
          role: 'user',
          content: 'Title: "Lose 10 kg weight in 2 months"\nToday\'s Date: "2026-09-01"',
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            isGood: true,
            suggestedTitle: "Lose 10 kg weight",
            intent: "lose",
            progressTrackingType: "opposes",
            direction: "DOWN",
            progressMode: "current_value",
            suggestedCategory: "health",
            suggestedUnit: "kg",
            targetValueSuggestion: 10,
            startingValueSuggestion: 80,
            dueDateSuggestion: "2026-11-01",
            timeFrameSuggestion: "2 months",
            startValueNeeded: true,
            startValueLabel: "What is your current weight in kg?",
            trackingMethodSuggestion: "tracker",
            verb: "lose",
            activityVerb: "lose weight",
            reason: "Weight loss is an opposing target best measured by logging live current values."
          }),
        },
      ];
    } else if (action === 'evaluate-milestone-contribution') {
      fewShotMessages = [
        {
          role: 'user',
          content: 'Goal Title: "Save 100,000 PKR for Laptop" | Milestone: "Do extra work to earn 600 PKR"',
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            role: "contributive",
            contributionAmount: 600,
            reason: "Directly adds 600 PKR towards the 100,000 PKR savings target."
          }),
        },
        {
          role: 'user',
          content: 'Goal Title: "Save 100,000 PKR for Laptop" | Milestone: "Research laptop brands and compare prices"',
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            role: "supportive",
            contributionAmount: 0,
            reason: "Enabling research task that helps achieve the goal without adding direct monetary savings."
          }),
        },
      ];
    }

    // ── Max 3 Retries Mechanism ───────────────────────────────────────────────
    for (let attempt = 1; attempt <= 3; attempt++) {
      const selectedModel = attempt === 1 ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b';

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...fewShotMessages,
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: maxTokens,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let content = data?.choices?.[0]?.message?.content?.trim() ?? '';
          content = content.replace(/```(?:json)?/gi, '').trim();

          const firstBrace = content.indexOf('{');
          const lastBrace = content.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            content = content.slice(firstBrace, lastBrace + 1);
          }

          if (content) {
            const parsed = JSON.parse(content);
            return NextResponse.json(parsed);
          }
        } else {
          console.warn(`Groq API attempt ${attempt}/3 with model ${selectedModel} failed (${response.status})`);
        }
      } catch (err) {
        console.warn(`Groq API attempt ${attempt}/3 with model ${selectedModel} exception:`, err);
      }

      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 100));
      }
    }

    return NextResponse.json(getFallbackForAction(), { status: 200 });
  } catch (error) {
    console.error('Error in smart-nudge route:', error);
    return NextResponse.json({ nudge: null }, { status: 200 });
  }
}
