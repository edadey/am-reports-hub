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
  }

  async initialize() {
    console.log('📦 Initializing Simple Backup Service...');
    
    try {
      // Create backup directory
      await fs.ensureDir(this.backupPath);
      console.log('✅ Simple Backup Service ready');
    } catch (error) {
      console.error('❌ Error initializing Simple Backup Service:', error);
      // Don't throw - just log the error
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupPath, `backup-${timestamp}`);
    
    console.log(`📦 Creating simple backup: ${timestamp}`);
    
    try {
      await fs.ensureDir(backupDir);
      
      let backedUpFiles = 0;
      
      // Backup only essential files
      for (const filename of this.essentialFiles) {
        const sourcePath = path.join(this.dataPath, filename);
        const destPath = path.join(backupDir, filename);
        
        if (await fs.pathExists(sourcePath)) {
          const stats = await fs.stat(sourcePath);
          
          if (stats.size > 0) {
            await fs.copy(sourcePath, destPath);
            backedUpFiles++;
            console.log(`   ✅ ${filename} (${this.formatBytes(stats.size)})`);
          }
        }
      }
      
      // Create backup info file
      const backupInfo = {
        timestamp: new Date().toISOString(),
        files: backedUpFiles,
        backupDir: backupDir
      };
      
      await fs.writeJson(path.join(backupDir, 'backup-info.json'), backupInfo, { spaces: 2 });
      
      console.log(`✅ Simple backup created: ${backedUpFiles} files`);
      
      // Keep only last 5 backups
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
      if (!await fs.pathExists(this.backupPath)) {
        return [];
      }
      
      const backupDirs = await fs.readdir(this.backupPath);
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
              backupDir: backupDir
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
      
      // Keep only the last 5 backups
      if (backups.length > 5) {
        const toRemove = backups.slice(5);
        
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

  // Simple method to check if we need to restore data
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
}

module.exports = SimpleBackupService; 