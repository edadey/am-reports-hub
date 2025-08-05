const cron = require('node-cron');
const moment = require('moment');
const fs = require('fs-extra');

class ReportScheduler {
  constructor() {
    this.schedules = new Map();
    this.initializeScheduler();
  }

  initializeScheduler() {
    // Check for due reports every day at 8 AM
    cron.schedule('0 8 * * *', () => {
      this.checkDueReports();
    });
  }

  async checkDueReports() {
    const colleges = await this.getColleges();
    const today = moment();
    
    colleges.forEach(college => {
      if (this.isReportDue(college, today)) {
        this.notifyUser(college);
      }
    });
  }

  isReportDue(college, today) {
    if (!college.lastReportDate) {
      return true; // First report
    }
    
    const lastReport = moment(college.lastReportDate);
    
    switch (college.reportFrequency) {
      case 'weekly':
        return today.diff(lastReport, 'weeks') >= 1;
      case 'bi-weekly':
        return today.diff(lastReport, 'weeks') >= 2;
      case 'monthly':
        return today.diff(lastReport, 'months') >= 1;
      default:
        return false;
    }
  }

  async notifyUser(college) {
    // Send notification to user about due report
    console.log(`Report due for ${college.name}`);
    // In future: implement email/Slack notifications
  }

  async getColleges() {
    try {
      return await fs.readJson('data/colleges.json');
    } catch (error) {
      return [];
    }
  }

  getNextReportDate(college) {
    const lastReport = college.lastReportDate ? moment(college.lastReportDate) : moment();
    
    switch (college.reportFrequency) {
      case 'weekly':
        return lastReport.add(1, 'week').format('YYYY-MM-DD');
      case 'bi-weekly':
        return lastReport.add(2, 'weeks').format('YYYY-MM-DD');
      case 'monthly':
        return lastReport.add(1, 'month').format('YYYY-MM-DD');
      default:
        return null;
    }
  }
}

module.exports = ReportScheduler; 