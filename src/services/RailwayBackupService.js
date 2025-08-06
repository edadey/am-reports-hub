const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class RailwayBackupService {
  constructor() {
    // Use Railway cloud storage in production, local storage in development
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production') {
      // Railway persistent volume - this survives deployments
      this.railwayDataPath = '/app/data';
      console.log('☁️ Using Railway persistent volume:', this.railwayDataPath);
    } else {
      // Local development storage
      this.railwayDataPath = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data');
      console.log('💻 Using local development storage:', this.railwayDataPath);
    }
    
    this.backupPath = path.join(this.railwayDataPath, 'backups');
    this.dataPath = path.join(this.railwayDataPath, 'data');
    
    // Railway storage limits (Railway provides 10GB by default)
    this.maxBackups = 1000;
    this.maxStorageGB = 9; // Use 9GB, leave 1GB for system
    this.maxStorageBytes = this.maxStorageGB * 1024 * 1024 * 1024;
    
    // Essential files to backup
    this.essentialFiles = [
      'colleges.json',
      'accountManagers.json', 
      'users.json',
      'templates.json',
      'kpis.json',
      'sessions.json',
      'security-logs.json',
      'login-attempts.json',
      'previous-reports.json'
    ];
    
    // Data directories to backup
    this.dataDirectories = [
      'reports',
      'analytics',
      'ai-cache'
    ];
  }

  async initialize() {
    console.log('☁️ Initializing Railway Cloud Backup Service...');
    console.log(`📁 Railway data path: ${this.railwayDataPath}`);
    console.log(`📁 Backup path: ${this.backupPath}`);
    
    try {
      // Ensure Railway volume directories exist
      await fs.ensureDir(this.railwayDataPath);
      await fs.ensureDir(this.dataPath);
      await fs.ensureDir(this.backupPath);
      
      // Create subdirectories
      for (const dir of this.dataDirectories) {
        await fs.ensureDir(path.join(this.dataPath, dir));
      }
      
      // Validate Railway storage
      await this.validateRailwayStorage();
      
      // Migrate data from old locations if needed
      await this.migrateDataIfNeeded();
      
          // Create initial backup if none exist
    const existingBackups = await this.listBackups();
    if (existingBackups.length === 0) {
      console.log('🔄 No Railway backups found, creating initial cloud backup...');
      const backup = await this.createBackup('Initial Railway cloud backup');
      console.log(`✅ Initial backup created: ${backup.backupId}`);
    } else {
      console.log(`✅ Found ${existingBackups.length} existing Railway backups`);
    }
      
      console.log('✅ Railway Cloud Backup Service initialized');
      console.log(`💾 Cloud storage capacity: ${this.maxStorageGB}GB available`);
      console.log(`📦 Max cloud backups: ${this.maxBackups}`);
      
    } catch (error) {
      console.error('❌ Error initializing Railway Cloud Backup Service:', error);
      throw error;
    }
  }

  async migrateDataIfNeeded() {
    try {
      console.log('🔄 Checking for data migration needs...');
      
      // Check if we need to migrate from old data locations
      const oldDataPaths = [
        '/app/data/colleges.json',
        '/app/data/users.json',
        '/app/data/accountManagers.json'
      ];
      
      const railwayDataPaths = [
        path.join(this.dataPath, 'colleges.json'),
        path.join(this.dataPath, 'users.json'),
        path.join(this.dataPath, 'accountManagers.json')
      ];
      
      for (let i = 0; i < oldDataPaths.length; i++) {
        const oldPath = oldDataPaths[i];
        const newPath = railwayDataPaths[i];
        
        const oldExists = await fs.pathExists(oldPath);
        const newExists = await fs.pathExists(newPath);
        
        if (oldExists && !newExists) {
          console.log(`📦 Migrating data from ${oldPath} to ${newPath}`);
          await fs.copy(oldPath, newPath);
        }
      }
      
      console.log('✅ Data migration completed');
    } catch (error) {
      console.error('❌ Error during data migration:', error);
    }
  }

  async validateRailwayStorage() {
    try {
      // Check if we're running on Railway
      if (!process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== 'production') {
        console.log('⚠️ Not running on Railway - using local storage fallback');
        return;
      }
      
      // Check if Railway volume is accessible
      const volumeExists = await fs.pathExists(this.railwayDataPath);
      if (!volumeExists) {
        console.log('⚠️ Railway volume not found, creating directory...');
        await fs.ensureDir(this.railwayDataPath);
      }
      
      // Check if we can write to the volume
      const testFile = path.join(this.railwayDataPath, '.test-write');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      
      // Check available space
      const stats = await fs.stat(this.railwayDataPath);
      console.log(`✅ Railway persistent volume accessible and writable: ${this.formatBytes(stats.size)}`);
      
    } catch (error) {
      console.error('❌ Railway storage validation failed:', error);
      throw error;
    }
  }

  async createBackup(description = 'Railway cloud backup') {
    console.log(`📦 Creating Railway cloud backup: ${description}`);
    
    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();
    const backupDir = path.join(this.backupPath, `backup-${timestamp.replace(/[:.]/g, '-')}-${backupId}`);
    
    console.log(`📁 Backup directory: ${backupDir}`);
    
    try {
      await fs.ensureDir(backupDir);
      
      const manifest = {
        backupId,
        timestamp,
        description,
        files: [],
        metadata: {
          totalSize: 0,
          fileCount: 0,
          directoryCount: 0
        }
      };
      
      // Backup essential files
      for (const filename of this.essentialFiles) {
        const sourcePath = path.join(this.dataPath, filename);
        const destPath = path.join(backupDir, filename);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          const stats = await fs.stat(sourcePath);
          const checksum = await this.calculateChecksum(sourcePath);
          
          manifest.files.push({
            name: filename,
            size: stats.size,
            checksum,
            type: 'file'
          });
          
          manifest.metadata.totalSize += stats.size;
          manifest.metadata.fileCount++;
          
          console.log(`   ✅ ${filename} (${this.formatBytes(stats.size)}, ${this.getFileItemCount(sourcePath)} items)`);
        }
      }
      
      // Backup data directories
      for (const dirname of this.dataDirectories) {
        const sourcePath = path.join(this.dataPath, dirname);
        const destPath = path.join(backupDir, dirname);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          const dirSize = await this.getDirectorySize(sourcePath);
          const fileCount = await this.getDirectoryFileCount(sourcePath);
          
          manifest.files.push({
            name: dirname,
            size: dirSize,
            type: 'directory',
            fileCount
          });
          
          manifest.metadata.totalSize += dirSize;
          manifest.metadata.directoryCount++;
          
          console.log(`   ✅ ${dirname}/ (${this.formatBytes(dirSize)}, ${fileCount} files)`);
        }
      }
      
      // Save backup manifest
      await fs.writeJson(path.join(backupDir, 'backup-info.json'), manifest, { spaces: 2 });
      
      // Cleanup old backups if needed
      await this.cleanupOldBackups();
      
      console.log(`✅ Railway cloud backup created: ${manifest.metadata.fileCount} files, ${this.formatBytes(manifest.metadata.totalSize)}`);
      
      return {
        backupId,
        description,
        timestamp,
        files: manifest.metadata.fileCount,
        size: manifest.metadata.totalSize,
        sizeFormatted: this.formatBytes(manifest.metadata.totalSize)
      };
      
    } catch (error) {
      console.error('❌ Error creating Railway cloud backup:', error);
      throw error;
    }
  }

  async listBackups() {
    const backups = [];
    
    try {
      if (!await fs.pathExists(this.backupPath)) {
        return backups;
      }
      
      const backupDirs = await fs.readdir(this.backupPath);
      
      for (const backupDir of backupDirs) {
        const backupPath = path.join(this.backupPath, backupDir);
        const stats = await fs.stat(backupPath);
        
        if (stats.isDirectory()) {
          const manifestPath = path.join(backupPath, 'backup-info.json');
          
          if (await fs.pathExists(manifestPath)) {
            const manifest = await fs.readJson(manifestPath);
            backups.push({
              backupId: manifest.backupId,
              description: manifest.description,
              timestamp: manifest.timestamp,
              files: manifest.metadata.fileCount,
              size: manifest.metadata.totalSize,
              sizeFormatted: this.formatBytes(manifest.metadata.totalSize),
              directory: backupDir
            });
          }
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return backups;
    } catch (error) {
      console.error('❌ Error listing Railway backups:', error);
      return [];
    }
  }

  async restoreBackup(backupId) {
    console.log(`🔄 Restoring Railway cloud backup: ${backupId}`);
    
    try {
      // Find the backup
      const backups = await this.listBackups();
      const backup = backups.find(b => b.backupId === backupId);
      
      if (!backup) {
        throw new Error(`Railway backup ${backupId} not found`);
      }
      
      // Create backup before restore
      console.log('📦 Creating pre-restore Railway backup...');
      await this.createBackup(`Pre-restore backup for ${backupId}`);
      
      const backupPath = path.join(this.backupPath, backup.directory);
      const manifestPath = path.join(backupPath, 'backup-info.json');
      const manifest = await fs.readJson(manifestPath);
      
      console.log(`   📁 Restoring to: ${this.dataPath}`);
      
      // Restore files
      for (const file of manifest.files) {
        const sourcePath = path.join(backupPath, file.name);
        const destPath = path.join(this.dataPath, file.name);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          console.log(`   ✅ Restored ${file.name}`);
        }
      }
      
      console.log(`✅ Restored ${manifest.files.length} files from Railway backup ${backupId}`);
      
      return {
        success: true,
        restoredFiles: manifest.files.length
      };
      
    } catch (error) {
      console.error('❌ Error restoring Railway backup:', error);
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      
      if (backups.length <= this.maxBackups) {
        return; // No cleanup needed
      }
      
      // Remove oldest backups
      const toRemove = backups.slice(this.maxBackups);
      
      for (const backup of toRemove) {
        const backupPath = path.join(this.backupPath, backup.directory);
        await fs.remove(backupPath);
        console.log(`   🗑️ Removed old Railway backup: ${backup.backupId}`);
      }
      
      console.log(`✅ Cleaned up ${toRemove.length} old Railway backups`);
      
    } catch (error) {
      console.error('❌ Error cleaning up Railway backups:', error);
    }
  }

  async getStorageStats() {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      
      // Get available space (simplified - Railway provides 10GB)
      const availableSpace = this.maxStorageBytes - totalSize;
      const usagePercentage = (totalSize / this.maxStorageBytes) * 100;
      
      return {
        totalBackups: backups.length,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        availableSpace,
        availableSpaceFormatted: this.formatBytes(availableSpace),
        usagePercentage: Math.round(usagePercentage * 100) / 100,
        maxStorageGB: this.maxStorageGB,
        maxBackups: this.maxBackups,
        isRailway: !!(process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production')
      };
    } catch (error) {
      console.error('❌ Error getting Railway storage stats:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        totalSizeFormatted: '0 B',
        availableSpace: this.maxStorageBytes,
        availableSpaceFormatted: this.formatBytes(this.maxStorageBytes),
        usagePercentage: 0,
        maxStorageGB: this.maxStorageGB,
        maxBackups: this.maxBackups,
        isRailway: !!(process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production')
      };
    }
  }

  // Utility methods
  generateBackupId() {
    return crypto.randomBytes(8).toString('hex');
  }

  async calculateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        totalSize += stats.size;
      } else if (stats.isDirectory()) {
        totalSize += await this.getDirectorySize(filePath);
      }
    }
    
    return totalSize;
  }

  async getDirectoryFileCount(dirPath) {
    let fileCount = 0;
    
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        fileCount++;
      } else if (stats.isDirectory()) {
        fileCount += await this.getDirectoryFileCount(filePath);
      }
    }
    
    return fileCount;
  }

  getFileItemCount(filePath) {
    try {
      const data = fs.readJsonSync(filePath);
      return Array.isArray(data) ? data.length : 'object';
    } catch {
      return 'unknown';
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getDataPath() {
    return this.dataPath;
  }

  getBackupPath() {
    return this.backupPath;
  }
}

module.exports = RailwayBackupService; 