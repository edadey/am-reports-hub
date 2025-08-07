const Anthropic = require('@anthropic-ai/sdk');

class ClaudeService {
    constructor() {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required. Please add it to your .env file.');
        }
        
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    /**
     * Generate a response using Claude
     * @param {string} prompt - The prompt to send to Claude
     * @param {string} model - The model to use (default: claude-3-5-sonnet-20241022)
     * @returns {Promise<string>} The generated response
     */
    async generateResponse(prompt, model = 'claude-3-5-sonnet-20241022') {
        try {
            const message = await this.client.messages.create({
                model: model,
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            return message.content[0].text;
        } catch (error) {
            console.error('Error generating Claude response:', error);
            throw new Error(`Failed to generate Claude response: ${error.message}`);
        }
    }

    /**
     * Generate AI recommendations for reports
     * @param {Object} reportData - The report data to analyse
     * @returns {Promise<string>} AI recommendations
     */
    async generateReportRecommendations(reportData) {
        const prompt = `Based on the following college report data, provide insights and recommendations for improvement:

${JSON.stringify(reportData, null, 2)}

Please provide:
1. Key insights about the data
2. Areas for improvement
3. Specific recommendations
4. Potential risks or concerns

Format your response in a clear, structured manner.`;

        return await this.generateResponse(prompt);
    }

    /**
     * Analyse college performance data
     * @param {Object} performanceData - Performance metrics
     * @returns {Promise<string>} Analysis results
     */
    async analysePerformance(performanceData) {
        const prompt = `Analyse the following college performance data and provide a comprehensive assessment:

${JSON.stringify(performanceData, null, 2)}

Please provide:
1. Performance summary
2. Strengths identified
3. Areas needing attention
4. Comparative analysis (if applicable)
5. Actionable recommendations`;

        return await this.generateResponse(prompt);
    }
}

module.exports = ClaudeService;
