const fs = require('fs').promises;
const path = require('path');
const AIAnalyzer = require('./AIAnalyzer');

class EnhancedAnalyticsService {
  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
    this.dataDir = path.join(__dirname, '../../data');
    this.reportsDir = path.join(__dirname, '../../data/reports');
  }

  /**
   * Generate comprehensive analytics with peer benchmarking
   */
  async generateEnhancedAnalytics(collegeId) {
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
      
      // Generate AI-powered recommendations using direct API call
      let aiRecommendations;
      try {
        console.log('EnhancedAnalyticsService: Attempting direct OpenAI API call...');
        
        // Use direct HTTPS request instead of AIAnalyzer to avoid fetch issues
        const https = require('https');
        
        const prompt = `You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation.

COLLEGE CONTEXT:
- Name: ${collegeData.name || 'Unknown College'}
- Student Population: ${performanceData.totalStudents || 0} students
- Placement Rate: ${performanceData.percentWithPlacements || 0}%
- Activity Participation: ${performanceData.percentStudentsWithActivities || 0}%
- Careers Assessments: ${performanceData.percentCareersAssessments || 0}%
- Assessment Completion: ${performanceData.assessmentCompletionRate || 0}%

AVAILABLE DATA SECTIONS:
${performanceData.availableSections ? Object.entries(performanceData.availableSections)
  .filter(([key, value]) => value)
  .map(([key, value]) => `- ${key.charAt(0).toUpperCase() + key.slice(1)}: Available`)
  .join('\n') : '- Basic performance data available'}

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
        
        // Parse the structured response using the same logic as app.js
        console.log('=== AI RESPONSE ANALYSIS ===');
        console.log('AI Response length:', response.length);
        console.log('AI Response first 800 chars:', response.substring(0, 800));
        console.log('AI Response last 200 chars:', response.substring(response.length - 200));
        console.log('Lines in response:', response.split('\n').length);
        
        // Show all lines that contain section names
        const sectionNames = ['IMMEDIATE ACTIONS', 'TRAINING', 'STRATEGIC', 'BEST PRACTICES', 'RESOURCE', 'KPI'];
        console.log('Lines containing section keywords:');
        response.split('\n').forEach((line, i) => {
          if (sectionNames.some(section => line.toUpperCase().includes(section))) {
            console.log(`Line ${i + 1}: "${line}"`);
          }
        });
        
        // Use a more robust section extraction method
        const sections = this.extractAllSections(response);
        
        console.log('Extracted sections:', sections);
        
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

  /**
   * Load college data
   */
  async loadCollegeData(collegeId) {
    try {
      const collegesPath = path.join(this.dataDir, 'colleges.json');
      const data = await fs.readFile(collegesPath, 'utf8');
      const colleges = JSON.parse(data);
      
      // Convert collegeId to number for proper comparison
      const numericCollegeId = parseInt(collegeId, 10);
      
      return colleges.find(college => college.id === numericCollegeId);
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
      // Always try to load from reports first (most up-to-date data)
      const reportsPath = path.join(this.reportsDir, `${collegeId}.json`);
      try {
      const data = await fs.readFile(reportsPath, 'utf8');
      const reports = JSON.parse(data);
      
        if (reports.length > 0) {
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

          console.log(`EnhancedAnalyticsService: Loaded performance data from reports for college ${collegeId}`);
      return performanceData;
        }
      } catch (reportsError) {
        console.log(`EnhancedAnalyticsService: No reports data found for college ${collegeId}, trying analytics...`);
      }

      // Fallback to analytics data if reports not available
      const analyticsPath = path.join(this.dataDir, 'analytics', `${collegeId}.json`);
      try {
        const analyticsData = await fs.readFile(analyticsPath, 'utf8');
        const analytics = JSON.parse(analyticsData);
        
        // Convert analytics data to performance data format
        const performanceData = this.convertAnalyticsToPerformanceData(analytics);
        if (performanceData) {
          console.log(`EnhancedAnalyticsService: Loaded performance data from analytics for college ${collegeId}`);
          return performanceData;
        }
      } catch (analyticsError) {
        console.log(`EnhancedAnalyticsService: No analytics data found for college ${collegeId}`);
      }

      return null;
    } catch (error) {
      console.error('Error loading performance data:', error);
      return null;
    }
  }

  /**
   * Convert analytics data to performance data format
   */
  convertAnalyticsToPerformanceData(analytics) {
    try {
      if (!analytics || !analytics.timeSeries) {
        return null;
      }

      // Get the latest data from time series
      const latestPlacements = analytics.timeSeries.placements[analytics.timeSeries.placements.length - 1];
      const latestActivities = analytics.timeSeries.activities[analytics.timeSeries.activities.length - 1];
      const latestAssessments = analytics.timeSeries.assessments[analytics.timeSeries.assessments.length - 1];

      if (!latestPlacements) {
        return null;
      }

      // Extract values from analytics data
      const studentsWithPlacements = latestPlacements.value;
      const studentsWithActivities = latestActivities ? latestActivities.value : 0;
      const studentsWithAssessments = latestAssessments ? latestAssessments.completed : 0;
      const totalAssessments = latestAssessments ? latestAssessments.total : 0;

      // For analytics data, we need to determine the total student population
      // The placement value represents students with placements, not total students
      // We'll use the assessment total as a proxy for total students if available
      const totalStudents = totalAssessments > 0 ? totalAssessments : studentsWithPlacements;

      // Check if assessment data is meaningful (not just placeholder data)
      const hasMeaningfulAssessmentData = analytics.timeSeries.assessments.length > 0 && 
        latestAssessments && 
        latestAssessments.pending > 0; // If there are pending assessments, it's real data

      // Calculate percentages
      const percentWithPlacements = totalStudents > 0 ? (studentsWithPlacements / totalStudents) * 100 : 0;
      const percentStudentsWithActivities = totalStudents > 0 ? (studentsWithActivities / totalStudents) * 100 : 0;
      
      // For assessments, use the total assessments as the denominator if available
      // If no meaningful assessment data, set to null
      const assessmentCompletionRate = hasMeaningfulAssessmentData && totalAssessments > 0 ? 
                                      (studentsWithAssessments / totalAssessments) * 100 : 
                                      (hasMeaningfulAssessmentData && totalStudents > 0 ? 
                                       (studentsWithAssessments / totalStudents) * 100 : null);

      // Determine available sections based on data presence
      const availableSections = {
        placements: analytics.timeSeries.placements.length > 0,
        activities: analytics.timeSeries.activities.length > 0,
        assessments: hasMeaningfulAssessmentData,
        careers: analytics.timeSeries.careers && analytics.timeSeries.careers.length > 0
      };

      // Standardize activities structure for analytics data
      const studentsWithActivitiesEnrichment = Math.round(studentsWithActivities / 2);
      const studentsWithActivitiesEmployer = studentsWithActivities - studentsWithActivitiesEnrichment;

      return {
        totalStudents,
        studentsWithPlacements,
        studentsWithActivities,
        studentsWithActivitiesEnrichment,
        studentsWithActivitiesEmployer,
        studentsWithoutAssessments: totalStudents - studentsWithAssessments,
        percentWithPlacements,
        percentStudentsWithActivities,
        percentStudentsWithActivitiesEnrichment: totalStudents > 0 ? (studentsWithActivitiesEnrichment / totalStudents) * 100 : 0,
        percentStudentsWithActivitiesEmployer: totalStudents > 0 ? (studentsWithActivitiesEmployer / totalStudents) * 100 : 0,
        assessmentCompletionRate,
        availableSections
      };
    } catch (error) {
      console.error('EnhancedAnalyticsService: Error converting analytics to performance data:', error);
      return null;
    }
  }

  /**
   * Recalculate totals and percentages for a report after editing
   */
  recalculateReportTotals(report) {
    if (!report.data || !report.data.rows || !report.data.headers) {
      return null;
    }

    const { headers, rows } = report.data;
    
    // Filter out non-data rows (headers, totals, etc.)
    const dataRows = rows.filter(row => 
      row[0] && 
      !row[0].toLowerCase().includes('total') && 
      !row[0].toLowerCase().includes('summary') && 
      !row[0].toLowerCase().includes('overall') &&
      !row[0].toLowerCase().includes('department') &&
      row[0].trim() !== ''
    );

    if (dataRows.length === 0) {
      console.log('EnhancedAnalyticsService: No data rows found for recalculation');
      return report;
    }

    console.log(`EnhancedAnalyticsService: Recalculating totals for ${dataRows.length} data rows`);

    // Find column indices for recalculation
    const findColumnIndex = (patterns, excludePatterns = []) => {
      return headers.findIndex((header, index) => {
        const headerLower = header.toLowerCase();
        const matchesAllPatterns = patterns.every(pattern => 
          headerLower.includes(pattern.toLowerCase())
        );
        const matchesNoExcludePatterns = excludePatterns.length === 0 || 
          !excludePatterns.some(excludePattern => 
            headerLower.includes(excludePattern.toLowerCase())
          );
        return matchesAllPatterns && matchesNoExcludePatterns;
      });
    };

    const safeParseFloat = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Find all columns that need recalculation (numeric, percentages, totals, etc.)
    const columnsToRecalculate = [];
    headers.forEach((header, index) => {
      if (index === 0) return; // Skip department column
      
      const headerLower = header.toLowerCase();
      
      // Include all numeric columns, percentages, totals, and calculated fields
      // Exclude only text-based columns like department names, confirmed status, etc.
      if (!headerLower.includes('department') && 
          !headerLower.includes('confirmed') &&
          !headerLower.includes('scheduled') &&
          !headerLower.includes('score') &&
          !headerLower.includes('average') &&
          header.trim() !== '') {
        columnsToRecalculate.push(index);
      }
    });

    console.log(`EnhancedAnalyticsService: Recalculating ${columnsToRecalculate.length} columns:`, 
      columnsToRecalculate.map(i => headers[i]));

    // Calculate totals for all numeric columns first
    const totals = {};
    columnsToRecalculate.forEach(colIndex => {
      const columnName = headers[colIndex];
      const total = dataRows.reduce((sum, row) => {
        return sum + safeParseFloat(row[colIndex]);
      }, 0);
      totals[colIndex] = total;
    });

    // Now handle percentage columns and other calculated fields
    columnsToRecalculate.forEach(colIndex => {
      const columnName = headers[colIndex];
      const headerLower = columnName.toLowerCase();
      
      // Handle percentage columns
      if (headerLower.includes('%')) {
        // Find the base column for this percentage
        const baseColumnName = columnName.replace('% ', '').replace(' %', '').replace('%', '').trim();
        
        // Try to find the corresponding base column
        const correspondingBaseIndex = headers.findIndex(h => {
          const hLower = h.toLowerCase();
          return hLower.includes(baseColumnName.toLowerCase()) && !hLower.includes('%');
        });
        
        // Also try to find a total students column as fallback
        const totalStudentsIndex = headers.findIndex(h => 
          h.toLowerCase().includes('total') && h.toLowerCase().includes('student')
        );
        
        if (correspondingBaseIndex >= 0 && totals[correspondingBaseIndex] > 0) {
          // Calculate percentage based on corresponding base column
          const totalStudents = totals[totalStudentsIndex] || totals[correspondingBaseIndex];
          const percentage = (totals[correspondingBaseIndex] / totalStudents) * 100;
          totals[colIndex] = percentage;
          console.log(`EnhancedAnalyticsService: Calculated ${columnName}: ${percentage.toFixed(2)}%`);
        } else if (totalStudentsIndex >= 0 && totals[totalStudentsIndex] > 0) {
          // Fallback: calculate percentage based on total students
          const totalStudents = totals[totalStudentsIndex];
          const percentage = (totals[colIndex] / totalStudents) * 100;
          totals[colIndex] = percentage;
          console.log(`EnhancedAnalyticsService: Calculated ${columnName} (fallback): ${percentage.toFixed(2)}%`);
        }
      }
      
      // Handle other calculated fields (ratios, averages, etc.)
      else if (headerLower.includes('ratio') || headerLower.includes('rate')) {
        // These are typically calculated fields, recalculate based on base columns
        const baseColumnName = columnName.replace('ratio', '').replace('rate', '').trim();
        const correspondingBaseIndex = headers.findIndex(h => 
          h.toLowerCase().includes(baseColumnName.toLowerCase())
        );
        
        if (correspondingBaseIndex >= 0 && totals[correspondingBaseIndex] > 0) {
          const totalStudents = totals[0] || totals[correspondingBaseIndex]; // Use first column as total if available
          const ratio = (totals[correspondingBaseIndex] / totalStudents);
          totals[colIndex] = ratio;
          console.log(`EnhancedAnalyticsService: Calculated ${columnName}: ${ratio.toFixed(4)}`);
        }
      }
    });

    // Create new total row
    const newTotalRow = new Array(headers.length).fill('');
    newTotalRow[0] = 'Total'; // Department column
    
    // Fill in calculated totals
    Object.keys(totals).forEach(colIndex => {
      newTotalRow[parseInt(colIndex)] = totals[colIndex];
    });

    // Remove old total rows and add new one
    const filteredRows = rows.filter(row => 
      row[0] && 
      !row[0].toLowerCase().includes('total') && 
      !row[0].toLowerCase().includes('summary') && 
      !row[0].toLowerCase().includes('overall')
    );

    const updatedReport = {
      ...report,
      data: {
        ...report.data,
        rows: [...filteredRows, newTotalRow]
      }
    };

    console.log('EnhancedAnalyticsService: Report totals recalculated successfully');
    return updatedReport;
  }

  /**
   * Save recalculated report back to file system
   */
  async saveRecalculatedReport(collegeId, recalculatedReport) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Determine if this is a report or analytics file
      const reportPath = path.join(__dirname, '..', 'data', 'reports', `${collegeId}.json`);
      const analyticsPath = path.join(__dirname, '..', 'data', 'analytics', `${collegeId}.json`);
      
      let targetPath;
      try {
        await fs.access(reportPath);
        targetPath = reportPath;
        console.log('EnhancedAnalyticsService: Found existing report file');
      } catch {
        try {
          await fs.access(analyticsPath);
          targetPath = analyticsPath;
          console.log('EnhancedAnalyticsService: Found existing analytics file');
        } catch {
          // If no existing file, default to reports directory
          targetPath = reportPath;
          console.log('EnhancedAnalyticsService: No existing file found, will create new report file');
        }
      }
      
      // Save the recalculated report
      await fs.writeFile(targetPath, JSON.stringify([recalculatedReport], null, 2));
      console.log(`EnhancedAnalyticsService: Recalculated report saved to ${targetPath}`);
      return true;
      
    } catch (error) {
      console.error('EnhancedAnalyticsService: Error saving recalculated report:', error);
      return false;
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
    
    // Find the Total row - handle different naming patterns
    const findTotalRow = (rows) => {
      // Try different patterns for total rows
      const totalPatterns = ['total', 'summary', 'overall', 'grand total'];
      
      for (const pattern of totalPatterns) {
        const totalRow = rows.find(row => 
          row[0] && row[0].toLowerCase().includes(pattern)
        );
        if (totalRow) {
          return totalRow;
        }
      }
      
      // If no total row found, try the last non-empty row
      const lastNonEmptyRow = rows.filter(row => 
        row[0] && row[0].trim() !== '' && 
        !row[0].toLowerCase().includes('department') &&
        !row[0].toLowerCase().includes('header')
      ).pop();
      
      if (lastNonEmptyRow) {
        console.log('EnhancedAnalyticsService: Using last non-empty row as total row');
        return lastNonEmptyRow;
      }
      
      return null;
    };

    const totalRow = findTotalRow(rows);
    
    if (!totalRow) {
      console.log('EnhancedAnalyticsService: No total row found in report');
      return null;
    }

    // Helper function to aggregate data from individual rows if total row is missing
    const aggregateFromRows = (rows, columnIndex) => {
      if (columnIndex === -1) return 0;
      
      return rows.reduce((sum, row) => {
        if (row[0] && !row[0].toLowerCase().includes('total') && 
            !row[0].toLowerCase().includes('summary') && 
            !row[0].toLowerCase().includes('department')) {
          return sum + safeParseFloat(row[columnIndex]);
        }
        return sum;
      }, 0);
    };

    // Helper function to safely parse numeric values
    const safeParseFloat = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Dynamic column detection - handle any report structure
    const findColumnIndex = (patterns, excludePatterns = []) => {
      return headers.findIndex((header, index) => {
        const headerLower = header.toLowerCase();
        
        // Check if header matches all required patterns
        const matchesAllPatterns = patterns.every(pattern => 
          headerLower.includes(pattern.toLowerCase())
        );
        
        // Check if header doesn't match any exclude patterns
        const matchesNoExcludePatterns = excludePatterns.length === 0 || 
          !excludePatterns.some(excludePattern => 
            headerLower.includes(excludePattern.toLowerCase())
          );
        
        return matchesAllPatterns && matchesNoExcludePatterns;
      });
    };

    // Find column indices using flexible pattern matching
    const totalStudentsIndex = findColumnIndex(['total', 'student'], ['activity', 'placement', 'assessment']);
    const studentsWithPlacementsIndex = findColumnIndex(['students with placements']);
    const studentsWithActivitiesEnrichmentIndex = findColumnIndex(['students with activities', 'enrichment']);
    const studentsWithActivitiesEmployerIndex = findColumnIndex(['students with activities', 'employer']);
    const studentsWithActivitiesIndex = findColumnIndex(['students with activities'], ['enrichment', 'employer']);
    const studentsWithoutAssessmentsIndex = findColumnIndex(['students without assessments']);
    
    // Find careers-related columns with comprehensive patterns
    const careersIndex = findColumnIndex(['career']) || 
                        findColumnIndex(['job profile']) ||
                        findColumnIndex(['quiz']) ||
                        findColumnIndex(['mapped job profile']) ||
                        findColumnIndex(['total mapped job profiles']) ||
                        findColumnIndex(['mapped'], ['placement']);
    
    // Find percentage columns for activities
    const percentActivitiesEnrichmentIndex = findColumnIndex(['%', 'students with activities', 'enrichment']);
    const percentActivitiesEmployerIndex = findColumnIndex(['%', 'students with activities', 'employer']);

    // Fallback patterns for different naming conventions
    if (totalStudentsIndex === -1) {
      console.log('EnhancedAnalyticsService: Trying fallback patterns for total students');
      const fallbackTotalIndex = findColumnIndex(['total'], ['activity', 'placement', 'assessment']) || 
                                findColumnIndex(['student'], ['activity', 'placement', 'assessment']);
      if (fallbackTotalIndex !== -1) {
        console.log('EnhancedAnalyticsService: Found fallback total students column');
      }
    }

    if (studentsWithPlacementsIndex === -1) {
      console.log('EnhancedAnalyticsService: Trying fallback patterns for placements');
      const fallbackPlacementIndex = findColumnIndex(['placement']) || 
                                    findColumnIndex(['placements']);
      if (fallbackPlacementIndex !== -1) {
        console.log('EnhancedAnalyticsService: Found fallback placements column');
      }
    }

    // Log column detection results for debugging
    const columnDetection = {
      totalStudents: { index: totalStudentsIndex, found: totalStudentsIndex >= 0 },
      studentsWithPlacements: { index: studentsWithPlacementsIndex, found: studentsWithPlacementsIndex >= 0 },
      studentsWithActivitiesEnrichment: { index: studentsWithActivitiesEnrichmentIndex, found: studentsWithActivitiesEnrichmentIndex >= 0 },
      studentsWithActivitiesEmployer: { index: studentsWithActivitiesEmployerIndex, found: studentsWithActivitiesEmployerIndex >= 0 },
      studentsWithActivitiesGeneral: { index: studentsWithActivitiesIndex, found: studentsWithActivitiesIndex >= 0 },
      studentsWithoutAssessments: { index: studentsWithoutAssessmentsIndex, found: studentsWithoutAssessmentsIndex >= 0 },
      careers: { index: careersIndex, found: careersIndex >= 0 }
    };

    console.log('EnhancedAnalyticsService: Column detection results:', columnDetection);

    // Extract values from Total row with fallbacks
    const totalStudents = totalStudentsIndex >= 0 ? safeParseFloat(totalRow[totalStudentsIndex]) : 0;
    const studentsWithPlacements = studentsWithPlacementsIndex >= 0 ? safeParseFloat(totalRow[studentsWithPlacementsIndex]) : 0;
    const studentsWithActivitiesEnrichment = studentsWithActivitiesEnrichmentIndex >= 0 ? safeParseFloat(totalRow[studentsWithActivitiesEnrichmentIndex]) : 0;
    const studentsWithActivitiesEmployer = studentsWithActivitiesEmployerIndex >= 0 ? safeParseFloat(totalRow[studentsWithActivitiesEmployerIndex]) : 0;
    const studentsWithActivitiesGeneral = studentsWithActivitiesIndex >= 0 ? safeParseFloat(totalRow[studentsWithActivitiesIndex]) : 0;
    const studentsWithoutAssessments = studentsWithoutAssessmentsIndex >= 0 ? safeParseFloat(totalRow[studentsWithoutAssessmentsIndex]) : 0;
    const careersAssessments = careersIndex >= 0 ? safeParseFloat(totalRow[careersIndex]) : 0;
    
    // Extract percentage values from Total row
    const percentActivitiesEnrichment = percentActivitiesEnrichmentIndex >= 0 ? safeParseFloat(totalRow[percentActivitiesEnrichmentIndex]) : 0;
    const percentActivitiesEmployer = percentActivitiesEmployerIndex >= 0 ? safeParseFloat(totalRow[percentActivitiesEmployerIndex]) : 0;
    
    // Standardize activities structure using actual percentages from report
    let finalStudentsWithActivitiesEnrichment = studentsWithActivitiesEnrichment;
    let finalStudentsWithActivitiesEmployer = studentsWithActivitiesEmployer;
    
    if (studentsWithActivitiesEnrichment === 0 && studentsWithActivitiesEmployer === 0 && studentsWithActivitiesGeneral > 0) {
      // If we only have general activities, use percentages from the report if available
      if (percentActivitiesEnrichment > 0 || percentActivitiesEmployer > 0) {
        // Use actual percentages from the report
        finalStudentsWithActivitiesEnrichment = Math.round((percentActivitiesEnrichment / 100) * totalStudents);
        finalStudentsWithActivitiesEmployer = Math.round((percentActivitiesEmployer / 100) * totalStudents);
      } else {
        // Fallback to 50/50 split if no percentages available
        finalStudentsWithActivitiesEnrichment = Math.round(studentsWithActivitiesGeneral / 2);
        finalStudentsWithActivitiesEmployer = studentsWithActivitiesGeneral - finalStudentsWithActivitiesEnrichment;
      }
    } else if (studentsWithActivitiesEnrichment === 0 && studentsWithActivitiesEmployer === 0) {
      // If no activities data at all, both are 0
      finalStudentsWithActivitiesEnrichment = 0;
      finalStudentsWithActivitiesEmployer = 0;
    }
    
    // Calculate total activities (enrichment + employer)
    const studentsWithActivities = finalStudentsWithActivitiesEnrichment + finalStudentsWithActivitiesEmployer;

    // Validate data consistency
    if (totalStudents > 0 && studentsWithPlacements > totalStudents) {
      console.log('EnhancedAnalyticsService: Warning - students with placements exceeds total students, adjusting...');
      // This might happen if the data is in percentages or if there's a data issue
      // For now, we'll cap it at total students
      studentsWithPlacements = Math.min(studentsWithPlacements, totalStudents);
    }

    // Check what data sections are available in the report
    const availableSections = {
      placements: headers.some(h => h.toLowerCase().includes('placement')),
      activities: headers.some(h => h.toLowerCase().includes('activity')),
      assessments: headers.some(h => h.toLowerCase().includes('student') && h.toLowerCase().includes('assessment')),
      careers: careersIndex >= 0 || headers.some(h => {
        const headerLower = h.toLowerCase();
        return headerLower.includes('career') || 
               headerLower.includes('job profile') || 
               headerLower.includes('quiz') || 
               headerLower.includes('mapped job profile') ||
               headerLower.includes('total mapped job profiles') || 
               (headerLower.includes('mapped') && !headerLower.includes('placement'));
      })
    };

    return {
      totalStudents,
      studentsWithPlacements,
      studentsWithActivities,
      studentsWithActivitiesEnrichment: finalStudentsWithActivitiesEnrichment,
      studentsWithActivitiesEmployer: finalStudentsWithActivitiesEmployer,
      studentsWithoutAssessments,
      careersAssessments: careersAssessments,
      percentWithPlacements: availableSections.placements && totalStudents > 0 ? (studentsWithPlacements / totalStudents) * 100 : null,
      percentStudentsWithActivities: availableSections.activities && totalStudents > 0 ? (studentsWithActivities / totalStudents) * 100 : null,
      percentStudentsWithActivitiesEnrichment: availableSections.activities && totalStudents > 0 ? (finalStudentsWithActivitiesEnrichment / totalStudents) * 100 : null,
      percentStudentsWithActivitiesEmployer: availableSections.activities && totalStudents > 0 ? (finalStudentsWithActivitiesEmployer / totalStudents) * 100 : null,
      assessmentCompletionRate: availableSections.assessments && totalStudents > 0 ? ((totalStudents - studentsWithoutAssessments) / totalStudents) * 100 : null,
      percentCareersAssessments: availableSections.careers && totalStudents > 0 ? (careersAssessments / totalStudents) * 100 : null,
      availableSections: availableSections
    };
  }

  /**
   * Calculate trends between current and previous data
   */
  calculateTrends(current, previous) {
    if (!previous) return {};

    return {
      placementRateChange: current.percentWithPlacements - previous.percentWithPlacements,
      activityParticipationChange: current.percentStudentsWithActivities - previous.percentStudentsWithActivities,
      assessmentCompletionChange: current.assessmentCompletionRate - previous.assessmentCompletionRate,
      studentCountChange: current.totalStudents - previous.totalStudents
    };
  }

  /**
   * Generate comprehensive peer comparison data from all colleges
   */
  async generatePeerComparison(collegeData, performanceData) {
    try {
      console.log('EnhancedAnalyticsService: Starting comprehensive peer comparison generation...');
      
      // Load all colleges for comparison
      const collegesPath = path.join(this.dataDir, 'colleges.json');
      let allColleges = [];
      
      try {
        const data = await fs.readFile(collegesPath, 'utf8');
        allColleges = JSON.parse(data);
        console.log('EnhancedAnalyticsService: Loaded', allColleges.length, 'colleges for comparison');
      } catch (error) {
        console.error('EnhancedAnalyticsService: Error loading colleges.json:', error);
        return this.generateFallbackPeerData(performanceData);
      }

      // Load performance data for ALL colleges (not just similar ones)
      const allPerformanceData = [];
      let totalPlacementRate = 0;
      let totalActivityRate = 0;
      let totalAssessmentRate = 0;
      let validColleges = 0;

      console.log('EnhancedAnalyticsService: Loading performance data for all colleges...');

      // Load performance data for each college
      for (const college of allColleges) {
        try {
        const collegePerformance = await this.loadPerformanceData(college.id);
          if (collegePerformance && collegePerformance.totalStudents > 0) {
            const collegeData = {
              collegeId: college.id,
              collegeName: college.name,
              studentCount: collegePerformance.totalStudents,
              placementRate: collegePerformance.percentWithPlacements || 0,
              activityRate: collegePerformance.percentStudentsWithActivities || 0,
              assessmentRate: collegePerformance.assessmentCompletionRate || 0,
              lastReportDate: college.lastReportDate
            };
            
            allPerformanceData.push(collegeData);
            
            // Add to totals for overall averages
            totalPlacementRate += collegeData.placementRate;
            totalActivityRate += collegeData.activityRate;
            totalAssessmentRate += collegeData.assessmentRate;
          validColleges++;
            
            console.log(`EnhancedAnalyticsService: Loaded data for ${college.name}:`, {
              students: collegeData.studentCount,
              placementRate: collegeData.placementRate.toFixed(1) + '%',
              activityRate: collegeData.activityRate.toFixed(1) + '%',
              assessmentRate: collegeData.assessmentRate.toFixed(1) + '%'
            });
          } else {
            console.log(`EnhancedAnalyticsService: No valid performance data for college ${college.name} (${college.id})`);
          }
        } catch (error) {
          console.log(`EnhancedAnalyticsService: Could not load performance data for college ${college.id}:`, error.message);
        }
      }
      
      console.log('EnhancedAnalyticsService: Successfully loaded performance data for', validColleges, 'colleges');

      // Calculate overall averages from all colleges
      const overallAveragePlacementRate = validColleges > 0 ? totalPlacementRate / validColleges : 0;
      const overallAverageActivityRate = validColleges > 0 ? totalActivityRate / validColleges : 0;
      const overallAverageAssessmentRate = validColleges > 0 ? totalAssessmentRate / validColleges : 0;

      // Find similar-sized colleges (±30% student count for broader comparison)
      const currentStudentCount = performanceData.totalStudents || 0;
      const similarColleges = allPerformanceData.filter(college => {
        if (college.collegeId === collegeData.id) return false; // Exclude current college
        const difference = Math.abs(college.studentCount - currentStudentCount);
        const percentageDifference = currentStudentCount > 0 ? (difference / currentStudentCount) * 100 : 100;
        return percentageDifference <= 30;
      });

      // Calculate similar college averages
      let similarPlacementRate = 0;
      let similarActivityRate = 0;
      let similarAssessmentRate = 0;
      let similarCollegesCount = 0;

      for (const college of similarColleges) {
        similarPlacementRate += college.placementRate;
        similarActivityRate += college.activityRate;
        similarAssessmentRate += college.assessmentRate;
        similarCollegesCount++;
      }

      const similarAveragePlacementRate = similarCollegesCount > 0 ? similarPlacementRate / similarCollegesCount : overallAveragePlacementRate;
      const similarAverageActivityRate = similarCollegesCount > 0 ? similarActivityRate / similarCollegesCount : overallAverageActivityRate;
      const similarAverageAssessmentRate = similarCollegesCount > 0 ? similarAssessmentRate / similarCollegesCount : overallAverageAssessmentRate;

      // Calculate performance rankings and quartiles
      const sortedByPlacement = [...allPerformanceData].sort((a, b) => b.placementRate - a.placementRate);
      const sortedByActivity = [...allPerformanceData].sort((a, b) => b.activityRate - a.activityRate);
      const sortedByAssessment = [...allPerformanceData].sort((a, b) => b.assessmentRate - a.assessmentRate);

      const currentCollegeIndex = sortedByPlacement.findIndex(c => c.collegeId === collegeData.id);
      const currentActivityIndex = sortedByActivity.findIndex(c => c.collegeId === collegeData.id);
      const currentAssessmentIndex = sortedByAssessment.findIndex(c => c.collegeId === collegeData.id);

      // Calculate quartiles
      const calculateQuartile = (index, total) => {
        if (index === -1 || total === 0) return 2;
        return Math.min(Math.ceil((index + 1) / Math.max(total / 4, 1)), 4);
      };

      const placementQuartile = calculateQuartile(currentCollegeIndex, allPerformanceData.length);
      const activityQuartile = calculateQuartile(currentActivityIndex, allPerformanceData.length);
      const assessmentQuartile = calculateQuartile(currentAssessmentIndex, allPerformanceData.length);

      // Find top performers (top 25%)
      const topPerformersCount = Math.max(1, Math.floor(allPerformanceData.length * 0.25));
      const topPerformers = sortedByPlacement.slice(0, topPerformersCount);
      const topPerformersAveragePlacement = topPerformers.reduce((sum, college) => sum + college.placementRate, 0) / topPerformers.length;

      const peerData = {
        // Overall statistics
        totalColleges: allPerformanceData.length,
        validColleges: validColleges,
        
        // Overall averages (all colleges)
        overallAverages: {
          placementRate: overallAveragePlacementRate,
          activityRate: overallAverageActivityRate,
          assessmentRate: overallAverageAssessmentRate
        },
        
        // Similar college statistics
        similarCollegesCount: similarCollegesCount,
        similarColleges: similarColleges.map(c => ({ name: c.collegeName, studentCount: c.studentCount })),
        similarAverages: {
          placementRate: similarAveragePlacementRate,
          activityRate: similarAverageActivityRate,
          assessmentRate: similarAverageAssessmentRate
        },
        
        // Performance gaps
        performanceGap: {
          placement: performanceData.availableSections.placements ? (performanceData.percentWithPlacements - overallAveragePlacementRate) : null,
          activity: performanceData.availableSections.activities ? (performanceData.percentStudentsWithActivities - overallAverageActivityRate) : null,
          assessment: performanceData.availableSections.assessments ? (performanceData.assessmentCompletionRate - overallAverageAssessmentRate) : null
        },
        
        // Rankings and quartiles
        rankings: {
          placement: currentCollegeIndex !== -1 ? currentCollegeIndex + 1 : null,
          activity: currentActivityIndex !== -1 ? currentActivityIndex + 1 : null,
          assessment: currentAssessmentIndex !== -1 ? currentAssessmentIndex + 1 : null
        },
        
        quartiles: {
          placement: placementQuartile,
          activity: activityQuartile,
          assessment: assessmentQuartile
        },
        
        // Top performers benchmark
        topPerformers: {
          count: topPerformersCount,
          averagePlacementRate: topPerformersAveragePlacement,
          gapToTop: performanceData.availableSections.placements ? (topPerformersAveragePlacement - performanceData.percentWithPlacements) : null
        },
        
        // Available sections
        availableSections: performanceData.availableSections,
        
        // Additional metrics
        benchmarks: {
          overallAverage: overallAveragePlacementRate,
          similarAverage: similarAveragePlacementRate,
          topPerformersAverage: topPerformersAveragePlacement,
          currentPerformance: performanceData.percentWithPlacements
        }
      };

      console.log('EnhancedAnalyticsService: Comprehensive peer comparison generated successfully');
      console.log('EnhancedAnalyticsService: Peer data summary:', {
        totalColleges: peerData.totalColleges,
        similarColleges: peerData.similarCollegesCount,
        overallAveragePlacement: peerData.overallAverages.placementRate.toFixed(1) + '%',
        currentPlacement: performanceData.percentWithPlacements.toFixed(1) + '%',
        placementGap: peerData.performanceGap.placement?.toFixed(1) + '%',
        placementRank: peerData.rankings.placement,
        placementQuartile: peerData.quartiles.placement
      });

      return peerData;
    } catch (error) {
      console.error('EnhancedAnalyticsService: Error generating peer comparison:', error);
      return this.generateFallbackPeerData(performanceData);
    }
  }

  /**
   * Generate fallback peer data when comprehensive comparison fails
   */
  generateFallbackPeerData(performanceData) {
    console.log('EnhancedAnalyticsService: Generating fallback peer data');
    
    return {
      totalColleges: 1,
      validColleges: 1,
      overallAverages: {
        placementRate: performanceData.percentWithPlacements || 0,
        activityRate: performanceData.percentStudentsWithActivities || 0,
        assessmentRate: performanceData.assessmentCompletionRate || 0
      },
      similarCollegesCount: 0,
      similarColleges: [],
      similarAverages: {
        placementRate: performanceData.percentWithPlacements || 0,
        activityRate: performanceData.percentStudentsWithActivities || 0,
        assessmentRate: performanceData.assessmentCompletionRate || 0
      },
      performanceGap: {
        placement: 0,
        activity: 0,
        assessment: 0
      },
      rankings: {
        placement: 1,
        activity: 1,
        assessment: 1
      },
      quartiles: {
        placement: 2,
        activity: 2,
        assessment: 2
      },
      topPerformers: {
        count: 1,
        averagePlacementRate: performanceData.percentWithPlacements || 0,
        gapToTop: 0
      },
      availableSections: performanceData.availableSections || {},
      benchmarks: {
        overallAverage: performanceData.percentWithPlacements || 0,
        similarAverage: performanceData.percentWithPlacements || 0,
        topPerformersAverage: performanceData.percentWithPlacements || 0,
        currentPerformance: performanceData.percentWithPlacements || 0
             }
     };
  }

  /**
   * Get gap analysis for improvement opportunities
   */
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
  
  // Helper function to extract sections from AI response (improved parsing)
  extractSection(text, sectionName) {
    console.log(`\n=== Extracting section: ${sectionName} ===`);
    
    // Split the text into lines and find the section
    const lines = text.split('\n');
    let sectionStartIndex = -1;
    let sectionEndIndex = lines.length;
    
    // Find the start of this section with multiple patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineUpper = line.toUpperCase();
      const sectionUpper = sectionName.toUpperCase();
      
      // Check multiple patterns for section headers
      const patterns = [
        // Pattern 1: "1. IMMEDIATE ACTIONS"
        new RegExp(`^\\d+\\.\\s*${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
        // Pattern 2: "IMMEDIATE ACTIONS:"
        new RegExp(`^${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?`, 'i'),
        // Pattern 3: "**IMMEDIATE ACTIONS**"
        new RegExp(`^\\*\\*${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*`, 'i'),
        // Pattern 4: Just contains the section name
        new RegExp(`^.*${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i')
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          console.log(`📍 Found section "${sectionName}" at line ${i + 1}: "${line}"`);
          sectionStartIndex = i;
          break;
        }
      }
      
      if (sectionStartIndex !== -1) break;
    }
    
    if (sectionStartIndex === -1) {
      console.log(`❌ Section "${sectionName}" not found`);
      return '';
    }
    
    // Find the end of this section (look for next section or end of text)
    for (let i = sectionStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for next section patterns
      const nextSectionPatterns = [
        // Next numbered section like "2.", "3.", etc.
        /^\d+\.\s*[A-Z]/,
        // Section with colons like "TRAINING & DEVELOPMENT:"
        /^[A-Z\s&]+:\s*$/,
        // Bold section headers like "**TRAINING & DEVELOPMENT**"
        /^\*\*[A-Z\s&]+\*\*$/,
        // Any line that looks like a section header
        /^[A-Z\s&]{3,}$/
      ];
      
      for (const pattern of nextSectionPatterns) {
        if (pattern.test(line)) {
          // Make sure it's not the same section we're currently extracting
          const lineUpper = line.toUpperCase();
          const currentSectionUpper = sectionName.toUpperCase();
          if (!lineUpper.includes(currentSectionUpper)) {
            console.log(`📍 Found next section at line ${i + 1}: "${line}"`);
            sectionEndIndex = i;
            break;
          }
        }
      }
      
      if (sectionEndIndex !== lines.length) break;
    }
    
    // Extract the content between start and end
    const sectionLines = lines.slice(sectionStartIndex + 1, sectionEndIndex);
    const content = sectionLines
      .filter(line => line.trim().length > 0) // Remove empty lines
      .join('\n')
      .trim();
    
    if (content.length > 0) {
      console.log(`✅ Extracted ${content.length} chars for "${sectionName}": "${content.substring(0, 100)}..."`);
      return content;
    } else {
      console.log(`❌ No content found for section "${sectionName}"`);
      return '';
    }
  }

  generateGapAnalysis(performanceData, peerData) {
    if (!peerData) return null;

    const gaps = {
      placementGap: peerData.performanceGap.placement,
      activityGap: peerData.performanceGap.activity,
      assessmentGap: peerData.performanceGap.assessment,
      opportunities: []
    };

    // Identify improvement opportunities
    if (gaps.placementGap < -10) {
      gaps.opportunities.push({
        area: 'Placement Rate',
        gap: Math.abs(gaps.placementGap).toFixed(1) + '%',
        priority: 'High',
        description: 'Significantly below peer average'
      });
    }

    if (gaps.activityGap < -15) {
      gaps.opportunities.push({
        area: 'Activity Participation',
        gap: Math.abs(gaps.activityGap).toFixed(1) + '%',
        priority: 'Medium',
        description: 'Below peer average'
      });
    }

    if (gaps.assessmentGap < -20) {
      gaps.opportunities.push({
        area: 'Assessment Completion',
        gap: Math.abs(gaps.assessmentGap).toFixed(1) + '%',
        priority: 'High',
        description: 'Significantly below peer average'
      });
    }

    return gaps;
  }
}

module.exports = EnhancedAnalyticsService; 