const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.dataDir = path.join(__dirname, '../../data');
    this.maxBackups = 30; // Keep 30 days of backups
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Initialize backup service
   */
  async initialize() {
    try {
      // Create backup directory if it doesn't exist
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.backupDir, 'reports'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'templates'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'colleges'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'analytics'), { recursive: true });
      
      console.log('✅ Backup service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize backup service:', error);
      return false;
    }
  }

  /**
   * Create a comprehensive backup of all data
   */
  async createBackup(backupName = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = backupName || `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      console.log(`🔄 Creating backup: ${backupId}`);
      
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });
      
      // Backup core data files
      const coreFiles = ['colleges.json', 'users.json', 'accountManagers.json', 'templates.json', 'kpis.json'];
      for (const file of coreFiles) {
        await this.backupFile(path.join(this.dataDir, file), path.join(backupPath, file));
      }
      
      // Backup reports directory
      await this.backupReportsDirectory(backupPath);
      
      // Backup analytics directory
      await this.backupAnalyticsDirectory(backupPath);
      
      // Create backup manifest
      const manifest = await this.createBackupManifest(backupPath, backupId);
      await fs.writeFile(path.join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
      
      // Validate backup integrity
      const isValid = await this.validateBackupIntegrity(backupPath, manifest);
      if (!isValid) {
        throw new Error('Backup integrity validation failed');
      }
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      console.log(`✅ Backup completed successfully: ${backupId}`);
      return { success: true, backupId, manifest };
      
    } catch (error) {
      console.error(`❌ Backup failed: ${error.message}`);
      // Clean up failed backup
      try {
        await fs.rmdir(backupPath, { recursive: true });
      } catch (cleanupError) {
        console.error('Failed to clean up failed backup:', cleanupError);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Backup a single file with compression and checksum
   */
  async backupFile(sourcePath, destPath) {
    try {
      // Check if source file exists
      await fs.access(sourcePath);
      
      // Read source file
      const data = await fs.readFile(sourcePath, 'utf8');
      
      // Create checksum
      const checksum = crypto.createHash('sha256').update(data).digest('hex');
      
      // Compress data
      const compressed = await gzip(data);
      
      // Write compressed file
      await fs.writeFile(destPath, compressed);
      
      // Write checksum file
      await fs.writeFile(`${destPath}.checksum`, checksum);
      
      return { checksum, size: data.length, compressedSize: compressed.length };
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`⚠️ File not found, skipping: ${sourcePath}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Backup reports directory
   */
  async backupReportsDirectory(backupPath) {
    const reportsDir = path.join(this.dataDir, 'reports');
    const backupReportsDir = path.join(backupPath, 'reports');
    
    try {
      await fs.mkdir(backupReportsDir, { recursive: true });
      
      const files = await fs.readdir(reportsDir);
      const reportFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of reportFiles) {
        await this.backupFile(
          path.join(reportsDir, file),
          path.join(backupReportsDir, file)
        );
      }
      
      console.log(`✅ Backed up ${reportFiles.length} report files`);
    } catch (error) {
      console.error('❌ Failed to backup reports directory:', error);
      throw error;
    }
  }

  /**
   * Backup analytics directory
   */
  async backupAnalyticsDirectory(backupPath) {
    const analyticsDir = path.join(this.dataDir, 'analytics');
    const backupAnalyticsDir = path.join(backupPath, 'analytics');
    
    try {
      await fs.mkdir(backupAnalyticsDir, { recursive: true });
      
      const files = await fs.readdir(analyticsDir);
      const analyticsFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of analyticsFiles) {
        await this.backupFile(
          path.join(analyticsDir, file),
          path.join(backupAnalyticsDir, file)
        );
      }
      
      console.log(`✅ Backed up ${analyticsFiles.length} analytics files`);
    } catch (error) {
      console.error('❌ Failed to backup analytics directory:', error);
      throw error;
    }
  }

  /**
   * Create backup manifest
   */
  async createBackupManifest(backupPath, backupId) {
    const manifest = {
      backupId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      files: {},
      summary: {
        totalFiles: 0,
        totalSize: 0,
        totalCompressedSize: 0
      }
    };

    try {
      // Scan backup directory recursively
      const scanDirectory = async (dir, relativePath = '') => {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativeItemPath = path.join(relativePath, item);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            await scanDirectory(fullPath, relativeItemPath);
          } else if (item.endsWith('.json') && !item.endsWith('.checksum')) {
            // Read checksum if available
            let checksum = null;
            try {
              checksum = await fs.readFile(`${fullPath}.checksum`, 'utf8');
            } catch (error) {
              // Checksum file doesn't exist
            }
            
            manifest.files[relativeItemPath] = {
              size: stat.size,
              checksum,
              modified: stat.mtime.toISOString()
            };
            
            manifest.summary.totalFiles++;
            manifest.summary.totalCompressedSize += stat.size;
          }
        }
      };
      
      await scanDirectory(backupPath);
      
      return manifest;
    } catch (error) {
      console.error('❌ Failed to create backup manifest:', error);
      throw error;
    }
  }

  /**
   * Validate backup integrity
   */
  async validateBackupIntegrity(backupPath, manifest) {
    try {
      console.log('🔍 Validating backup integrity...');
      
      for (const [filePath, fileInfo] of Object.entries(manifest.files)) {
        const fullPath = path.join(backupPath, filePath);
        
        // Check if file exists
        try {
          await fs.access(fullPath);
        } catch (error) {
          console.error(`❌ Backup file missing: ${filePath}`);
          return false;
        }
        
        // Validate checksum if available
        if (fileInfo.checksum) {
          const data = await fs.readFile(fullPath);
          const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
          
          if (calculatedChecksum !== fileInfo.checksum) {
            console.error(`❌ Checksum mismatch for: ${filePath}`);
            return false;
          }
        }
      }
      
      console.log('✅ Backup integrity validation passed');
      return true;
    } catch (error) {
      console.error('❌ Backup integrity validation failed:', error);
      return false;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId) {
    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      console.log(`🔄 Restoring from backup: ${backupId}`);
      
      // Read backup manifest
      const manifestPath = path.join(backupPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);
      
      // Validate backup integrity before restore
      const isValid = await this.validateBackupIntegrity(backupPath, manifest);
      if (!isValid) {
        throw new Error('Backup integrity validation failed');
      }
      
      // Create restore directory
      const restorePath = path.join(this.dataDir, `restore-${Date.now()}`);
      await fs.mkdir(restorePath, { recursive: true });
      
      // Restore files
      for (const [filePath, fileInfo] of Object.entries(manifest.files)) {
        const sourcePath = path.join(backupPath, filePath);
        const destPath = path.join(restorePath, filePath);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        
        // Read compressed data
        const compressedData = await fs.readFile(sourcePath);
        
        // Decompress data
        const data = await gunzip(compressedData);
        
        // Write restored file
        await fs.writeFile(destPath, data);
        
        // Validate checksum
        if (fileInfo.checksum) {
          const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
          if (calculatedChecksum !== fileInfo.checksum) {
            throw new Error(`Checksum validation failed for ${filePath}`);
          }
        }
      }
      
      console.log(`✅ Restore completed successfully to: ${restorePath}`);
      return { success: true, restorePath, manifest };
      
    } catch (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups() {
    try {
      const backups = await fs.readdir(this.backupDir);
      const backupDirs = backups.filter(item => {
        return item.startsWith('backup-') && !item.includes('manual');
      });
      
      if (backupDirs.length <= this.maxBackups) {
        return;
      }
      
      // Sort by creation time (oldest first)
      const backupStats = await Promise.all(
        backupDirs.map(async (dir) => {
          const stat = await fs.stat(path.join(this.backupDir, dir));
          return { dir, mtime: stat.mtime };
        })
      );
      
      backupStats.sort((a, b) => a.mtime - b.mtime);
      
      // Remove oldest backups
      const toRemove = backupStats.slice(0, backupStats.length - this.maxBackups);
      
      for (const { dir } of toRemove) {
        try {
          await fs.rmdir(path.join(this.backupDir, dir), { recursive: true });
          console.log(`🗑️ Removed old backup: ${dir}`);
        } catch (error) {
          console.error(`❌ Failed to remove old backup ${dir}:`, error);
        }
      }
      
      console.log(`✅ Cleaned up ${toRemove.length} old backups`);
    } catch (error) {
      console.error('❌ Failed to cleanup old backups:', error);
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const backups = await fs.readdir(this.backupDir);
      const backupInfo = [];
      
      for (const backup of backups) {
        if (backup.startsWith('backup-')) {
          const backupPath = path.join(this.backupDir, backup);
          const stat = await fs.stat(backupPath);
          
          let manifest = null;
          try {
            const manifestPath = path.join(backupPath, 'manifest.json');
            const manifestData = await fs.readFile(manifestPath, 'utf8');
            manifest = JSON.parse(manifestData);
          } catch (error) {
            // Manifest not found
          }
          
          backupInfo.push({
            id: backup,
            createdAt: stat.birthtime,
            modified: stat.mtime,
            size: stat.size,
            manifest
          });
        }
      }
      
      return backupInfo.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Start automated backup schedule
   */
  async startScheduledBackups() {
    console.log('🔄 Starting scheduled backup service...');
    
    // Create initial backup
    await this.createBackup();
    
    // Schedule regular backups
    setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
      }
    }, this.backupInterval);
    
    console.log(`✅ Scheduled backups started (every ${this.backupInterval / (1000 * 60 * 60)} hours)`);
  }

  /**
   * Get backup statistics
   */
  async getBackupStats() {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      
      return {
        totalBackups: backups.length,
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].createdAt : null,
        newestBackup: backups.length > 0 ? backups[0].createdAt : null,
        averageBackupSize: backups.length > 0 ? Math.round(totalSize / backups.length / 1024) : 0
      };
    } catch (error) {
      console.error('❌ Failed to get backup stats:', error);
      return null;
    }
  }
}

module.exports = BackupService; 