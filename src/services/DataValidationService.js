const fs = require('fs').promises;
const path = require('path');
const AnalyticsService = require('./AnalyticsService');

class DataValidationService {
  constructor() {
    this.analyticsService = new AnalyticsService();
    this.reportsDir = path.join(__dirname, '../../data/reports');
  }

  /**
   * Validate analytics data against original reports
   */
  async validateAnalytics(collegeId) {
    try {
      console.log(`\n=== Validating Analytics for College ${collegeId} ===`);
      
      // Load analytics data
      const analytics = await this.analyticsService.loadAnalytics(collegeId);
      
      // Load original reports
      const reportsPath = path.join(this.reportsDir, `${collegeId}.json`);
      let reports = [];
      
      try {
        const reportsData = await fs.readFile(reportsPath, 'utf8');
        reports = JSON.parse(reportsData);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`No reports found for college ${collegeId}`);
          return { valid: true, message: 'No reports to validate' };
        }
        throw error;
      }
      
      if (reports.length === 0) {
        console.log(`No reports to validate for college ${collegeId}`);
        return { valid: true, message: 'No reports to validate' };
      }
      
      const validationResults = {
        collegeId,
        totalReports: reports.length,
        analyticsReports: analytics.summary.totalReports,
        timeSeriesCount: {
          placements: analytics.timeSeries.placements.length,
          activities: analytics.timeSeries.activities.length,
          assessments: analytics.timeSeries.assessments.length,
          careers: analytics.timeSeries.careers.length
        },
        discrepancies: [],
        valid: true
      };
      
      // Check report count
      if (reports.length !== analytics.summary.totalReports) {
        validationResults.discrepancies.push({
          type: 'report_count_mismatch',
          expected: reports.length,
          actual: analytics.summary.totalReports
        });
        validationResults.valid = false;
      }
      
      // Validate each report's metrics
      const sortedReports = reports.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      for (let i = 0; i < sortedReports.length; i++) {
        const report = sortedReports[i];
        const reportMetrics = this.analyticsService.extractMetricsFromReport(report);
        
        if (!reportMetrics) {
          validationResults.discrepancies.push({
            type: 'invalid_report_metrics',
            reportId: report.id,
            reportName: report.name,
            message: 'Could not extract metrics from report'
          });
          validationResults.valid = false;
          continue;
        }
        
        // Check if analytics has this report
        const analyticsEntry = analytics.timeSeries.placements.find(p => p.reportId === report.id);
        if (!analyticsEntry) {
          validationResults.discrepancies.push({
            type: 'missing_analytics_entry',
            reportId: report.id,
            reportName: report.name
          });
          validationResults.valid = false;
          continue;
        }
        
        // Validate metrics match
        const analyticsMetrics = {
          placements: analyticsEntry.value,
          activities: analytics.timeSeries.activities.find(a => a.reportId === report.id)?.value || 0,
          careers: analytics.timeSeries.careers.find(c => c.reportId === report.id)?.value || 0
        };
        
        if (Math.abs(reportMetrics.placements - analyticsMetrics.placements) > 0.01) {
          validationResults.discrepancies.push({
            type: 'placements_mismatch',
            reportId: report.id,
            reportName: report.name,
            expected: reportMetrics.placements,
            actual: analyticsMetrics.placements
          });
          validationResults.valid = false;
        }
        
        if (Math.abs(reportMetrics.activities - analyticsMetrics.activities) > 0.01) {
          validationResults.discrepancies.push({
            type: 'activities_mismatch',
            reportId: report.id,
            reportName: report.name,
            expected: reportMetrics.activities,
            actual: analyticsMetrics.activities
          });
          validationResults.valid = false;
        }
        
        if (Math.abs(reportMetrics.careers - analyticsMetrics.careers) > 0.01) {
          validationResults.discrepancies.push({
            type: 'careers_mismatch',
            reportId: report.id,
            reportName: report.name,
            expected: reportMetrics.careers,
            actual: analyticsMetrics.careers
          });
          validationResults.valid = false;
        }
      }
      
      // Log validation results
      if (validationResults.valid) {
        console.log(`✅ Analytics validation passed for college ${collegeId}`);
        console.log(`   - Reports: ${validationResults.totalReports}`);
        console.log(`   - Time series entries: ${validationResults.timeSeriesCount.placements}`);
        console.log(`   - Date range: ${analytics.summary.dateRange.firstReport} to ${analytics.summary.dateRange.lastReport}`);
      } else {
        console.log(`❌ Analytics validation failed for college ${collegeId}`);
        console.log(`   - Discrepancies found: ${validationResults.discrepancies.length}`);
        validationResults.discrepancies.forEach(d => {
          console.log(`     * ${d.type}: ${d.message || `${d.expected} vs ${d.actual}`}`);
        });
      }
      
      return validationResults;
      
    } catch (error) {
      console.error(`Error validating analytics for college ${collegeId}:`, error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Validate all colleges
   */
  async validateAllColleges() {
    try {
      console.log('\n=== Validating Analytics for All Colleges ===');
      
      // Load colleges
      const collegesPath = path.join(__dirname, '../../data/colleges.json');
      const collegesData = await fs.readFile(collegesPath, 'utf8');
      const colleges = JSON.parse(collegesData);
      
      const results = {
        totalColleges: colleges.length,
        validColleges: 0,
        invalidColleges: 0,
        collegeResults: []
      };
      
      for (const college of colleges) {
        const result = await this.validateAnalytics(college.id);
        results.collegeResults.push(result);
        
        if (result.valid) {
          results.validColleges++;
        } else {
          results.invalidColleges++;
        }
      }
      
      // Summary
      console.log('\n=== Validation Summary ===');
      console.log(`Total Colleges: ${results.totalColleges}`);
      console.log(`Valid: ${results.validColleges}`);
      console.log(`Invalid: ${results.invalidColleges}`);
      console.log(`Success Rate: ${((results.validColleges / results.totalColleges) * 100).toFixed(1)}%`);
      
      return results;
      
    } catch (error) {
      console.error('Error validating all colleges:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate validation report
   */
  async generateValidationReport() {
    const results = await this.validateAllColleges();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalColleges: results.totalColleges,
        validColleges: results.validColleges,
        invalidColleges: results.invalidColleges,
        successRate: ((results.validColleges / results.totalColleges) * 100).toFixed(1) + '%'
      },
      details: results.collegeResults
    };
    
    // Save validation report
    const reportPath = path.join(__dirname, '../../data/validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Validation report saved to: ${reportPath}`);
    
    return report;
  }
}

module.exports = DataValidationService; 