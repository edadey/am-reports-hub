const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      analyticsGeneration: [],
      chartDataRequests: [],
      reportProcessing: [],
      storageUsage: {}
    };
    this.metricsPath = path.join(__dirname, '../../data/performance-metrics.json');
  }

  /**
   * Start timing an operation
   */
  startTimer(operation) {
    return {
      operation,
      startTime: Date.now(),
      startHrTime: process.hrtime()
    };
  }

  /**
   * End timing and record metrics
   */
  endTimer(timer, additionalData = {}) {
    const endTime = Date.now();
    const endHrTime = process.hrtime(timer.startHrTime);
    
    const metric = {
      operation: timer.operation,
      duration: endTime - timer.startTime,
      durationHr: endHrTime[0] * 1000 + endHrTime[1] / 1000000, // milliseconds
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    
    this.recordMetric(metric);
    return metric;
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric) {
    const category = this.getMetricCategory(metric.operation);
    if (category) {
      this.metrics[category].push(metric);
      
      // Keep only last 1000 metrics per category
      if (this.metrics[category].length > 1000) {
        this.metrics[category] = this.metrics[category].slice(-1000);
      }
    }
  }

  /**
   * Get metric category based on operation
   */
  getMetricCategory(operation) {
    if (operation.includes('analytics_generation')) return 'analyticsGeneration';
    if (operation.includes('chart_data')) return 'chartDataRequests';
    if (operation.includes('report_processing')) return 'reportProcessing';
    return null;
  }

  /**
   * Calculate storage usage
   */
  async calculateStorageUsage() {
    try {
      const dataDir = path.join(__dirname, '../../data');
      const reportsDir = path.join(dataDir, 'reports');
      const analyticsDir = path.join(dataDir, 'analytics');
      
      const usage = {
        timestamp: new Date().toISOString(),
        reports: {
          totalFiles: 0,
          totalSize: 0,
          averageFileSize: 0
        },
        analytics: {
          totalFiles: 0,
          totalSize: 0,
          averageFileSize: 0
        },
        total: {
          size: 0,
          compressionRatio: 0
        }
      };
      
      // Calculate reports storage
      try {
        const reportFiles = await fs.readdir(reportsDir);
        usage.reports.totalFiles = reportFiles.length;
        
        let reportsTotalSize = 0;
        for (const file of reportFiles) {
          const filePath = path.join(reportsDir, file);
          const stats = await fs.stat(filePath);
          reportsTotalSize += stats.size;
        }
        usage.reports.totalSize = reportsTotalSize;
        usage.reports.averageFileSize = reportsTotalSize / reportFiles.length;
      } catch (error) {
        // Reports directory might not exist
      }
      
      // Calculate analytics storage
      try {
        const analyticsFiles = await fs.readdir(analyticsDir);
        usage.analytics.totalFiles = analyticsFiles.length;
        
        let analyticsTotalSize = 0;
        for (const file of analyticsFiles) {
          const filePath = path.join(analyticsDir, file);
          const stats = await fs.stat(filePath);
          analyticsTotalSize += stats.size;
        }
        usage.analytics.totalSize = analyticsTotalSize;
        usage.analytics.averageFileSize = analyticsTotalSize / analyticsFiles.length;
      } catch (error) {
        // Analytics directory might not exist
      }
      
      // Calculate totals
      usage.total.size = usage.reports.totalSize + usage.analytics.totalSize;
      usage.total.compressionRatio = usage.reports.totalSize > 0 ? 
        ((usage.reports.totalSize - usage.analytics.totalSize) / usage.reports.totalSize) * 100 : 0;
      
      this.metrics.storageUsage = usage;
      return usage;
      
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return null;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {
      analyticsGeneration: this.calculateStats(this.metrics.analyticsGeneration),
      chartDataRequests: this.calculateStats(this.metrics.chartDataRequests),
      reportProcessing: this.calculateStats(this.metrics.reportProcessing),
      storageUsage: this.metrics.storageUsage
    };
    
    return stats;
  }

  /**
   * Calculate statistics for a metric category
   */
  calculateStats(metrics) {
    if (!metrics || metrics.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        recent: []
      };
    }
    
    const durations = metrics.map(m => m.duration);
    const recent = metrics.slice(-10); // Last 10 metrics
    
    return {
      count: metrics.length,
      average: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      min: Math.min(...durations),
      max: Math.max(...durations),
      recent: recent.map(m => ({
        operation: m.operation,
        duration: m.duration,
        timestamp: m.timestamp
      }))
    };
  }

  /**
   * Save metrics to file
   */
  async saveMetrics() {
    try {
      await fs.writeFile(this.metricsPath, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('Error saving performance metrics:', error);
    }
  }

  /**
   * Load metrics from file
   */
  async loadMetrics() {
    try {
      const data = await fs.readFile(this.metricsPath, 'utf8');
      this.metrics = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading performance metrics:', error);
      }
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport() {
    await this.calculateStorageUsage();
    const stats = this.getPerformanceStats();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMetrics: Object.values(this.metrics).reduce((sum, category) => {
          return sum + (Array.isArray(category) ? category.length : 0);
        }, 0),
        storageCompression: `${stats.storageUsage.total?.compressionRatio?.toFixed(1)}%`,
        averageAnalyticsGeneration: `${stats.analyticsGeneration.average}ms`,
        averageChartRequest: `${stats.chartDataRequests.average}ms`
      },
      details: stats
    };
    
    // Save report
    const reportPath = path.join(__dirname, '../../data/performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  /**
   * Monitor a function execution
   */
  async monitor(operation, fn) {
    const timer = this.startTimer(operation);
    try {
      const result = await fn();
      this.endTimer(timer, { success: true });
      return result;
    } catch (error) {
      this.endTimer(timer, { success: false, error: error.message });
      throw error;
    }
  }
}

module.exports = PerformanceMonitor; 