require('dotenv').config();
const ClaudeService = require('./src/services/ClaudeService');

async function testClaude() {
    try {
        console.log('Testing Claude Service...');
        
        const claudeService = new ClaudeService();
        
        // Test basic response generation
        console.log('\n1. Testing basic response generation...');
        const response = await claudeService.generateResponse(
            'Hello! Can you provide a brief overview of what you can help with regarding data analysis and reporting?'
        );
        console.log('Claude Response:', response);
        
        // Test report recommendations
        console.log('\n2. Testing report recommendations...');
        const sampleReportData = {
            collegeName: 'Sample College',
            studentCount: 1500,
            averageGrade: 75.5,
            attendanceRate: 92.3,
            completionRate: 88.7
        };
        
        const recommendations = await claudeService.generateReportRecommendations(sampleReportData);
        console.log('AI Recommendations:', recommendations);
        
        console.log('\n✅ Claude service test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing Claude service:', error.message);
        
        if (error.message.includes('API key')) {
            console.log('\n💡 To use Claude, you need to:');
            console.log('1. Get an API key from https://console.anthropic.com/');
            console.log('2. Add ANTHROPIC_API_KEY=your_api_key_here to your .env file');
        }
    }
}

// Run the test
testClaude();
