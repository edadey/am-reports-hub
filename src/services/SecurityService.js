const fs = require('fs-extra');
const path = require('path');

class SecurityService {
  constructor() {
    this.loginAttemptsFile = 'data/login-attempts.json';
    this.securityLogsFile = 'data/security-logs.json';
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    fs.ensureDirSync('data');
  }

  /**
   * Track login attempt
   */
  async trackLoginAttempt(username, success, ipAddress, userAgent) {
    try {
      const attempts = await this.getLoginAttempts();
      const now = new Date().toISOString();
      
      const attempt = {
        id: Date.now().toString(),
        username,
        success,
        ipAddress,
        userAgent,
        timestamp: now
      };
      
      attempts.push(attempt);
      
      // Keep only last 1000 attempts
      if (attempts.length > 1000) {
        attempts.splice(0, attempts.length - 1000);
      }
      
      await fs.writeJson(this.loginAttemptsFile, attempts, { spaces: 2 });
      
      // Log security event
      await this.logSecurityEvent('login_attempt', {
        username,
        success,
        ipAddress,
        userAgent
      });
      
      return attempt;
    } catch (error) {
      console.error('Error tracking login attempt:', error);
    }
  }

  /**
   * Check if account should be locked
   */
  async shouldLockAccount(username, ipAddress) {
    try {
      const attempts = await this.getLoginAttempts();
      const now = new Date();
      const windowStart = new Date(now.getTime() - (15 * 60 * 1000)); // 15 minutes
      
      // Count failed attempts in the last 15 minutes
      const recentFailedAttempts = attempts.filter(attempt => 
        attempt.username === username &&
        !attempt.success &&
        new Date(attempt.timestamp) > windowStart
      );
      
      // Lock after 5 failed attempts
      if (recentFailedAttempts.length >= 5) {
        await this.logSecurityEvent('account_locked', {
          username,
          ipAddress,
          failedAttempts: recentFailedAttempts.length
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking account lock status:', error);
      return false;
    }
  }

  /**
   * Check if IP should be blocked
   */
  async shouldBlockIP(ipAddress) {
    try {
      const attempts = await this.getLoginAttempts();
      const now = new Date();
      const windowStart = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour
      
      // Count failed attempts from this IP in the last hour
      const recentFailedAttempts = attempts.filter(attempt => 
        attempt.ipAddress === ipAddress &&
        !attempt.success &&
        new Date(attempt.timestamp) > windowStart
      );
      
      // Block IP after 10 failed attempts
      if (recentFailedAttempts.length >= 10) {
        await this.logSecurityEvent('ip_blocked', {
          ipAddress,
          failedAttempts: recentFailedAttempts.length
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking IP block status:', error);
      return false;
    }
  }

  /**
   * Get login attempts
   */
  async getLoginAttempts() {
    try {
      return await fs.readJson(this.loginAttemptsFile);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get login attempts for a specific user
   */
  async getUserLoginAttempts(username, hours = 24) {
    try {
      const attempts = await this.getLoginAttempts();
      const now = new Date();
      const windowStart = new Date(now.getTime() - (hours * 60 * 60 * 1000));
      
      return attempts.filter(attempt => 
        attempt.username === username &&
        new Date(attempt.timestamp) > windowStart
      );
    } catch (error) {
      console.error('Error getting user login attempts:', error);
      return [];
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, details) {
    try {
      const logs = await this.getSecurityLogs();
      const log = {
        id: Date.now().toString(),
        eventType,
        details,
        timestamp: new Date().toISOString()
      };
      
      logs.push(log);
      
      // Keep only last 1000 logs
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      
      await fs.writeJson(this.securityLogsFile, logs, { spaces: 2 });
      
      return log;
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Get security logs
   */
  async getSecurityLogs() {
    try {
      return await fs.readJson(this.securityLogsFile);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get security logs for a specific user
   */
  async getUserSecurityLogs(username, hours = 24) {
    try {
      const logs = await this.getSecurityLogs();
      const now = new Date();
      const windowStart = new Date(now.getTime() - (hours * 60 * 60 * 1000));
      
      return logs.filter(log => 
        log.details.username === username &&
        new Date(log.timestamp) > windowStart
      );
    } catch (error) {
      console.error('Error getting user security logs:', error);
      return [];
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    const strength = score < 3 ? 'weak' : score < 4 ? 'medium' : 'strong';
    
    return {
      valid: score >= 3,
      strength,
      score,
      checks,
      suggestions: this.getPasswordSuggestions(checks)
    };
  }

  /**
   * Get password improvement suggestions
   */
  getPasswordSuggestions(checks) {
    const suggestions = [];
    
    if (!checks.length) {
      suggestions.push('Password should be at least 8 characters long');
    }
    if (!checks.lowercase) {
      suggestions.push('Include at least one lowercase letter');
    }
    if (!checks.uppercase) {
      suggestions.push('Include at least one uppercase letter');
    }
    if (!checks.numbers) {
      suggestions.push('Include at least one number');
    }
    if (!checks.special) {
      suggestions.push('Include at least one special character (!@#$%^&*)');
    }
    
    return suggestions;
  }

  /**
   * Detect suspicious activity
   */
  async detectSuspiciousActivity(username, ipAddress, userAgent) {
    try {
      const attempts = await this.getUserLoginAttempts(username, 24);
      const recentAttempts = attempts.slice(-5); // Last 5 attempts
      
      // Check for multiple IP addresses
      const uniqueIPs = new Set(recentAttempts.map(a => a.ipAddress));
      if (uniqueIPs.size > 3) {
        return {
          suspicious: true,
          reason: 'Multiple IP addresses detected',
          details: `Account accessed from ${uniqueIPs.size} different IP addresses in 24 hours`
        };
      }
      
      // Check for rapid login attempts
      if (recentAttempts.length >= 3) {
        const timeSpan = new Date(recentAttempts[recentAttempts.length - 1].timestamp) - 
                        new Date(recentAttempts[0].timestamp);
        if (timeSpan < 5 * 60 * 1000) { // Less than 5 minutes
          return {
            suspicious: true,
            reason: 'Rapid login attempts detected',
            details: `${recentAttempts.length} login attempts in ${Math.round(timeSpan / 1000 / 60)} minutes`
          };
        }
      }
      
      // Check for unusual user agents
      const commonUserAgents = [
        'chrome', 'firefox', 'safari', 'edge', 'opera'
      ];
      const userAgentLower = userAgent.toLowerCase();
      const isCommonBrowser = commonUserAgents.some(browser => userAgentLower.includes(browser));
      
      if (!isCommonBrowser && userAgent !== 'Unknown') {
        return {
          suspicious: true,
          reason: 'Unusual user agent detected',
          details: `Unusual browser/device: ${userAgent}`
        };
      }
      
      return { suspicious: false };
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return { suspicious: false };
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(hours = 24) {
    try {
      const attempts = await this.getLoginAttempts();
      const logs = await this.getSecurityLogs();
      const now = new Date();
      const windowStart = new Date(now.getTime() - (hours * 60 * 60 * 1000));
      
      const recentAttempts = attempts.filter(a => new Date(a.timestamp) > windowStart);
      const recentLogs = logs.filter(l => new Date(l.timestamp) > windowStart);
      
      return {
        totalAttempts: recentAttempts.length,
        successfulAttempts: recentAttempts.filter(a => a.success).length,
        failedAttempts: recentAttempts.filter(a => !a.success).length,
        successRate: recentAttempts.length > 0 ? 
          (recentAttempts.filter(a => a.success).length / recentAttempts.length * 100).toFixed(1) : 0,
        securityEvents: recentLogs.length,
        accountLocks: recentLogs.filter(l => l.eventType === 'account_locked').length,
        ipBlocks: recentLogs.filter(l => l.eventType === 'ip_blocked').length,
        suspiciousActivity: recentLogs.filter(l => l.eventType === 'suspicious_activity').length
      };
    } catch (error) {
      console.error('Error getting security stats:', error);
      return {};
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(daysToKeep = 30) {
    try {
      const attempts = await this.getLoginAttempts();
      const logs = await this.getSecurityLogs();
      const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
      
      const filteredAttempts = attempts.filter(a => new Date(a.timestamp) > cutoffDate);
      const filteredLogs = logs.filter(l => new Date(l.timestamp) > cutoffDate);
      
      await fs.writeJson(this.loginAttemptsFile, filteredAttempts, { spaces: 2 });
      await fs.writeJson(this.securityLogsFile, filteredLogs, { spaces: 2 });
      
      console.log(`Cleaned up ${attempts.length - filteredAttempts.length} old login attempts`);
      console.log(`Cleaned up ${logs.length - filteredLogs.length} old security logs`);
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }
}

module.exports = SecurityService; 