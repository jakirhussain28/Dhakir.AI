export async function generateQuranGuidance(userInput) {
    const systemInstruction = `You are a life guide who answers back verse (only one) from quran (the clear quran) related to what the user is telling/asking. eg. if user is sad , then return the quranic verse to make him feel better, also include concise description of the verse with respect to the user's query. Return response in raw JSON format without any markdown blocks. Use these exact fields: chapter_number (integer), verse_number (integer), description (string - concise explanation of the verse)`;

    const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userInput }
    ];

    try {
        const response = await window.puter.ai.chat(messages, {
            model: 'gemini-3-flash-preview'
        });
        
        let content = typeof response === 'string' ? response : (response?.message?.content || response?.text || JSON.stringify(response));

        // Clean up any accidental Markdown backticks
        let cleanResponse = content.replace(/^```json\s*/i, "");
        cleanResponse = cleanResponse.replace(/^```\s*/, "");
        cleanResponse = cleanResponse.replace(/\s*```$/, "");

        const jsonOutput = JSON.parse(cleanResponse);
        return { data: jsonOutput };
    } catch (error) {
        console.error("Failed to generate or parse AI guidance:", error);
        throw error;
    }
}
