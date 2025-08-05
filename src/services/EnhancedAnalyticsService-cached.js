const fs = require('fs').promises;
const path = require('path');
const AIAnalyzer = require('./AIAnalyzer');

class EnhancedAnalyticsService {
  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
    this.dataDir = path.join(__dirname, '../../data');
    this.reportsDir = path.join(__dirname, '../../data/reports');
    this.cacheDir = path.join(__dirname, '../../data/ai-cache');
    
    // Ensure cache directory exists
    this.ensureCacheDirectory();
  }

  /**
   * Ensure the cache directory exists
   */
  async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.log('Cache directory already exists or could not be created');
    }
  }

  /**
   * Get cache file path for a college
   */
  getCacheFilePath(collegeId) {
    return path.join(this.cacheDir, `${collegeId}-ai-recommendations.json`);
  }

  /**
   * Check if cached recommendations exist and are fresh
   */
  async getCachedRecommendations(collegeId) {
    try {
      const cachePath = this.getCacheFilePath(collegeId);
      const cacheData = await fs.readFile(cachePath, 'utf8');
      const cache = JSON.parse(cacheData);
      
      // Check if cache is still valid (24 hours)
      const cacheAge = Date.now() - cache.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < maxAge) {
        console.log(`✅ Using cached AI recommendations for college ${collegeId} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        return cache.recommendations;
      } else {
        console.log(`⏰ Cache expired for college ${collegeId} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        return null;
      }
    } catch (error) {
      console.log(`📝 No cache found for college ${collegeId}`);
      return null;
    }
  }

  /**
   * Save recommendations to cache
   */
  async saveRecommendationsToCache(collegeId, recommendations) {
    try {
      const cachePath = this.getCacheFilePath(collegeId);
      const cacheData = {
        collegeId,
        timestamp: Date.now(),
        recommendations
      };
      
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Cached AI recommendations for college ${collegeId}`);
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  /**
   * Clear cache for a college (for regeneration)
   */
  async clearCache(collegeId) {
    try {
      const cachePath = this.getCacheFilePath(collegeId);
      await fs.unlink(cachePath);
      console.log(`🗑️ Cleared cache for college ${collegeId}`);
      return true;
    } catch (error) {
      console.log(`No cache to clear for college ${collegeId}`);
      return false;
    }
  }

  /**
   * Generate comprehensive analytics with peer benchmarking
   */
  async generateEnhancedAnalytics(collegeId, forceRegenerate = false) {
    try {
      console.log('EnhancedAnalyticsService: Starting analysis for college:', collegeId);
      
      // Load college data
      const collegeData = await this.loadCollegeData(collegeId);
      console.log('EnhancedAnalyticsService: College data loaded:', collegeData ? 'Yes' : 'No');
      
      if (!collegeData) {
        throw new Error('College data not found');
      }

      // Load performance data
      const performanceData = await this.loadPerformanceData(collegeId);
      console.log('EnhancedAnalyticsService: Performance data loaded:', performanceData ? 'Yes' : 'No');
      
      // Generate peer comparison data
      const peerData = await this.generatePeerComparison(collegeData, performanceData);
      console.log('EnhancedAnalyticsService: Peer data generated:', peerData ? 'Yes' : 'No');
      
      // Check for cached recommendations first (unless force regenerate)
      let aiRecommendations;
      if (!forceRegenerate) {
        aiRecommendations = await this.getCachedRecommendations(collegeId);
        if (aiRecommendations) {
          console.log('✅ Using cached AI recommendations');
        }
      }
      
      // Generate new AI recommendations if no cache or force regenerate
      if (!aiRecommendations) {
        try {
          console.log('EnhancedAnalyticsService: Generating new AI recommendations...');
          
          // Use direct HTTPS request instead of AIAnalyzer to avoid fetch issues
          const https = require('https');
          
          const prompt = `You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation.

COLLEGE CONTEXT:
- Name: ${collegeData.name || 'Unknown College'}
- Student Population: ${performanceData.totalStudents || 0} students
- Placement Rate: ${performanceData.percentWithPlacements || 0}%
- Activity Participation: ${performanceData.percentStudentsWithActivities || 0}%

NAVIGATE SOFTWARE SCOPE:
- Non-curricular enrichment activities
- Employer engagement and partnerships
- Student placement tracking and management
- Activity recording and reporting

TASK:
Provide strategic recommendations in this exact format:

1. IMMEDIATE ACTIONS
- List 2-3 key steps to improve Navigate usage
- Focus on quick wins and essential improvements

2. TRAINING & DEVELOPMENT
- List 2-3 essential training needs
- Focus on core Navigate skills

3. STRATEGIC PLANNING
- Provide 2-3 key long-term strategies
- Focus on sustainable implementation

4. BEST PRACTICES
- List 2-3 essential best practices
- Focus on proven approaches

5. RESOURCE ALLOCATION
- Provide 2-3 key resource priorities
- Focus on highest impact areas

6. KPI SUGGESTIONS
- Provide 3-5 specific, measurable KPIs
- Focus on Navigate software metrics
- Include specific targets and timeframes

Keep all suggestions practical, achievable, and specific to UK FE colleges using Navigate software.`;

          const postData = JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
            max_tokens: 2000,
            temperature: 0.3
          });
          
          const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Length': Buffer.byteLength(postData)
            }
          };
          
          const response = await new Promise((resolve, reject) => {
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
                  reject(new Error(`OpenAI API error: ${res.statusCode}`));
                }
              });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
          });
          
          console.log('EnhancedAnalyticsService: OpenAI API call successful');
          
          // Parse the structured response
          const sections = this.extractAllSections(response);
          
          // Check if any sections were extracted successfully
          const hasValidSections = Object.values(sections).some(section => section && section.trim().length > 0);
          
          if (hasValidSections) {
            aiRecommendations = {
              success: true,
              recommendations: {
                summary: 'AI-generated strategic recommendations',
                sections: sections,
                rawResponse: response
              }
            };
          } else {
            console.log('No valid sections extracted, using fallback recommendations');
            aiRecommendations = {
              success: false,
              message: 'AI parsing failed, using fallback recommendations',
              recommendations: {
                summary: 'Basic recommendations based on performance data',
                sections: {
                  immediateActions: 'Focus on improving placement rates through enhanced employer partnerships\n- Review current employer engagement strategies\n- Identify opportunities for new partnerships',
                  trainingDevelopment: 'Develop more engaging student activity programs\n- Assess current activity offerings\n- Plan staff training on Navigate features',
                  strategicPlanning: 'Set clear targets for placement and activity rates\n- Establish quarterly review processes\n- Develop long-term improvement roadmap',
                  bestPractices: 'Regular data review and reporting\n- Consistent activity recording procedures\n- Staff training on Navigate best practices',
                  resourceAllocation: 'Prioritize staff training and development\n- Allocate time for regular data review\n- Invest in employer relationship building',
                  kpiSuggestions: `1. Increase student placement rate to 50% by end of academic year
2. Improve activity participation to 25% within 6 months  
3. Achieve 80% assessment completion rate
4. Reduce student dropout rate by 10%
5. Increase employer satisfaction score to 4.5/5
6. Ensure 90% of staff are trained on Navigate software
7. Achieve 95% data accuracy in activity recording
8. Increase employer partnerships by 20% year-on-year`
                },
                rawResponse: 'Fallback recommendations - AI parsing failed'
              }
            };
          }
          
          // Save to cache for future use
          await this.saveRecommendationsToCache(collegeId, aiRecommendations);
          
        } catch (error) {
          console.error('EnhancedAnalyticsService: OpenAI API call failed:', error.message);
          aiRecommendations = {
            success: false,
            message: 'OpenAI API call failed: ' + error.message,
            recommendations: {
              summary: 'Basic recommendations based on performance data',
              sections: {
                kpiSuggestions: `1. Increase student placement rate to 50% by end of academic year
2. Improve activity participation to 25% within 6 months
3. Achieve 60% assessment completion rate
4. Reduce student dropout rate by 10%
5. Increase employer satisfaction score to 4.5/5`
              },
              rawResponse: 'Fallback recommendations - OpenAI API unavailable'
            }
          };
        }
      }
      
      console.log('EnhancedAnalyticsService: AI recommendations generated:', aiRecommendations ? 'Yes' : 'No');

      return {
        success: true,
        collegeData,
        performanceData,
        peerComparison: peerData,
        aiRecommendations,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Enhanced analytics error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper function to extract all sections from AI response at once
  extractAllSections(text) {
    console.log('\n=== Extracting all sections from AI response ===');
    
    const sections = {
      immediateActions: '',
      trainingDevelopment: '',
      strategicPlanning: '',
      bestPractices: '',
      resourceAllocation: '',
      kpiSuggestions: ''
    };
    
    const lines = text.split('\n');
    let currentSection = null;
    let currentContent = [];
    
    console.log(`📝 Processing ${lines.length} lines of AI response`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is a section header
      if (this.isSectionHeader(line)) {
        // Save previous section content
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
          console.log(`✅ Saved section "${currentSection}" with ${currentContent.length} lines`);
        }
        
        // Start new section
        currentSection = this.getSectionName(line);
        currentContent = [];
        console.log(`📍 Starting new section: "${currentSection}" at line ${i + 1}: "${line}"`);
      } else if (currentSection && line.length > 0) {
        // Add content to current section
        currentContent.push(line);
      }
    }
    
    // Save the last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
      console.log(`✅ Saved final section "${currentSection}" with ${currentContent.length} lines`);
    }
    
    // Log what sections were found
    console.log('📊 Sections found:');
    Object.entries(sections).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        console.log(`  ✅ ${key}: ${value.length} characters`);
      } else {
        console.log(`  ❌ ${key}: empty`);
      }
    });
    
    return sections;
  }
  
  // Helper function to check if a line is a section header
  isSectionHeader(line) {
    const sectionPatterns = [
      /^###\s*\d+\.\s*[A-Z\s&]+/, // "### 1. IMMEDIATE ACTIONS"
      /^###\s*[A-Z\s&]+/, // "### IMMEDIATE ACTIONS"
      /^\d+\.\s*[A-Z\s&]+/, // "1. IMMEDIATE ACTIONS"
      /^[A-Z\s&]+:\s*$/, // "IMMEDIATE ACTIONS:"
      /^\*\*[A-Z\s&]+\*\*/, // "**IMMEDIATE ACTIONS**"
      /^[A-Z\s&]{3,}$/ // "IMMEDIATE ACTIONS"
    ];
    
    return sectionPatterns.some(pattern => pattern.test(line));
  }
  
  // Helper function to get section name from header line
  getSectionName(line) {
    // Remove markdown formatting and numbering
    const cleanLine = line.replace(/^###\s*/, '').replace(/^\d+\.\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
    const lineUpper = cleanLine.toUpperCase();
    
    if (lineUpper.includes('IMMEDIATE ACTIONS')) return 'immediateActions';
    if (lineUpper.includes('TRAINING') && lineUpper.includes('DEVELOPMENT')) return 'trainingDevelopment';
    if (lineUpper.includes('STRATEGIC') && lineUpper.includes('PLANNING')) return 'strategicPlanning';
    if (lineUpper.includes('BEST PRACTICES')) return 'bestPractices';
    if (lineUpper.includes('RESOURCE') && lineUpper.includes('ALLOCATION')) return 'resourceAllocation';
    if (lineUpper.includes('KPI') && lineUpper.includes('SUGGESTIONS')) return 'kpiSuggestions';
    
    return null;
  }

  /**
   * Load college data
   */
  async loadCollegeData(collegeId) {
    try {
      const collegesPath = path.join(this.dataDir, 'colleges.json');
      const data = await fs.readFile(collegesPath, 'utf8');
      const colleges = JSON.parse(data);
      
      return colleges.find(college => college.id == collegeId);
    } catch (error) {
      console.error('Error loading college data:', error);
      return null;
    }
  }

  /**
   * Load performance data from reports
   */
  async loadPerformanceData(collegeId) {
    try {
      const reportsPath = path.join(this.reportsDir, `${collegeId}.json`);
      const data = await fs.readFile(reportsPath, 'utf8');
      const reports = JSON.parse(data);
      
      if (reports.length === 0) {
        return null;
      }

      // Get latest report
      const latestReport = reports[0];
      
      // Calculate performance metrics
      const performanceData = this.calculatePerformanceMetrics(latestReport);
      
      // Add trend analysis if multiple reports exist
      if (reports.length > 1) {
        const previousReport = reports[1];
        const previousMetrics = this.calculatePerformanceMetrics(previousReport);
        performanceData.trends = this.calculateTrends(performanceData, previousMetrics);
      }

      return performanceData;
    } catch (error) {
      console.error('Error loading performance data:', error);
      return null;
    }
  }

  /**
   * Calculate performance metrics from report data
   */
  calculatePerformanceMetrics(report) {
    if (!report.data || !report.data.rows) {
      return null;
    }

    const { headers, rows } = report.data;
    
    // Calculate totals
    let totalStudents = 0;
    let studentsWithPlacements = 0;
    let studentsWithActivities = 0;
    let studentsWithoutAssessments = 0;

    rows.forEach(row => {
      if (!row[0] || row[0].toLowerCase().includes('total')) return;

      // Find column indices
      const totalStudentsIndex = headers.findIndex(h => 
        h.toLowerCase().includes('total') && h.toLowerCase().includes('student')
      );
      const placementsIndex = headers.findIndex(h => 
        h.toLowerCase().includes('placement') && !h.toLowerCase().includes('no')
      );
      const activitiesIndex = headers.findIndex(h => 
        h.toLowerCase().includes('activity') && !h.toLowerCase().includes('no')
      );
      const assessmentsIndex = headers.findIndex(h => 
        h.toLowerCase().includes('assessment') && h.toLowerCase().includes('no')
      );

      if (totalStudentsIndex >= 0 && row[totalStudentsIndex]) {
        totalStudents += parseInt(row[totalStudentsIndex]) || 0;
      }
      if (placementsIndex >= 0 && row[placementsIndex]) {
        studentsWithPlacements += parseInt(row[placementsIndex]) || 0;
      }
      if (activitiesIndex >= 0 && row[activitiesIndex]) {
        studentsWithActivities += parseInt(row[activitiesIndex]) || 0;
      }
      if (assessmentsIndex >= 0 && row[assessmentsIndex]) {
        studentsWithoutAssessments += parseInt(row[assessmentsIndex]) || 0;
      }
    });

    return {
      totalStudents,
      studentsWithPlacements,
      studentsWithActivities,
      studentsWithoutAssessments,
      percentWithPlacements: totalStudents > 0 ? (studentsWithPlacements / totalStudents) * 100 : 0,
      percentStudentsWithActivities: totalStudents > 0 ? (studentsWithActivities / totalStudents) * 100 : 0,
      assessmentCompletionRate: totalStudents > 0 ? ((totalStudents - studentsWithoutAssessments) / totalStudents) * 100 : 0
    };
  }

  /**
   * Calculate trends between current and previous data
   */
  calculateTrends(current, previous) {
    if (!previous) return null;

    return {
      placementRateChange: current.percentWithPlacements - previous.percentWithPlacements,
      activityRateChange: current.percentStudentsWithActivities - previous.percentStudentsWithActivities,
      assessmentRateChange: current.assessmentCompletionRate - previous.assessmentCompletionRate
    };
  }

  /**
   * Generate peer comparison data
   */
  async generatePeerComparison(collegeData, performanceData) {
    try {
      console.log('EnhancedAnalyticsService: Starting peer comparison generation...');
      
      // Load all colleges for comparison
      const collegesPath = path.join(this.dataDir, 'colleges.json');
      const collegesData = await fs.readFile(collegesPath, 'utf8');
      const allColleges = JSON.parse(collegesData);
      
      console.log('EnhancedAnalyticsService: Loaded', allColleges.length, 'colleges for comparison');
      
      // Find similar colleges (similar student population)
      const currentStudentCount = performanceData.totalStudents;
      const similarColleges = allColleges.filter(college => {
        if (college.id == collegeData.id) return false; // Exclude current college
        
        // Load performance data for comparison
        try {
          const collegeReportsPath = path.join(this.reportsDir, `${college.id}.json`);
          const collegeData = fs.readFileSync(collegeReportsPath, 'utf8');
          const collegeReports = JSON.parse(collegeData);
          
          if (collegeReports.length === 0) return false;
          
          const collegePerformance = this.calculatePerformanceMetrics(collegeReports[0]);
          if (!collegePerformance) return false;
          
          // Consider colleges with similar student population (±50%)
          const studentDiff = Math.abs(collegePerformance.totalStudents - currentStudentCount);
          const studentRatio = studentDiff / currentStudentCount;
          
          return studentRatio <= 0.5;
        } catch (error) {
          return false;
        }
      });
      
      console.log('EnhancedAnalyticsService: Current college student count:', currentStudentCount);
      console.log('EnhancedAnalyticsService: Found', similarColleges.length, 'similar colleges');
      
      // Calculate peer averages
      let totalPlacementRate = 0;
      let totalActivityRate = 0;
      let totalAssessmentRate = 0;
      let collegesWithData = 0;
      
      similarColleges.forEach(college => {
        try {
          const collegeReportsPath = path.join(this.reportsDir, `${college.id}.json`);
          const collegeData = fs.readFileSync(collegeReportsPath, 'utf8');
          const collegeReports = JSON.parse(collegeData);
          
          if (collegeReports.length > 0) {
            const collegePerformance = this.calculatePerformanceMetrics(collegeReports[0]);
            if (collegePerformance) {
              totalPlacementRate += collegePerformance.percentWithPlacements;
              totalActivityRate += collegePerformance.percentStudentsWithActivities;
              totalAssessmentRate += collegePerformance.assessmentCompletionRate;
              collegesWithData++;
            }
          }
        } catch (error) {
          // Skip colleges with no data
        }
      });
      
      console.log('EnhancedAnalyticsService: Found', collegesWithData, 'colleges with real performance data');
      
      const averagePlacementRate = collegesWithData > 0 ? totalPlacementRate / collegesWithData : 0;
      const averageActivityRate = collegesWithData > 0 ? totalActivityRate / collegesWithData : 0;
      const averageAssessmentRate = collegesWithData > 0 ? totalAssessmentRate / collegesWithData : 0;
      
      console.log('EnhancedAnalyticsService: Peer comparison generated successfully');
      
      return {
        similarCollegesCount: similarColleges.length,
        averagePlacementRate,
        averageActivityRate,
        averageAssessmentRate,
        performanceGap: {
          placement: performanceData.percentWithPlacements - averagePlacementRate,
          activity: performanceData.percentStudentsWithActivities - averageActivityRate,
          assessment: performanceData.assessmentCompletionRate - averageAssessmentRate
        },
        performanceQuartile: 1, // Placeholder
        ranking: 1, // Placeholder
        totalColleges: allColleges.length
      };
    } catch (error) {
      console.error('Error generating peer comparison:', error);
      return {
        similarCollegesCount: 0,
        averagePlacementRate: 0,
        averageActivityRate: 0,
        averageAssessmentRate: 0,
        performanceGap: {
          placement: 0,
          activity: 0,
          assessment: 0
        },
        performanceQuartile: 1,
        ranking: 1,
        totalColleges: 1
      };
    }
  }
}

module.exports = EnhancedAnalyticsService; 