const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class DataPersistenceService {
  constructor() {
    // Use Railway's persistent volume storage in production
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production') {
      // Railway cloud storage
      this.persistentDataPath = '/data';
      this.backupPath = path.join(this.persistentDataPath, 'backups');
      this.dataPath = path.join(this.persistentDataPath, 'data');
      console.log('☁️ Using Railway cloud storage:', this.persistentDataPath);
    } else {
      // Local development storage
      this.persistentDataPath = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.am-reports-data');
      this.backupPath = path.join(this.persistentDataPath, 'backups');
      this.dataPath = path.join(this.persistentDataPath, 'data');
      console.log('💻 Using local development storage:', this.persistentDataPath);
    }
    
    // Use full storage capacity - calculate based on available space
    this.maxBackups = 1000; // Allow thousands of backups
    this.maxStorageGB = 9; // Use 9GB out of 10GB (leave 1GB for system)
    this.maxStorageBytes = this.maxStorageGB * 1024 * 1024 * 1024;
    
    // Essential data files that must persist
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
    
    // Data directories to persist
    this.dataDirectories = [
      'reports',
      'analytics',
      'ai-cache'
    ];
  }

  async initialize() {
    console.log('🔄 Initializing Data Persistence Service...');
    console.log(`📁 Persistent data path: ${this.persistentDataPath}`);
    
    try {
      // Create persistent directories
      await fs.ensureDir(this.persistentDataPath);
      await fs.ensureDir(this.dataPath);
      await fs.ensureDir(this.backupPath);
      
      // Create subdirectories
      for (const dir of this.dataDirectories) {
        await fs.ensureDir(path.join(this.dataPath, dir));
      }
      
      // Check if we need to migrate data from app directory
      await this.migrateDataIfNeeded();
      
      // Validate persistent data
      await this.validatePersistentData();
      
      // Create initial backup if none exist
      const existingBackups = await this.listBackups();
      if (existingBackups.length === 0) {
        console.log('🔄 No persistent backups found, creating initial backup...');
        await this.createBackup('Initial persistent backup');
      }
      
      console.log('✅ Data Persistence Service initialized');
      console.log(`💾 Storage capacity: ${this.maxStorageGB}GB available`);
      console.log(`📦 Max backups: ${this.maxBackups}`);
      
    } catch (error) {
      console.error('❌ Error initializing Data Persistence Service:', error);
      throw error;
    }
  }

  async migrateDataIfNeeded() {
    const appDataPath = path.join(__dirname, '../../data');
    
    // Check if app data directory exists and has data
    if (!await fs.pathExists(appDataPath)) {
      console.log('ℹ️ No app data directory found, skipping migration');
      return;
    }
    
    // Check if persistent data already exists
    const hasPersistentData = await this.hasPersistentData();
    if (hasPersistentData) {
      console.log('ℹ️ Persistent data already exists, skipping migration');
      return;
    }
    
    // In Railway production, we're already using the volume, so no migration needed
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production') {
      console.log('☁️ Running on Railway - data already in cloud storage, skipping migration');
      return;
    }
    
    console.log('🔄 Migrating data from app directory to persistent storage...');
    
    try {
      // Migrate essential files
      for (const filename of this.essentialFiles) {
        const sourcePath = path.join(appDataPath, filename);
        const destPath = path.join(this.dataPath, filename);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          console.log(`   ✅ Migrated ${filename}`);
        }
      }
      
      // Migrate data directories
      for (const dir of this.dataDirectories) {
        const sourcePath = path.join(appDataPath, dir);
        const destPath = path.join(this.dataPath, dir);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          console.log(`   ✅ Migrated ${dir}/ directory`);
        }
      }
      
      console.log('✅ Data migration completed');
      
    } catch (error) {
      console.error('❌ Error during data migration:', error);
      throw error;
    }
  }

  async hasPersistentData() {
    try {
      // Check if any essential files exist in persistent storage
      for (const filename of this.essentialFiles) {
        const filePath = path.join(this.dataPath, filename);
        if (await fs.pathExists(filePath)) {
          const stats = await fs.stat(filePath);
          if (stats.size > 0) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async validatePersistentData() {
    console.log('🔍 Validating persistent data...');
    
    let totalFiles = 0;
    let totalSize = 0;
    
    for (const filename of this.essentialFiles) {
      const filePath = path.join(this.dataPath, filename);
      
      if (await fs.pathExists(filePath)) {
        try {
          const stats = await fs.stat(filePath);
          const data = await fs.readJson(filePath);
          
          totalFiles++;
          totalSize += stats.size;
          
          const itemCount = Array.isArray(data) ? data.length : 'object';
          console.log(`   ✅ ${filename}: ${itemCount} items (${this.formatBytes(stats.size)})`);
          
        } catch (error) {
          console.error(`   ❌ Error validating ${filename}:`, error.message);
        }
      } else {
        console.log(`   ⚠️ ${filename} not found in persistent storage`);
      }
    }
    
    console.log(`📊 Persistent data summary: ${totalFiles} files, ${this.formatBytes(totalSize)} total`);
  }

  async createBackup(description = 'Manual backup') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = crypto.randomBytes(8).toString('hex');
    const backupDir = path.join(this.backupPath, `backup-${timestamp}-${backupId}`);
    
    console.log(`📦 Creating persistent backup: ${description}`);
    console.log(`📁 Backup directory: ${backupDir}`);
    
    try {
      await fs.ensureDir(backupDir);
      
      let backedUpFiles = 0;
      let totalSize = 0;
      const backupDetails = [];
      
      // Backup essential files
      for (const filename of this.essentialFiles) {
        const sourcePath = path.join(this.dataPath, filename);
        const destPath = path.join(backupDir, filename);
        
        if (await fs.pathExists(sourcePath)) {
          const stats = await fs.stat(sourcePath);
          
          if (stats.size > 0) {
            await fs.copy(sourcePath, destPath);
            backedUpFiles++;
            totalSize += stats.size;
            
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
      
      // Backup data directories
      for (const dir of this.dataDirectories) {
        const sourcePath = path.join(this.dataPath, dir);
        const destPath = path.join(backupDir, dir);
        
        if (await fs.pathExists(sourcePath)) {
          const stats = await fs.stat(sourcePath);
          
          if (stats.isDirectory()) {
            const files = await fs.readdir(sourcePath);
            
            if (files.length > 0) {
              await fs.copy(sourcePath, destPath);
              backedUpFiles++;
              
              backupDetails.push({
                file: dir,
                size: await this.getDirectorySize(sourcePath),
                items: `${files.length} files`
              });
              
              console.log(`   ✅ ${dir}/ (${files.length} files)`);
            }
          }
        }
      }
      
      // Create backup info file
      const backupInfo = {
        backupId,
        timestamp: new Date().toISOString(),
        description,
        files: backedUpFiles,
        backupDir: backupDir,
        details: backupDetails,
        totalSize,
        storage: {
          maxBackups: this.maxBackups,
          maxStorageGB: this.maxStorageGB,
          maxStorageBytes: this.maxStorageBytes
        }
      };
      
      await fs.writeJson(path.join(backupDir, 'backup-info.json'), backupInfo, { spaces: 2 });
      
      console.log(`✅ Persistent backup created: ${backedUpFiles} files, ${this.formatBytes(totalSize)}`);
      
      // Clean up old backups based on storage limits
      await this.cleanupOldBackups();
      
      return backupInfo;
      
    } catch (error) {
      console.error('❌ Error creating persistent backup:', error);
      throw error;
    }
  }

  async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
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
    } catch (error) {
      console.error(`Error calculating directory size for ${dirPath}:`, error);
    }
    
    return totalSize;
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
              ...info,
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

  async restoreBackup(backupId) {
    console.log(`🔄 Restoring persistent backup: ${backupId}`);
    
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.backupId === backupId);
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      // Create backup before restore
      await this.createBackup(`Pre-restore backup for ${backupId}`);
      
      let restoredFiles = 0;
      
      // Restore essential files
      for (const filename of this.essentialFiles) {
        const sourcePath = path.join(backup.backupDir, filename);
        const destPath = path.join(this.dataPath, filename);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          restoredFiles++;
          console.log(`   ✅ Restored ${filename}`);
        }
      }
      
      // Restore data directories
      for (const dir of this.dataDirectories) {
        const sourcePath = path.join(backup.backupDir, dir);
        const destPath = path.join(this.dataPath, dir);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          restoredFiles++;
          console.log(`   ✅ Restored ${dir}/`);
        }
      }
      
      console.log(`✅ Restored ${restoredFiles} files from backup ${backupId}`);
      return { success: true, restoredFiles };
      
    } catch (error) {
      console.error(`❌ Error restoring backup ${backupId}:`, error);
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      
      if (backups.length <= this.maxBackups) {
        return;
      }
      
      // Calculate total storage used
      let totalStorageUsed = 0;
      for (const backup of backups) {
        totalStorageUsed += backup.totalSize || 0;
      }
      
      // If we're over storage limit, remove oldest backups
      if (totalStorageUsed > this.maxStorageBytes) {
        console.log(`💾 Storage limit exceeded (${this.formatBytes(totalStorageUsed)} > ${this.formatBytes(this.maxStorageBytes)})`);
        
        // Remove oldest backups until under limit
        for (let i = backups.length - 1; i >= 0; i--) {
          const backup = backups[i];
          const backupSize = backup.totalSize || 0;
          
          if (totalStorageUsed > this.maxStorageBytes) {
            await fs.remove(backup.backupDir);
            totalStorageUsed -= backupSize;
            console.log(`   🗑️ Removed old backup: ${backup.backupId} (${this.formatBytes(backupSize)})`);
          } else {
            break;
          }
        }
      }
      
      // Also remove if we have too many backups
      if (backups.length > this.maxBackups) {
        const toRemove = backups.slice(this.maxBackups);
        
        for (const backup of toRemove) {
          await fs.remove(backup.backupDir);
          console.log(`   🗑️ Removed old backup: ${backup.backupId}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up old backups:', error);
    }
  }

  async getStorageStats() {
    try {
      const backups = await this.listBackups();
      let totalSize = 0;
      
      for (const backup of backups) {
        totalSize += backup.totalSize || 0;
      }
      
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
        maxBackups: this.maxBackups
      };
    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      return null;
    }
  }

  // Get data path for other services to use
  getDataPath() {
    return this.dataPath;
  }

  // Get backup path for other services to use
  getBackupPath() {
    return this.backupPath;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = DataPersistenceService; 