const { GoogleGenerativeAI } = require("@google/generative-ai");

async function callGrokAPI(prompt, systemPrompt = "You are a helpful AI.", jsonMode = false) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing for fallback.");
    }

    const payload = {
        model: "grok-2-latest",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ]
    };

    if (jsonMode) {
        payload.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function generateAIInsights(tasks, schedule) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_gemini')) {
        return "AI Insights are currently disabled. Please add a valid Gemini API Key to your .env file.";
    }

    const pendingCount = tasks.length;
    const totalScheduledMins = tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);

    const prompt = `
        You are a helpful AI Time Management Assistant.
        The user has ${pendingCount} pending tasks today, totaling ${totalScheduledMins} minutes of work.
        Please write a 2-3 sentence encouraging and insightful summary.
        If they have too much work (>300 mins), gently suggest they move some tasks to tomorrow.
        If they have light work, encourage them to take breaks or learn something new.
        Keep it natural, direct, and under 50 words.
    `;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(prompt);
        const response = result.response.text();
        
        return response;
    } catch (error) {
        console.error("Gemini API Error, falling back to Grok:", error.message);
        try {
            return await callGrokAPI(prompt, "You are a helpful AI Time Management Assistant. Keep it natural, direct, and under 50 words.");
        } catch (grokError) {
            console.error("Grok Fallback Error:", grokError.message);
            return "You have " + tasks.length + " pending tasks. Have a productive day!";
        }
    }
}

async function parseTaskFromText(text) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_gemini')) {
        throw new Error('Gemini API key is not configured.');
    }

    const prompt = `
        You are a task parsing AI.
        Extract the task details from the following user input: "${text}"
        Return ONLY a raw JSON object (without markdown code blocks) with the following structure:
        {
            "title": "A short, actionable title",
            "estimatedDuration": duration in minutes (integer),
            "priority": "Critical" | "High" | "Medium" | "Low"
        }
        If duration is not mentioned, guess a reasonable one between 15 and 60.
        If priority is not mentioned, assume "Medium".
    `;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();
        if (response.startsWith('\`\`\`json')) {
            response = response.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        } else if (response.startsWith('\`\`\`')) {
            response = response.replace(/\`\`\`/g, '').trim();
        }
        
        return JSON.parse(response);
    } catch (error) {
        console.error("Gemini Parsing Error, falling back to Grok:", error.message);
        try {
            let response = await callGrokAPI(prompt, "You are a task parsing AI. Return ONLY a raw JSON object with no markdown.", true);
            if (response.startsWith('```json')) {
                response = response.replace(/```json/g, '').replace(/```/g, '').trim();
            } else if (response.startsWith('```')) {
                response = response.replace(/```/g, '').trim();
            }
            return JSON.parse(response);
        } catch (grokError) {
            console.error("Grok Parsing Fallback Error:", grokError.message);
            throw grokError;
        }
    }
}

async function agenticScheduleGeneration(tasks, userSettings, baseDate) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_gemini')) {
        throw new Error('Gemini API key is not configured.');
    }

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // We use gemini-2.5-flash for function calling support
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        tools: [{
            functionDeclarations: [{
                name: "commit_schedule",
                description: "Commit the final optimized daily schedule to the database.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        timeline: {
                            type: "ARRAY",
                            description: "The list of scheduled items in chronological order.",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    taskId: { type: "STRING", description: "The MongoDB ID of the task (omit for breaks/lunch)" },
                                    title: { type: "STRING", description: "Title of the task, Break, or Lunch" },
                                    startTime: { type: "STRING", description: "ISO 8601 date string for start time" },
                                    endTime: { type: "STRING", description: "ISO 8601 date string for end time" },
                                    type: { type: "STRING", description: "'Task', 'Break', or 'Lunch'" }
                                },
                                required: ["title", "startTime", "endTime", "type"]
                            }
                        }
                    },
                    required: ["timeline"]
                }
            }]
        }]
    });

    const prompt = `
You are an expert executive assistant AI. Your job is to create an optimized daily schedule for the user based on their pending tasks and constraints.
You MUST call the "commit_schedule" function with your final timeline.

Constraints:
- Base Date (Today): ${baseDate.toISOString()}
- Working Hours: ${userSettings.start} to ${userSettings.end}
- Lunch Break: Starts at ${userSettings.lunchBreakStart} and lasts ${userSettings.lunchBreakDuration} minutes.
- Buffer Time: Add ${userSettings.bufferTime} minutes of buffer between consecutive tasks.

Pending Tasks (JSON format):
${JSON.stringify(tasks, null, 2)}

Instructions:
1. Schedule high priority and critical tasks earlier in the day.
2. Respect "dependsOn" relationships (a task must be scheduled AFTER the task it depends on).
3. Do not schedule tasks during the Lunch Break. Add a "Lunch" item to the timeline.
4. Do not exceed the working hours. If some low-priority tasks cannot fit, omit them from today's timeline.
5. Provide the exact ISO string timestamps for startTime and endTime for every timeline item based on ${baseDate.toISOString().split('T')[0]}.
`;

    try {
        const result = await model.generateContent(prompt);
        const call = result.response.functionCalls()?.[0];
        
        if (call && call.name === "commit_schedule") {
            return call.args.timeline;
        } else {
            console.error("AI did not call commit_schedule. Fallback required.");
            return null; // Let the caller handle fallback
        }
    } catch (error) {
        console.error("Agentic Scheduling Error, falling back to Grok:", error.message);
        try {
            const fallbackPrompt = prompt + "\n\nRETURN ONLY A JSON OBJECT with a single key 'timeline' containing the array of scheduled items. Do not include markdown code blocks, just raw JSON.";
            let response = await callGrokAPI(fallbackPrompt, "You are an expert executive assistant AI. Return strictly valid JSON.", true);
            if (response.startsWith('```json')) {
                response = response.replace(/```json/g, '').replace(/```/g, '').trim();
            } else if (response.startsWith('```')) {
                response = response.replace(/```/g, '').trim();
            }
            const parsed = JSON.parse(response);
            if (parsed && parsed.timeline) {
                return parsed.timeline;
            }
            console.error("Grok Fallback Error: Invalid timeline format returned.");
            return null;
        } catch (grokError) {
            console.error("Grok Scheduling Fallback Error:", grokError.message);
            return null;
        }
    }
}

module.exports = {
    generateAIInsights,
    parseTaskFromText,
    agenticScheduleGeneration
};
