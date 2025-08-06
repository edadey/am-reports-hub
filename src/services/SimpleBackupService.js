const fs = require('fs-extra');
const path = require('path');

class SimpleBackupService {
  constructor() {
    this.dataPath = path.join(__dirname, '../../data');
    this.backupPath = path.join(this.dataPath, 'simple-backups');
    
    // Only backup the essential files
    this.essentialFiles = [
      'colleges.json',
      'accountManagers.json',
      'users.json'
    ];
    
    // Backup protection settings
    this.maxBackups = 10; // Keep 10 backups instead of 5
    this.autoBackupOnDataChange = true;
    this.backupBeforeRestore = true;
  }

  async initialize() {
    console.log('📦 Initializing Simple Backup Service...');
    
    try {
      // Create backup directory
      await fs.ensureDir(this.backupPath);
      
      // Validate existing data
      await this.validateExistingData();
      
      // Create initial backup if no backups exist
      const existingBackups = await this.listBackups();
      if (existingBackups.length === 0) {
        console.log('🔄 No backups found, creating initial backup...');
        await this.createBackup();
      }
      
      console.log('✅ Simple Backup Service ready');
    } catch (error) {
      console.error('❌ Error initializing Simple Backup Service:', error);
      // Don't throw - just log the error
    }
  }

  async validateExistingData() {
    console.log('🔍 Validating existing data...');
    
    for (const filename of this.essentialFiles) {
      const filePath = path.join(this.dataPath, filename);
      
      if (await fs.pathExists(filePath)) {
        try {
          const data = await fs.readJson(filePath);
          if (filename === 'colleges.json' && (!Array.isArray(data) || data.length === 0)) {
            console.log(`⚠️ ${filename} is empty or invalid, attempting restoration...`);
            await this.restoreLatestBackup();
            break;
          }
          console.log(`✅ ${filename} validated (${Array.isArray(data) ? data.length : 'object'} items)`);
        } catch (error) {
          console.error(`❌ Error validating ${filename}:`, error.message);
        }
      } else {
        console.log(`⚠️ ${filename} not found`);
      }
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupPath, `backup-${timestamp}`);
    
    console.log(`📦 Creating simple backup: ${timestamp}`);
    console.log(`📁 Backup directory: ${backupDir}`);
    
    try {
      await fs.ensureDir(backupDir);
      
      let backedUpFiles = 0;
      const backupDetails = [];
      
      // Backup only essential files
      for (const filename of this.essentialFiles) {
        const sourcePath = path.join(this.dataPath, filename);
        const destPath = path.join(backupDir, filename);
        
        if (await fs.pathExists(sourcePath)) {
          const stats = await fs.stat(sourcePath);
          
          if (stats.size > 0) {
            await fs.copy(sourcePath, destPath);
            backedUpFiles++;
            
            // Read and validate the backed up data
            const data = await fs.readJson(destPath);
            const itemCount = Array.isArray(data) ? data.length : 'object';
            
            backupDetails.push({
              file: filename,
              size: stats.size,
              items: itemCount
            });
            
            console.log(`   ✅ ${filename} (${this.formatBytes(stats.size)}, ${itemCount} items)`);
          }
        }
      }
      
      // Create backup info file
      const backupInfo = {
        timestamp: new Date().toISOString(),
        files: backedUpFiles,
        backupDir: backupDir,
        details: backupDetails,
        protection: {
          autoBackupOnDataChange: this.autoBackupOnDataChange,
          backupBeforeRestore: this.backupBeforeRestore,
          maxBackups: this.maxBackups
        }
      };
      
      await fs.writeJson(path.join(backupDir, 'backup-info.json'), backupInfo, { spaces: 2 });
      
      console.log(`✅ Simple backup created: ${backedUpFiles} files`);
      
      // Keep only last N backups
      await this.cleanupOldBackups();
      
      return backupInfo;
      
    } catch (error) {
      console.error('❌ Error creating simple backup:', error);
      // Don't throw - just log the error
      return null;
    }
  }

  async restoreLatestBackup() {
    console.log('🔄 Restoring latest backup...');
    
    try {
      const backups = await this.listBackups();
      
      if (backups.length === 0) {
        console.log('⚠️  No backups found');
        return false;
      }
      
      // Get the most recent backup
      const latestBackup = backups[0];
      const backupDir = latestBackup.backupDir;
      
      console.log(`📦 Restoring from: ${latestBackup.timestamp}`);
      
      // Create backup before restore if enabled
      if (this.backupBeforeRestore) {
        console.log('🔄 Creating backup before restore...');
        await this.createBackup();
      }
      
      let restoredFiles = 0;
      
      // Restore essential files
      for (const filename of this.essentialFiles) {
        const sourcePath = path.join(backupDir, filename);
        const destPath = path.join(this.dataPath, filename);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          restoredFiles++;
          console.log(`   ✅ Restored ${filename}`);
        }
      }
      
      console.log(`✅ Restored ${restoredFiles} files from backup`);
      return true;
      
    } catch (error) {
      console.error('❌ Error restoring backup:', error);
      return false;
    }
  }

  async listBackups() {
    try {
      console.log(`📁 Checking backup path: ${this.backupPath}`);
      if (!await fs.pathExists(this.backupPath)) {
        console.log('⚠️  Backup path does not exist');
        return [];
      }
      
      const backupDirs = await fs.readdir(this.backupPath);
      console.log(`📦 Found backup directories: ${backupDirs.length}`);
      const backups = [];
      
      for (const dir of backupDirs) {
        const backupDir = path.join(this.backupPath, dir);
        const stats = await fs.stat(backupDir);
        
        if (stats.isDirectory()) {
          const infoPath = path.join(backupDir, 'backup-info.json');
          
          if (await fs.pathExists(infoPath)) {
            const info = await fs.readJson(infoPath);
            backups.push({
              timestamp: info.timestamp,
              files: info.files,
              backupDir: backupDir,
              details: info.details || [],
              protection: info.protection || {}
            });
          }
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return backups;
    } catch (error) {
      console.error('❌ Error listing backups:', error);
      return [];
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      
      // Keep only the last N backups
      if (backups.length > this.maxBackups) {
        const toRemove = backups.slice(this.maxBackups);
        
        for (const backup of toRemove) {
          await fs.remove(backup.backupDir);
          console.log(`   🗑️  Removed old backup: ${backup.timestamp}`);
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up backups:', error);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Enhanced method to check if we need to restore data
  async checkAndRestoreIfNeeded() {
    try {
      const collegesPath = path.join(this.dataPath, 'colleges.json');
      
      // Check if colleges.json exists and has data
      if (await fs.pathExists(collegesPath)) {
        const colleges = await fs.readJson(collegesPath);
        if (Array.isArray(colleges) && colleges.length > 0) {
          console.log(`✅ Data exists: ${colleges.length} colleges found`);
          return false; // No restoration needed
        }
      }
      
      console.log('⚠️  No college data found - attempting restoration...');
      return await this.restoreLatestBackup();
      
    } catch (error) {
      console.error('❌ Error checking data:', error);
      return false;
    }
  }

  // New method to get backup statistics
  async getBackupStats() {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => {
        return sum + backup.details.reduce((fileSum, file) => fileSum + (file.size || 0), 0);
      }, 0);
      
      return {
        totalBackups: backups.length,
        totalSize: totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
        newestBackup: backups.length > 0 ? backups[0].timestamp : null,
        averageBackupSize: backups.length > 0 ? Math.round(totalSize / backups.length / 1024) : 0
      };
    } catch (error) {
      console.error('❌ Error getting backup stats:', error);
      return null;
    }
  }
}

module.exports = SimpleBackupService; 