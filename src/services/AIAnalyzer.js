const moment = require('moment');
const OpenAI = require('openai');

class AIAnalyzer {
  constructor() {
    this.analysisCache = new Map();
    
    // Enhanced rate limiting and caching
    this.apiCallCount = 0;
    this.lastApiCall = 0;
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours cache
    this.retryDelay = 2000; // 2 seconds between retries
    this.maxRetries = 3;
  }

  // Get OpenAI configuration dynamically (not cached in constructor)
  getOpenAIConfig() {
    return {
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      aiAnalysisEnabled: process.env.AI_ANALYSIS_ENABLED === 'true',
      aiRateLimit: parseInt(process.env.AI_RATE_LIMIT) || 100,
      aiProvider: process.env.AI_PROVIDER || 'openai'
    };
  }

  // Check if OpenAI integration is available
  isOpenAIAvailable() {
    const config = this.getOpenAIConfig();
    
    // Check for valid API key format (should start with sk- and be reasonable length)
    // Accept both personal keys (sk-) and project keys (sk-proj-) with appropriate length ranges
    const hasValidApiKey = config.openaiApiKey && 
                          config.openaiApiKey.startsWith('sk-') && 
                          config.openaiApiKey.length > 20 && 
                          config.openaiApiKey.length < 200 && // Increased limit for project keys
                          config.openaiApiKey !== 'your-openai-api-key-here';
    const isEnabled = config.aiAnalysisEnabled;
    
    // Enhanced logging to debug
    console.log('🔍 AIAnalyzer Availability Check:', {
      aiAnalysisEnabled: isEnabled,
      hasValidApiKey: hasValidApiKey,
      apiKeyLength: config.openaiApiKey ? config.openaiApiKey.length : 0,
      apiKeyPreview: config.openaiApiKey ? config.openaiApiKey.substring(0, 10) + '...' : 'none',
      apiKeyStartsWithSk: config.openaiApiKey ? config.openaiApiKey.startsWith('sk-') : false,
      model: config.openaiModel,
      provider: config.aiProvider
    });
    
    if (!isEnabled) {
      console.log('❌ AI Analysis is disabled');
      return false;
    }
    
    if (!hasValidApiKey) {
      console.log('❌ OpenAI API key is missing, invalid format, or placeholder');
      return false;
    }
    
    console.log('✅ OpenAI integration is available');
    return true;
  }

  // Enhanced rate limiting with caching
  canMakeApiCall() {
    const now = Date.now();
    if (now - this.lastApiCall > 60000) { // Reset counter after 1 minute
      this.apiCallCount = 0;
    }
    
    if (this.apiCallCount >= this.aiRateLimit) {
      return false;
    }
    
    this.apiCallCount++;
    this.lastApiCall = now;
    return true;
  }

  // Generate cache key for college analysis
  generateCacheKey(collegeData, performanceData, peerData = null) {
    const keyData = {
      collegeId: collegeData.id,
      studentCount: performanceData.totalStudents,
      placementRate: performanceData.percentWithPlacements,
      activityRate: performanceData.percentStudentsWithActivities,
      assessmentRate: performanceData.assessmentCompletionRate,
      lastReportDate: collegeData.lastReportDate,
      peerDataVersion: peerData ? `${peerData.totalColleges}_${peerData.overallAverages?.placementRate?.toFixed(1)}` : 'none',
      promptVersion: 'v9' // Add version to force cache refresh with exact format requirements
    };
    return `analysis_${JSON.stringify(keyData)}`;
  }

  // Check cache for existing analysis
  getCachedAnalysis(cacheKey) {
    const cached = this.analysisCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      console.log('AIAnalyzer: Using cached analysis');
      return cached.data;
    }
    return null;
  }

  // Cache analysis result
  cacheAnalysis(cacheKey, data) {
    this.analysisCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    console.log('AIAnalyzer: Analysis cached');
  }

  // Generate OpenAI-powered recommendations with caching and retry logic
  async generateOpenAIRecommendations(collegeData, performanceData, peerData = null) {
    console.log('🚀 Starting OpenAI recommendations generation...');
    console.log('📊 Input data:', {
      hasCollegeData: !!collegeData,
      hasPerformanceData: !!performanceData,
      hasPeerData: !!peerData
    });
    
    if (!this.isOpenAIAvailable()) {
      console.log('❌ OpenAI not available, using fallback recommendations');
      return {
        success: false,
        message: 'OpenAI integration not available',
        recommendations: this.generateFallbackRecommendations(performanceData)
      };
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(collegeData, performanceData, peerData);
    const cachedResult = this.getCachedAnalysis(cacheKey);
    if (cachedResult) {
      return {
        success: true,
        recommendations: cachedResult,
        timestamp: new Date().toISOString(),
        cached: true
      };
    }

    if (!this.canMakeApiCall()) {
      return {
        success: false,
        message: 'Rate limit exceeded for AI analysis',
        recommendations: this.generateFallbackRecommendations(performanceData)
      };
    }

    // Retry logic for API calls
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`AIAnalyzer: Attempt ${attempt}/${this.maxRetries} - Building prompt for OpenAI...`);
        const prompt = this.buildOpenAIPrompt(collegeData, performanceData, peerData);
        console.log('AIAnalyzer: Prompt built, calling OpenAI API...');
        
        const response = await this.callOpenAIAPI(prompt);
        console.log('AIAnalyzer: OpenAI API call successful, parsing response...');
        
        const parsedResponse = this.parseOpenAIResponse(response);
        console.log('AIAnalyzer: Response parsed successfully:', {
          hasSections: !!parsedResponse.sections,
          sectionKeys: Object.keys(parsedResponse.sections || {}),
          hasKPISuggestions: !!parsedResponse.sections?.kpiSuggestions
        });
        
        // Cache the successful result
        this.cacheAnalysis(cacheKey, parsedResponse);
        
        return {
          success: true,
          recommendations: parsedResponse,
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        console.error(`AIAnalyzer: Attempt ${attempt} failed:`, error.message);
        
        // If it's a rate limit error, wait before retrying
        if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          console.log(`AIAnalyzer: Rate limit hit, waiting ${this.retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt)); // Exponential backoff
        }
        
        // If this is the last attempt, return fallback
        if (attempt === this.maxRetries) {
          console.error('AIAnalyzer: All retry attempts failed, using fallback');
          return {
            success: false,
            message: 'Failed to generate AI recommendations after retries',
            recommendations: this.generateFallbackRecommendations(performanceData)
          };
        }
      }
    }
  }

  // Build comprehensive prompt for OpenAI
  buildOpenAIPrompt(collegeData, performanceData, peerData) {
    const context = {
      college: {
        name: collegeData.name || 'Unknown College',
        studentCount: performanceData.totalStudents || 0,
        region: collegeData.region || 'Unknown',
        type: collegeData.type || 'General'
      },
      performance: {
        placementRate: performanceData.percentWithPlacements || 0,
        activityParticipation: performanceData.percentStudentsWithActivities || 0,
        assessmentCompletion: performanceData.assessmentRate || 0,
        trends: performanceData.trends || {}
      },
      peers: peerData || null
    };

    return `
You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation. Navigate (www.Navigate.uk.com) is a software company that helps colleges track, record, and manage non-curricular enrichment, employer engagement, and placement activities.

COLLEGE CONTEXT:
- Name: ${context.college.name}
- Student Population: ${context.college.studentCount} students
- Region: ${context.college.region}
- Type: ${context.college.type}

CURRENT PERFORMANCE:
- Placement Rate: ${context.performance.placementRate.toFixed(1)}%
- Activity Participation: ${context.performance.activityParticipation.toFixed(1)}%
- Assessment Completion: ${context.performance.assessmentCompletion.toFixed(1)}%

${peerData ? `PEER COMPARISON:
- Overall average: ${peerData.overallAverages?.placementRate?.toFixed(1)}% placement rate
- Similar colleges average: ${peerData.similarAverages?.placementRate?.toFixed(1)}% placement rate
- Top performers average: ${peerData.topPerformers?.averagePlacementRate?.toFixed(1)}% placement rate
- Current ranking: ${peerData.rankings?.placement || 'N/A'} out of ${peerData.totalColleges || 'N/A'} colleges
- Performance quartile: ${peerData.quartiles?.placement || 'N/A'} (1=top 25%, 4=bottom 25%)
- Gap to top performers: ${peerData.topPerformers?.gapToTop?.toFixed(1)}% below top performers` : ''}

NAVIGATE SOFTWARE SCOPE:
- Non-curricular enrichment activities
- Employer engagement and partnerships
- Student placement tracking and management
- Activity recording and reporting
- Termly and academic year KPI measurement
- UK FE regulations compliance

TASK:
Provide 2-3 most important recommendations for Navigate software implementation. Use EXACTLY this format:

1. IMMEDIATE ACTIONS
- List 2-3 key steps to improve Navigate usage
- Focus on quick wins and essential improvements
- Keep suggestions simple and achievable

2. TRAINING & DEVELOPMENT
- List 2-3 essential training needs
- Focus on core Navigate skills
- Keep it practical and straightforward

3. STRATEGIC PLANNING
- Provide 2-3 key long-term strategies
- Focus on sustainable implementation
- Keep it simple and clear

4. BEST PRACTICES
- List 2-3 essential best practices
- Focus on proven approaches
- Keep it practical and easy to follow

5. RESOURCE ALLOCATION
- Provide 2-3 key resource priorities
- Focus on highest impact areas
- Keep it simple and actionable

6. KPI SUGGESTIONS
- Provide 2-3 key performance indicators
- Focus on essential metrics
- Keep targets realistic and clear
- Use simple text without any formatting or special characters

IMPORTANT: Start each section with the exact heading format shown above (e.g., "1. IMMEDIATE ACTIONS", "2. TRAINING & DEVELOPMENT", etc.)

FORMAT REQUIREMENTS:
- Write in simple, clear UK English using British spelling
- Use a friendly, easy-to-understand tone
- Provide only 2-3 key suggestions per section
- Use simple bullet points without any markdown formatting (no **, *, or other special characters)
- Keep language straightforward and practical
- Focus on Navigate software and UK FE context
- Avoid complex terminology or lengthy explanations
- Make suggestions achievable and realistic
- For KPI suggestions: Use plain text only, no formatting or special characters
`;
  }

            // Call OpenAI API with optimized parameters
  async callOpenAIAPI(prompt) {
    const config = this.getOpenAIConfig();
    console.log('AIAnalyzer: callOpenAIAPI - Starting API call...');
    console.log('AIAnalyzer: callOpenAIAPI - Model:', config.openaiModel);
    console.log('AIAnalyzer: callOpenAIAPI - API Key available:', !!config.openaiApiKey);
    
    // Use direct HTTPS request instead of OpenAI library to avoid fetch issues
    const https = require('https');
    
    const postData = JSON.stringify({
      model: config.openaiModel,
      messages: [
        {
          role: "system",
          content: "You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation. Write in simple, clear UK English using British spelling. Keep your tone friendly and easy to understand. Provide only 2-3 most important, practical suggestions per section. Focus on Navigate software capabilities and UK FE best practices."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      top_p: 0.8
    });
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = JSON.parse(data);
              resolve(result.choices[0].message.content);
            } catch (error) {
              reject(new Error('Failed to parse OpenAI response'));
            }
          } else {
            reject(new Error(`OpenAI API error: ${res.statusCode} - ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // Parse OpenAI response
  parseOpenAIResponse(response) {
    try {
      console.log('AIAnalyzer: parseOpenAIResponse - Starting to parse response...');
      
      // OpenAI response is already a string
      const text = response;
      
      console.log('AIAnalyzer: parseOpenAIResponse - Raw text length:', text.length);
      console.log('AIAnalyzer: parseOpenAIResponse - First 200 chars:', text.substring(0, 200));
      
      // Parse the structured response
      const sections = {
        immediateActions: this.extractSection(text, 'IMMEDIATE ACTIONS'),
        trainingDevelopment: this.extractSection(text, 'TRAINING & DEVELOPMENT'),
        strategicPlanning: this.extractSection(text, 'STRATEGIC PLANNING'),
        bestPractices: this.extractSection(text, 'BEST PRACTICES'),
        resourceAllocation: this.extractSection(text, 'RESOURCE ALLOCATION'),
        kpiSuggestions: this.extractSection(text, 'KPI SUGGESTIONS')
      };

      console.log('AIAnalyzer: parseOpenAIResponse - Extracted sections:', {
        immediateActionsLength: sections.immediateActions.length,
        trainingDevelopmentLength: sections.trainingDevelopment.length,
        strategicPlanningLength: sections.strategicPlanning.length,
        bestPracticesLength: sections.bestPractices.length,
        resourceAllocationLength: sections.resourceAllocation.length,
        kpiSuggestionsLength: sections.kpiSuggestions.length
      });

      return {
        summary: this.generateSummaryFromOpenAI(text),
        sections: sections,
        rawResponse: text
      };
    } catch (error) {
      console.error('AIAnalyzer: Error parsing OpenAI response:', error);
      
      // Try to get text for error response
      let errorText = 'No structured response available';
      try {
        if (typeof response.text === 'function') {
          errorText = response.text();
        } else if (response.response && typeof response.response.text === 'function') {
          errorText = response.response.text();
        } else if (response.response && response.response.text) {
          errorText = response.response.text;
        }
      } catch (textError) {
        console.error('AIAnalyzer: Could not extract text from response:', textError);
      }
      
      return {
        summary: 'AI-generated recommendations available',
        sections: {},
        rawResponse: errorText
      };
    }
  }

      // Extract specific sections from OpenAI response
  extractSection(text, sectionName) {
    // Try multiple patterns to extract sections
    const patterns = [
      // Pattern 1: "SECTION NAME:" followed by content until next section or end
      new RegExp(`${sectionName}:(.*?)(?=\\d+\\.\\s*[A-Z]|$)`, 's'),
      // Pattern 2: "SECTION NAME" followed by content until next section or end
      new RegExp(`${sectionName}(.*?)(?=\\d+\\.\\s*[A-Z]|$)`, 's'),
      // Pattern 3: Look for section with asterisks or bold formatting
      new RegExp(`\\*\\*${sectionName}\\*\\*(.*?)(?=\\*\\*[A-Z]|$)`, 's'),
      // Pattern 4: Look for section with dashes or bullet points
      new RegExp(`${sectionName}.*?\\n(.*?)(?=\\n\\d+\\.|\\n\\*\\*[A-Z]|$)`, 's')
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 0) {
        console.log(`AIAnalyzer: extractSection - Found ${sectionName} with pattern:`, pattern);
        return match[1].trim();
      }
    }
    
    console.log(`AIAnalyzer: extractSection - No match found for ${sectionName}`);
    return '';
  }

  // Generate summary from OpenAI response
  generateSummaryFromOpenAI(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const firstSection = lines.find(line => line.includes('IMMEDIATE ACTIONS'));
    if (firstSection) {
      return `AI analysis completed. ${firstSection.split(':')[1]?.trim() || 'Recommendations available.'}`;
    }
    return 'AI-generated strategic recommendations available.';
  }

  // Fallback recommendations when OpenAI is not available
  generateFallbackRecommendations(performanceData) {
    const recommendations = [];
    
    if (performanceData.percentWithPlacements < 50) {
      recommendations.push({
        type: 'immediate',
        priority: 'high',
        message: 'Focus on improving placement rates through enhanced employer partnerships'
      });
    }
    
    if (performanceData.percentStudentsWithActivities < 60) {
      recommendations.push({
        type: 'training',
        priority: 'medium',
        message: 'Develop more engaging student activity programs'
      });
    }
    
    return {
      summary: 'Basic recommendations based on performance data',
      sections: {
        immediateActions: 'Focus on improving placement rates through enhanced employer partnerships\n- Review current employer engagement strategies\n- Identify opportunities for new partnerships',
        trainingDevelopment: 'Develop more engaging student activity programs\n- Assess current activity offerings\n- Plan staff training on Navigate features',
        strategicPlanning: 'Set clear targets for placement and activity rates\n- Establish quarterly review processes\n- Develop long-term improvement roadmap',
        bestPractices: 'Regular data review and reporting\n- Consistent activity recording procedures\n- Staff training on Navigate best practices',
        resourceAllocation: 'Prioritize staff training and development\n- Allocate time for regular data review\n- Invest in employer relationship building',
        kpiSuggestions: 'Increase placement rate to 50% by end of academic year\n- Improve activity participation to 25% within 6 months\n- Achieve 80% assessment completion rate'
      },
      rawResponse: 'Fallback recommendations - enable OpenAI integration for advanced analysis'
    };
  }

  // Enhanced analysis with OpenAI integration
  async generateEnhancedAnalysis(currentData, previousData, changes, timeFrame = 'weekly', collegeData = null) {
    // Generate basic analysis (existing functionality)
    const basicAnalysis = await this.generateAnalysis(currentData, previousData, changes, timeFrame);
    
    // Add OpenAI-powered recommendations if available
    if (this.isOpenAIAvailable() && collegeData) {
      const performanceData = {
        totalStudents: currentData.totalStudents || 0,
        percentWithPlacements: currentData.percentWithPlacements || 0,
        percentStudentsWithActivities: currentData.percentStudentsWithActivities || 0,
        assessmentRate: currentData.assessmentRate || 0,
        trends: changes
      };
      
      const openaiRecommendations = await this.generateOpenAIRecommendations(collegeData, performanceData);
      
      return {
        ...basicAnalysis,
        openaiRecommendations: openaiRecommendations,
        aiEnabled: true
      };
    }
    
    return {
      ...basicAnalysis,
      aiEnabled: false,
      message: 'Enable OpenAI integration for advanced AI recommendations'
    };
  }

  async generateAnalysis(currentData, previousData, changes, timeFrame = 'weekly') {
    const analysis = {
      summary: this.generateSummary(changes, timeFrame),
      trends: this.analyzeTrends(changes, timeFrame),
      anomalies: this.detectAnomalies(changes),
      recommendations: this.generateRecommendations(changes, timeFrame),
      keyMetrics: this.identifyKeyMetrics(changes),
      timestamp: new Date().toISOString()
    };

    return analysis;
  }

  generateSummary(changes, timeFrame) {
    const totalChanges = Object.keys(changes).length;
    const positiveChanges = Object.values(changes).filter(change => change > 0).length;
    const negativeChanges = Object.values(changes).filter(change => change < 0).length;
    
    let summary = `This ${timeFrame} report shows ${totalChanges} metrics with changes. `;
    summary += `${positiveChanges} metrics improved, ${negativeChanges} declined. `;
    
    if (positiveChanges > negativeChanges) {
      summary += "Overall performance shows positive trends.";
    } else if (negativeChanges > positiveChanges) {
      summary += "Overall performance shows areas for improvement.";
    } else {
      summary += "Performance remains stable.";
    }
    
    return summary;
  }

  analyzeTrends(changes, timeFrame) {
    const trends = {
      improving: [],
      declining: [],
      stable: []
    };

    Object.entries(changes).forEach(([metric, change]) => {
      const changePercent = Math.abs(change);
      
      if (changePercent > 10) {
        if (change > 0) {
          trends.improving.push({
            metric,
            change,
            significance: changePercent > 20 ? 'high' : 'moderate'
          });
        } else {
          trends.declining.push({
            metric,
            change,
            significance: changePercent > 20 ? 'high' : 'moderate'
          });
        }
      } else {
        trends.stable.push({ metric, change });
      }
    });

    return trends;
  }

  detectAnomalies(changes) {
    const anomalies = [];
    const threshold = 25; // 25% change threshold

    Object.entries(changes).forEach(([metric, change]) => {
      const changePercent = Math.abs(change);
      
      if (changePercent > threshold) {
        anomalies.push({
          metric,
          change,
          severity: changePercent > 50 ? 'critical' : 'warning',
          description: this.getAnomalyDescription(metric, change)
        });
      }
    });

    return anomalies;
  }

  getAnomalyDescription(metric, change) {
    if (change > 0) {
      return `Significant increase in ${metric} - investigate cause of improvement`;
    } else {
      return `Significant decrease in ${metric} - requires immediate attention`;
    }
  }

  generateRecommendations(changes, timeFrame) {
    const recommendations = [];
    
    // Analyze patterns and suggest actions
    const decliningMetrics = Object.entries(changes)
      .filter(([_, change]) => change < 0)
      .sort(([_, a], [__, b]) => a - b);

    if (decliningMetrics.length > 0) {
      recommendations.push({
        type: 'action',
        priority: 'high',
        message: `Focus on improving ${decliningMetrics[0][0]} - showing ${Math.abs(decliningMetrics[0][1])}% decline`
      });
    }

    // Add general recommendations based on timeFrame
    if (timeFrame === 'monthly') {
      recommendations.push({
        type: 'insight',
        priority: 'medium',
        message: 'Consider quarterly review of long-term trends and strategic adjustments'
      });
    }

    return recommendations;
  }

  identifyKeyMetrics(changes) {
    // Identify the most impactful changes
    const sortedChanges = Object.entries(changes)
      .sort(([_, a], [__, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 5);

    return sortedChanges.map(([metric, change]) => ({
      metric,
      change,
      impact: Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low'
    }));
  }

  // Generate KPI suggestions using AI
  async generateKPISuggestions(collegeData, performanceData) {
    try {
      console.log('AIAnalyzer: Generating KPI suggestions for college:', collegeData.name);
      
      if (!this.isOpenAIAvailable()) {
        console.log('AIAnalyzer: OpenAI not available, returning fallback KPIs');
        return this.generateFallbackKPIs(performanceData);
      }

      const prompt = this.buildKPIPrompt(collegeData, performanceData);
      const response = await this.callOpenAIAPI(prompt);
      
      if (response) {
        const kpiSuggestions = this.parseKPISuggestions(response);
        console.log('AIAnalyzer: Generated', kpiSuggestions.length, 'KPI suggestions');
        return kpiSuggestions;
      } else {
        console.log('AIAnalyzer: No response from OpenAI, using fallback KPIs');
        return this.generateFallbackKPIs(performanceData);
      }
    } catch (error) {
      console.error('AIAnalyzer: Error generating KPI suggestions:', error);
      return this.generateFallbackKPIs(performanceData);
    }
  }

  // Build prompt for KPI generation
  buildKPIPrompt(collegeData, performanceData) {
    const availableSections = performanceData.availableSections || {};
    
    return `You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation and KPI development.

COLLEGE CONTEXT:
- Name: ${collegeData.name || 'Unknown College'}
- Student Population: ${performanceData.totalStudents || 0} students
- Placement Rate: ${performanceData.percentWithPlacements || 0}%
- Activity Participation: ${performanceData.percentStudentsWithActivities || 0}%
- Assessment Completion: ${performanceData.assessmentCompletionRate || 0}%

AVAILABLE DATA SECTIONS:
- Placements: ${availableSections.placements ? 'Yes' : 'No'}
- Activities: ${availableSections.activities ? 'Yes' : 'No'}
- Assessments: ${availableSections.assessments ? 'Yes' : 'No'}
- Careers: ${availableSections.careers ? 'Yes' : 'No'}

CRITICAL REQUIREMENTS:
- ONLY suggest KPIs based on the data sections that are marked as "Yes" above
- DO NOT suggest KPIs for data sections marked as "No"
- Each KPI must be directly related to the actual data available
- Use the current performance metrics to set realistic improvement targets
- Focus on measurable improvements within the available data scope

TASK:
Generate 5-8 specific, measurable, and achievable Key Performance Indicators (KPIs) for this college based ONLY on the available data sections.

${availableSections.placements ? `
PLACEMENTS DATA AVAILABLE:
- Current placement rate: ${performanceData.percentWithPlacements || 0}%
- Students with placements: ${performanceData.studentsWithPlacements || 0}
- Total students: ${performanceData.totalStudents || 0}
` : ''}

${availableSections.activities ? `
ACTIVITIES DATA AVAILABLE:
- Current activity participation: ${performanceData.percentStudentsWithActivities || 0}%
- Students with activities: ${performanceData.studentsWithActivities || 0}
- Enrichment activities: ${performanceData.studentsWithActivitiesEnrichment || 0}
- Employer activities: ${performanceData.studentsWithActivitiesEmployer || 0}
` : ''}

${availableSections.assessments ? `
ASSESSMENTS DATA AVAILABLE:
- Current assessment completion: ${performanceData.assessmentCompletionRate || 0}%
- Students without assessments: ${performanceData.studentsWithoutAssessments || 0}
` : ''}

${availableSections.careers ? `
CAREERS DATA AVAILABLE:
- Careers-related metrics are available
` : ''}

REQUIREMENTS:
- Each KPI must be specific and measurable
- Include realistic targets based on current performance
- Focus on Navigate software capabilities
- Use UK FE terminology and standards
- Ensure KPIs are achievable within 6-12 months
- ONLY suggest improvements for areas where data is available

FORMAT:
Return ONLY a numbered list of KPIs, one per line, like this:
1. [Specific KPI with target and timeframe based on available data]
2. [Specific KPI with target and timeframe based on available data]
3. [Specific KPI with target and timeframe based on available data]
...and so on

Keep each KPI concise but specific. Focus on the most important areas for improvement based on the available data.`;
  }

  // Parse KPI suggestions from AI response
  parseKPISuggestions(response) {
    try {
      const lines = response.split('\n').filter(line => line.trim().length > 0);
      const kpiSuggestions = [];
      
      for (const line of lines) {
        // Remove numbering and clean up the line
        const cleanLine = line.replace(/^\d+\.\s*/, '').trim();
        if (cleanLine.length > 10) { // Minimum length for a valid KPI
          kpiSuggestions.push(cleanLine);
        }
      }
      
      // If parsing fails, return fallback KPIs
      if (kpiSuggestions.length === 0) {
        console.log('AIAnalyzer: Failed to parse KPI suggestions, using fallback');
        return this.generateFallbackKPIs();
      }
      
      return kpiSuggestions;
    } catch (error) {
      console.error('AIAnalyzer: Error parsing KPI suggestions:', error);
      return this.generateFallbackKPIs();
    }
  }

  // Generate fallback KPI suggestions
  generateFallbackKPIs(performanceData = null) {
    // Only generate KPIs based on available data
    if (performanceData) {
      const availableSections = performanceData.availableSections || {};
      const customKPIs = [];
      
      if (availableSections.placements) {
        const currentRate = performanceData.percentWithPlacements || 0;
        const target = Math.min(100, currentRate + 15);
        customKPIs.push(`Increase placement rate from ${currentRate.toFixed(1)}% to ${target.toFixed(1)}% within 6 months by enhancing employer engagement through Navigate's placement tracking features`);
      }
      
      if (availableSections.activities) {
        const currentRate = performanceData.percentStudentsWithActivities || 0;
        const target = Math.min(100, currentRate + 20);
        customKPIs.push(`Improve activity participation from ${currentRate.toFixed(1)}% to ${target.toFixed(1)}% within 6 months by promoting activities through Navigate's communication tools`);
      }
      
      if (availableSections.assessments) {
        const currentRate = performanceData.assessmentCompletionRate || 0;
        const target = Math.min(100, currentRate + 25);
        customKPIs.push(`Achieve assessment completion rate of ${target.toFixed(1)}% by next term by implementing Navigate reminders and support for students`);
      }
      
      if (availableSections.careers) {
        customKPIs.push(`Enhance career guidance services by utilizing Navigate's career tracking features to improve student career outcomes`);
      }
      
      // Return only data-driven KPIs
      return customKPIs.length > 0 ? customKPIs : ['No KPI suggestions available - insufficient data'];
    }
    
    // If no performance data, return generic message
    return ['No KPI suggestions available - please upload data to generate relevant KPIs'];
  }
}

module.exports = AIAnalyzer; 