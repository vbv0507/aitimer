const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateAIInsights(tasks, schedule) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_gemini')) {
        return "AI Insights are currently disabled. Please add a valid Gemini API Key to your .env file.";
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

        const result = await model.generateContent(prompt);
        const response = result.response.text();
        
        return response;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "You have " + tasks.length + " pending tasks. Have a productive day!";
    }
}

async function parseTaskFromText(text) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_gemini')) {
        throw new Error('Gemini API key is not configured.');
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();
        if (response.startsWith('\`\`\`json')) {
            response = response.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        } else if (response.startsWith('\`\`\`')) {
            response = response.replace(/\`\`\`/g, '').trim();
        }
        
        return JSON.parse(response);
    } catch (error) {
        console.error("Gemini Parsing Error:", error);
        throw error;
    }
}

module.exports = {
    generateAIInsights,
    parseTaskFromText
};
