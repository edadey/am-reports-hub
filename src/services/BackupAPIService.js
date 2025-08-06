const CloudBackupService = require('./CloudBackupService');

class BackupAPIService {
  constructor(app, authService) {
    this.app = app;
    this.authService = authService;
    this.cloudBackupService = new CloudBackupService();
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Initialize cloud backup service
    this.app.get('/api/backup/status', 
      this.authService.requireAuth(), 
      this.getBackupStatus.bind(this)
    );

    // Create backup
    this.app.post('/api/backup/create', 
      this.authService.requireAuth(), 
      this.createBackup.bind(this)
    );

    // List backups
    this.app.get('/api/backup/list', 
      this.authService.requireAuth(), 
      this.listBackups.bind(this)
    );

    // Get backup details
    this.app.get('/api/backup/:backupId', 
      this.authService.requireAuth(), 
      this.getBackupDetails.bind(this)
    );

    // Restore backup
    this.app.post('/api/backup/:backupId/restore', 
      this.authService.requireAuth(), 
      this.restoreBackup.bind(this)
    );

    // Delete backup
    this.app.delete('/api/backup/:backupId', 
      this.authService.requireAuth(), 
      this.deleteBackup.bind(this)
    );

    // Emergency backup
    this.app.post('/api/backup/emergency', 
      this.authService.requireAuth(), 
      this.createEmergencyBackup.bind(this)
    );

    // Backup statistics
    this.app.get('/api/backup/stats', 
      this.authService.requireAuth(), 
      this.getBackupStats.bind(this)
    );

    // Manual backup schedule
    this.app.post('/api/backup/schedule', 
      this.authService.requireAuth(), 
      this.scheduleBackup.bind(this)
    );

    // Cloud storage endpoints
    this.app.get('/api/backup/cloud/status', 
      this.authService.requireAuth(), 
      this.getCloudStorageStatus.bind(this)
    );

    this.app.get('/api/backup/cloud/list', 
      this.authService.requireAuth(), 
      this.listCloudBackups.bind(this)
    );

    this.app.post('/api/backup/cloud/:backupId/download', 
      this.authService.requireAuth(), 
      this.downloadCloudBackup.bind(this)
    );
  }

  async getBackupStatus(req, res) {
    try {
      const status = {
        service: 'Cloud Backup Service',
        status: 'active',
        timestamp: new Date().toISOString(),
        configuration: this.cloudBackupService.getBackupStats(),
        lastBackup: null,
        nextScheduledBackup: null
      };

      // Get latest backup info
      const backups = await this.cloudBackupService.listBackups();
      if (backups.length > 0) {
        status.lastBackup = {
          backupId: backups[0].backupId,
          timestamp: backups[0].timestamp,
          category: backups[0].category,
          size: backups[0].sizeFormatted
        };
      }

      res.json(status);
    } catch (error) {
      console.error('Error getting backup status:', error);
      res.status(500).json({ error: 'Failed to get backup status' });
    }
  }

  async createBackup(req, res) {
    try {
      const { type = 'full', category = 'daily' } = req.body;
      
      console.log(`📦 Creating ${type} backup (${category}) via API`);
      
      const backup = await this.cloudBackupService.createBackup(type, category);
      
      res.json({
        success: true,
        message: `Backup created successfully`,
        backup: {
          backupId: backup.backupId,
          timestamp: backup.manifest.timestamp,
          type: backup.manifest.type,
          category: backup.manifest.category,
          size: backup.summary.statistics.totalSizeFormatted,
          fileCount: backup.summary.statistics.totalFiles,
          directoryCount: backup.summary.statistics.totalDirectories
        }
      });
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({ 
        error: 'Failed to create backup',
        details: error.message 
      });
    }
  }

  async listBackups(req, res) {
    try {
      const { category } = req.query;
      const backups = await this.cloudBackupService.listBackups(category);
      
      // Group backups by category
      const groupedBackups = {
        daily: backups.filter(b => b.category === 'daily'),
        weekly: backups.filter(b => b.category === 'weekly'),
        monthly: backups.filter(b => b.category === 'monthly'),
        yearly: backups.filter(b => b.category === 'yearly'),
        emergency: backups.filter(b => b.category === 'emergency')
      };

      // Calculate statistics
      const stats = {
        total: backups.length,
        totalSize: backups.reduce((sum, b) => sum + b.size, 0),
        byCategory: Object.keys(groupedBackups).reduce((acc, cat) => {
          acc[cat] = {
            count: groupedBackups[cat].length,
            totalSize: groupedBackups[cat].reduce((sum, b) => sum + b.size, 0)
          };
          return acc;
        }, {})
      };

      res.json({
        backups,
        groupedBackups,
        statistics: stats
      });
    } catch (error) {
      console.error('Error listing backups:', error);
      res.status(500).json({ error: 'Failed to list backups' });
    }
  }

  async getBackupDetails(req, res) {
    try {
      const { backupId } = req.params;
      const backups = await this.cloudBackupService.listBackups();
      const backup = backups.find(b => b.backupId === backupId);
      
      if (!backup) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      // Get detailed manifest
      const backupPath = path.join(
        this.cloudBackupService.cloudBackupPath, 
        backup.category, 
        backup.backupDir
      );
      const manifestPath = path.join(backupPath, 'manifest.json');
      const summaryPath = path.join(backupPath, 'summary.json');
      
      let manifest = null;
      let summary = null;
      
      try {
        manifest = await fs.readJson(manifestPath);
        summary = await fs.readJson(summaryPath);
      } catch (error) {
        console.log(`Could not read manifest/summary for backup ${backupId}`);
      }

      res.json({
        backup,
        manifest,
        summary,
        details: {
          backupPath,
          exists: await fs.pathExists(backupPath),
          size: await this.getDirectorySize(backupPath)
        }
      });
    } catch (error) {
      console.error('Error getting backup details:', error);
      res.status(500).json({ error: 'Failed to get backup details' });
    }
  }

  async restoreBackup(req, res) {
    try {
      const { backupId } = req.params;
      const { targetPath } = req.body;
      
      console.log(`🔄 Restoring backup ${backupId} via API`);
      
      const result = await this.cloudBackupService.restoreBackup(backupId, targetPath);
      
      res.json({
        success: true,
        message: `Backup ${backupId} restored successfully`,
        result
      });
    } catch (error) {
      console.error('Error restoring backup:', error);
      res.status(500).json({ 
        error: 'Failed to restore backup',
        details: error.message 
      });
    }
  }

  async deleteBackup(req, res) {
    try {
      const { backupId } = req.params;
      const backups = await this.cloudBackupService.listBackups();
      const backup = backups.find(b => b.backupId === backupId);
      
      if (!backup) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      const backupPath = path.join(
        this.cloudBackupService.cloudBackupPath, 
        backup.category, 
        backup.backupDir
      );
      
      await fs.remove(backupPath);
      
      res.json({
        success: true,
        message: `Backup ${backupId} deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting backup:', error);
      res.status(500).json({ error: 'Failed to delete backup' });
    }
  }

  async createEmergencyBackup(req, res) {
    try {
      console.log('🚨 Creating emergency backup via API');
      
      const backup = await this.cloudBackupService.createEmergencyBackup();
      
      res.json({
        success: true,
        message: 'Emergency backup created successfully',
        backup: {
          backupId: backup.backupId,
          timestamp: backup.manifest.timestamp,
          category: backup.manifest.category,
          size: backup.summary.statistics.totalSizeFormatted
        }
      });
    } catch (error) {
      console.error('Error creating emergency backup:', error);
      res.status(500).json({ error: 'Failed to create emergency backup' });
    }
  }

  async getBackupStats(req, res) {
    try {
      const backups = await this.cloudBackupService.listBackups();
      const stats = this.cloudBackupService.getBackupStats();
      
      // Calculate additional statistics
      const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
      const avgSize = backups.length > 0 ? totalSize / backups.length : 0;
      
      const categoryStats = {};
      ['daily', 'weekly', 'monthly', 'yearly', 'emergency'].forEach(category => {
        const categoryBackups = backups.filter(b => b.category === category);
        categoryStats[category] = {
          count: categoryBackups.length,
          totalSize: categoryBackups.reduce((sum, b) => sum + b.size, 0),
          avgSize: categoryBackups.length > 0 ? 
            categoryBackups.reduce((sum, b) => sum + b.size, 0) / categoryBackups.length : 0
        };
      });

      res.json({
        ...stats,
        totalBackups: backups.length,
        totalSize,
        totalSizeFormatted: this.cloudBackupService.formatBytes(totalSize),
        avgSize,
        avgSizeFormatted: this.cloudBackupService.formatBytes(avgSize),
        categoryStats,
        retention: this.cloudBackupService.backupConfig.retention
      });
    } catch (error) {
      console.error('Error getting backup stats:', error);
      res.status(500).json({ error: 'Failed to get backup statistics' });
    }
  }

  async scheduleBackup(req, res) {
    try {
      const { type, category, time } = req.body;
      
      // Validate parameters
      if (!type || !category) {
        return res.status(400).json({ 
          error: 'Type and category are required' 
        });
      }

      // Create scheduled backup
      const backup = await this.cloudBackupService.createBackup(type, category);
      
      res.json({
        success: true,
        message: `Scheduled ${type} backup created for ${category}`,
        backup: {
          backupId: backup.backupId,
          timestamp: backup.manifest.timestamp,
          type: backup.manifest.type,
          category: backup.manifest.category
        }
      });
    } catch (error) {
      console.error('Error scheduling backup:', error);
      res.status(500).json({ error: 'Failed to schedule backup' });
    }
  }

  async getDirectorySize(dirPath) {
    try {
      if (!await fs.pathExists(dirPath)) return 0;
      
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) return stats.size;
      
      const files = await fs.readdir(dirPath);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStats = await fs.stat(filePath);
        
        if (fileStats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += fileStats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  async getCloudStorageStatus(req, res) {
    try {
      const status = this.cloudBackupService.cloudStorageService.getCloudStorageStatus();
      
      res.json({
        cloudStorage: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting cloud storage status:', error);
      res.status(500).json({ error: 'Failed to get cloud storage status' });
    }
  }

  async listCloudBackups(req, res) {
    try {
      const cloudBackups = await this.cloudBackupService.cloudStorageService.listCloudBackups();
      
      res.json({
        cloudBackups,
        count: cloudBackups.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error listing cloud backups:', error);
      res.status(500).json({ error: 'Failed to list cloud backups' });
    }
  }

  async downloadCloudBackup(req, res) {
    try {
      const { backupId } = req.params;
      const { targetPath } = req.body;
      
      const result = await this.cloudBackupService.cloudStorageService.downloadFromCloud(
        backupId, 
        targetPath
      );
      
      if (result.success) {
        res.json({
          success: true,
          message: `Cloud backup ${backupId} downloaded successfully`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error downloading cloud backup:', error);
      res.status(500).json({ error: 'Failed to download cloud backup' });
    }
  }
}

module.exports = BackupAPIService; 