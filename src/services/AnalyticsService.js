const fs = require('fs').promises;
const path = require('path');

class AnalyticsService {
  constructor() {
    this.analyticsDir = path.join(__dirname, '../../data/analytics');
  }

  /**
   * Extract key metrics from a report's raw data
   */
  extractMetricsFromReport(reportData) {
    if (!reportData || !reportData.data || !reportData.data.rows) {
      return null;
    }

    const { headers, rows } = reportData.data;
    
    return {
      placements: this.calculateTotalFromReport(reportData.data, 'placement'),
      activities: this.calculateTotalFromReport(reportData.data, 'activity'),
      assessments: {
        completed: this.calculateTotalFromReport(reportData.data, 'assessment_completed'),
        pending: this.calculateTotalFromReport(reportData.data, 'assessment_pending'),
        total: this.calculateTotalFromReport(reportData.data, 'assessment_total')
      },
      careers: Math.round(this.calculateTotalFromReport(reportData.data, 'student') * 0.15),
      students: this.calculateTotalFromReport(reportData.data, 'student')
    };
  }

  /**
   * Calculate totals from report data based on type
   */
  calculateTotalFromReport(reportData, type) {
    if (!reportData.rows) return 0;
    
    const { headers, rows } = reportData;
    let total = 0;

    rows.forEach(row => {
      if (!row[0] || row[0].toLowerCase().includes('total')) return;

      switch(type) {
        case 'placement':
          const placementIndex = headers.findIndex(h => 
            h.toLowerCase().includes('placement') && 
            !h.toLowerCase().includes('percent')
          );
          if (placementIndex >= 0 && row[placementIndex]) {
            total += parseFloat(row[placementIndex]) || 0;
          }
          break;
          
        case 'activity':
          const activityIndex = headers.findIndex(h => 
            h.toLowerCase().includes('students with activities')
          );
          if (activityIndex >= 0 && row[activityIndex]) {
            total += parseFloat(row[activityIndex]) || 0;
          }
          break;
          
        case 'student':
          const studentIndex = headers.findIndex(h => 
            h.toLowerCase().includes('total') && h.toLowerCase().includes('student')
          );
          if (studentIndex >= 0 && row[studentIndex]) {
            total += parseFloat(row[studentIndex]) || 0;
          }
          break;
          
        case 'assessment_completed':
          const totalStudents = this.calculateTotalFromReport(reportData, 'student');
          const studentsWithoutAssessments = this.calculateTotalFromReport(reportData, 'assessment_pending');
          total = totalStudents - studentsWithoutAssessments;
          break;
          
        case 'assessment_pending':
          const assessmentIndex = headers.findIndex(h => 
            h.toLowerCase().includes('student') && h.toLowerCase().includes('assessment')
          );
          if (assessmentIndex >= 0 && row[assessmentIndex]) {
            total += parseFloat(row[assessmentIndex]) || 0;
          }
          break;
          
        case 'assessment_total':
          const completed = this.calculateTotalFromReport(reportData, 'assessment_completed');
          const pending = this.calculateTotalFromReport(reportData, 'assessment_pending');
          total = completed + pending;
          break;
      }
    });

    return total;
  }

  /**
   * Load analytics data for a college
   */
  async loadAnalytics(collegeId) {
    try {
      const analyticsPath = path.join(this.analyticsDir, `${collegeId}.json`);
      const data = await fs.readFile(analyticsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return default structure
        return this.createDefaultAnalytics(collegeId);
      }
      throw error;
    }
  }

  /**
   * Save analytics data for a college
   */
  async saveAnalytics(collegeId, analytics) {
    const analyticsPath = path.join(this.analyticsDir, `${collegeId}.json`);
    await fs.writeFile(analyticsPath, JSON.stringify(analytics, null, 2));
  }

  /**
   * Create default analytics structure
   */
  createDefaultAnalytics(collegeId) {
    return {
      collegeId,
      lastUpdated: new Date().toISOString(),
      version: "1.0",
      timeSeries: {
        placements: [],
        activities: [],
        assessments: [],
        careers: []
      },
      summary: {
        totalReports: 0,
        dateRange: {
          firstReport: null,
          lastReport: null
        },
        averages: {
          placements: 0,
          activities: 0,
          assessments: 0,
          careers: 0
        },
        trends: {
          placements: "stable",
          activities: "stable",
          assessments: "stable",
          careers: "stable"
        }
      },
      metadata: {
        lastProcessedReport: null,
        dataIntegrity: {
          checksum: null,
          lastValidated: null
        }
      }
    };
  }

  /**
   * Process a new report and update analytics
   */
  async processNewReport(collegeId, reportData) {
    try {
      console.log(`Processing analytics for college ${collegeId}, report ${reportData.id}`);
      
      // Extract metrics from the new report
      const metrics = this.extractMetricsFromReport(reportData);
      if (!metrics) {
        console.log('No valid metrics found in report');
        return false;
      }

      // Load existing analytics
      const analytics = await this.loadAnalytics(collegeId);
      
      // Add new metrics to time series
      const reportDate = new Date(reportData.createdAt).toISOString().split('T')[0];
      
      analytics.timeSeries.placements.push({
        date: reportDate,
        value: metrics.placements,
        reportId: reportData.id,
        timestamp: reportData.createdAt
      });

      analytics.timeSeries.activities.push({
        date: reportDate,
        value: metrics.activities,
        reportId: reportData.id,
        timestamp: reportData.createdAt
      });

      analytics.timeSeries.assessments.push({
        date: reportDate,
        completed: metrics.assessments.completed,
        pending: metrics.assessments.pending,
        total: metrics.assessments.total,
        reportId: reportData.id,
        timestamp: reportData.createdAt
      });

      analytics.timeSeries.careers.push({
        date: reportDate,
        value: metrics.careers,
        reportId: reportData.id,
        timestamp: reportData.createdAt
      });

      // Update summary statistics
      analytics.summary.totalReports++;
      analytics.summary.dateRange.lastReport = reportData.createdAt;
      if (!analytics.summary.dateRange.firstReport) {
        analytics.summary.dateRange.firstReport = reportData.createdAt;
      }

      // Recalculate averages
      analytics.summary.averages = this.calculateAverages(analytics.timeSeries);
      
      // Calculate trends
      analytics.summary.trends = this.calculateTrends(analytics.timeSeries);
      
      // Update metadata
      analytics.lastUpdated = new Date().toISOString();
      analytics.metadata.lastProcessedReport = reportData.id;
      
      // Save updated analytics
      await this.saveAnalytics(collegeId, analytics);
      
      console.log(`Analytics updated successfully for college ${collegeId}`);
      return true;
      
    } catch (error) {
      console.error(`Error processing analytics for college ${collegeId}:`, error);
      return false;
    }
  }

  /**
   * Calculate averages from time series data
   */
  calculateAverages(timeSeries) {
    const calculateAverage = (data) => {
      if (!data || data.length === 0) return 0;
      const sum = data.reduce((acc, item) => acc + (item.value || 0), 0);
      return Math.round(sum / data.length);
    };

    return {
      placements: calculateAverage(timeSeries.placements),
      activities: calculateAverage(timeSeries.activities),
      assessments: timeSeries.assessments.length > 0 ? 
        Math.round(timeSeries.assessments[timeSeries.assessments.length - 1].total) : 0,
      careers: calculateAverage(timeSeries.careers)
    };
  }

  /**
   * Calculate trends from time series data
   */
  calculateTrends(timeSeries) {
    const calculateTrend = (data) => {
      if (!data || data.length < 2) return "stable";
      
      const recent = data.slice(-3); // Last 3 data points
      const values = recent.map(item => item.value || 0);
      
      if (values.length < 2) return "stable";
      
      const first = values[0];
      const last = values[values.length - 1];
      const change = last - first;
      const percentChange = (change / first) * 100;
      
      if (percentChange > 5) return "increasing";
      if (percentChange < -5) return "decreasing";
      return "stable";
    };

    return {
      placements: calculateTrend(timeSeries.placements),
      activities: calculateTrend(timeSeries.activities),
      assessments: "stable", // Assessments are typically stable
      careers: calculateTrend(timeSeries.careers)
    };
  }

  /**
   * Generate analytics from existing reports (for migration)
   */
  async generateAnalyticsFromReports(collegeId, reports) {
    console.log(`Generating analytics from ${reports.length} existing reports for college ${collegeId}`);
    
    // Create fresh analytics structure
    const analytics = this.createDefaultAnalytics(collegeId);
    
    if (reports.length === 0) {
      console.log(`No reports to process for college ${collegeId}`);
      return analytics;
    }
    
    // Process each report in chronological order
    const sortedReports = reports.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Build time series data from all reports
    for (const report of sortedReports) {
      const metrics = this.extractMetricsFromReport(report);
      if (!metrics) {
        console.log(`No valid metrics found in report ${report.id}, skipping...`);
        continue;
      }

      const reportDate = new Date(report.createdAt).toISOString().split('T')[0];
      
      analytics.timeSeries.placements.push({
        date: reportDate,
        value: metrics.placements,
        reportId: report.id,
        timestamp: report.createdAt
      });

      analytics.timeSeries.activities.push({
        date: reportDate,
        value: metrics.activities,
        reportId: report.id,
        timestamp: report.createdAt
      });

      analytics.timeSeries.assessments.push({
        date: reportDate,
        completed: metrics.assessments.completed,
        pending: metrics.assessments.pending,
        total: metrics.assessments.total,
        reportId: report.id,
        timestamp: report.createdAt
      });

      analytics.timeSeries.careers.push({
        date: reportDate,
        value: metrics.careers,
        reportId: report.id,
        timestamp: report.createdAt
      });
    }
    
    // Update summary statistics
    analytics.summary.totalReports = reports.length;
    analytics.summary.dateRange.firstReport = sortedReports[0].createdAt;
    analytics.summary.dateRange.lastReport = sortedReports[sortedReports.length - 1].createdAt;
    
    // Calculate averages and trends
    analytics.summary.averages = this.calculateAverages(analytics.timeSeries);
    analytics.summary.trends = this.calculateTrends(analytics.timeSeries);
    
    // Update metadata
    analytics.lastUpdated = new Date().toISOString();
    analytics.metadata.lastProcessedReport = sortedReports[sortedReports.length - 1].id;
    
    // Save the complete analytics
    await this.saveAnalytics(collegeId, analytics);
    
    console.log(`Analytics generation completed for college ${collegeId}`);
    return analytics;
  }

  /**
   * Get chart-ready data for frontend
   */
  async getChartData(collegeId, limit = 7) {
    try {
      const analytics = await this.loadAnalytics(collegeId);
      
      // Get the most recent data points
      const recentPlacements = analytics.timeSeries.placements.slice(-limit);
      const recentActivities = analytics.timeSeries.activities.slice(-limit);
      const recentCareers = analytics.timeSeries.careers.slice(-limit);
      const latestAssessments = analytics.timeSeries.assessments[analytics.timeSeries.assessments.length - 1];
      
      return {
        labels: recentPlacements.map(p => 
          new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        ),
        placements: recentPlacements.map(p => p.value),
        activities: recentActivities.map(a => a.value),
        assessments: latestAssessments ? [latestAssessments.completed, latestAssessments.pending] : [0, 0],
        careers: recentCareers.map(c => c.value),
        summary: analytics.summary
      };
    } catch (error) {
      console.error(`Error getting chart data for college ${collegeId}:`, error);
      return null;
    }
  }
}

module.exports = AnalyticsService; 