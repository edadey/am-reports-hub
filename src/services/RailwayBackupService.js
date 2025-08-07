const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class RailwayBackupService {
  constructor() {
    // Enhanced Railway detection - check multiple indicators
    const isRailway = this.isRailwayEnvironment();
    
    if (isRailway) {
      // Railway persistent volume - try multiple common paths
      const possiblePaths = [
        process.env.PERSISTENT_STORAGE_PATH,
        '/data',
        '/app/data',
        './data'
      ].filter(Boolean);
      
      this.railwayDataPath = possiblePaths[0] || '/data';
      console.log('☁️ Using Railway persistent volume:', this.railwayDataPath);
      console.log('☁️ Available storage paths:', possiblePaths);
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
      
      // Create and migrate subdirectories
      const appDataPath = path.join(process.cwd(), 'data');
      for (const dir of this.dataDirectories) {
        const appDirPath = path.join(appDataPath, dir);
        const railwayDirPath = path.join(this.dataPath, dir);
        
        await fs.ensureDir(railwayDirPath);
        
        // Migrate directory contents if app directory exists
        if (await fs.pathExists(appDirPath)) {
          console.log(`📦 Migrating directory: ${dir}`);
          await fs.copy(appDirPath, railwayDirPath);
        }
      }
      
      // Validate Railway storage
      await this.validateRailwayStorage();
      
      // Migrate data from old locations if needed
      await this.migrateDataIfNeeded();
      
          // Check for existing backups and restore if needed
      const existingBackups = await this.listBackups();
      if (existingBackups.length === 0) {
        console.log('🔄 No Railway backups found, creating initial cloud backup...');
        const backup = await this.createBackup('Initial Railway cloud backup');
        console.log(`✅ Initial backup created: ${backup.backupId}`);
      } else {
        console.log(`✅ Found ${existingBackups.length} existing Railway backups`);
        
        // Check if database is empty and restore from latest backup
        await this.restoreFromLatestBackupIfNeeded();
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
      
      // Check if we need to migrate from app data locations
      const appDataPath = path.join(process.cwd(), 'data');
      const oldDataPaths = [
        path.join(appDataPath, 'colleges.json'),
        path.join(appDataPath, 'users.json'),
        path.join(appDataPath, 'accountManagers.json'),
        path.join(appDataPath, 'templates.json'),
        path.join(appDataPath, 'kpis.json'),
        path.join(appDataPath, 'sessions.json'),
        path.join(appDataPath, 'security-logs.json'),
        path.join(appDataPath, 'login-attempts.json'),
        path.join(appDataPath, 'previous-reports.json')
      ];
      
      const railwayDataPaths = [
        path.join(this.dataPath, 'colleges.json'),
        path.join(this.dataPath, 'users.json'),
        path.join(this.dataPath, 'accountManagers.json'),
        path.join(this.dataPath, 'templates.json'),
        path.join(this.dataPath, 'kpis.json'),
        path.join(this.dataPath, 'sessions.json'),
        path.join(this.dataPath, 'security-logs.json'),
        path.join(this.dataPath, 'login-attempts.json'),
        path.join(this.dataPath, 'previous-reports.json')
      ];
      
      let migratedCount = 0;
      for (let i = 0; i < oldDataPaths.length; i++) {
        const oldPath = oldDataPaths[i];
        const newPath = railwayDataPaths[i];
        
        const oldExists = await fs.pathExists(oldPath);
        const newExists = await fs.pathExists(newPath);
        
        if (oldExists && !newExists) {
          console.log(`📦 Migrating data from ${oldPath} to ${newPath}`);
          await fs.copy(oldPath, newPath);
          migratedCount++;
        }
      }
      
      console.log(`✅ Data migration completed: ${migratedCount} files migrated`);
    } catch (error) {
      console.error('❌ Error during data migration:', error);
    }
  }

  async validateRailwayStorage() {
    try {
      console.log(`🔍 Validating Railway storage at: ${this.railwayDataPath}`);
      
      // Ensure Railway data directory exists
      await fs.ensureDir(this.railwayDataPath);
      console.log(`✅ Railway data directory ensured: ${this.railwayDataPath}`);
      
      // Check if we can write to the volume
      const testFile = path.join(this.railwayDataPath, '.test-write');
      await fs.writeFile(testFile, `test-${Date.now()}`);
      const testContent = await fs.readFile(testFile, 'utf8');
      await fs.remove(testFile);
      
      if (!testContent.startsWith('test-')) {
        throw new Error('Write test verification failed');
      }
      
      console.log(`✅ Railway persistent volume accessible and writable`);
      
    } catch (error) {
      console.error('❌ Railway storage validation failed:', error);
      console.error('   This might be due to insufficient permissions or missing persistent storage');
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
      
      // Backup database data if DATABASE_URL is available
      if (process.env.DATABASE_URL) {
        console.log('🗄️ Backing up database data...');
        await this.backupDatabaseData(backupDir, manifest);
      }
      
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
      
      // Optional: Create backup before restore (commented out to prevent multiple backups)
      // console.log('📦 Creating pre-restore Railway backup...');
      // await this.createBackup(`Pre-restore backup for ${backupId}`);
      
      const backupPath = path.join(this.backupPath, backup.directory);
      const manifestPath = path.join(backupPath, 'backup-info.json');
      const manifest = await fs.readJson(manifestPath);
      
      console.log(`   📁 Restoring to: ${this.dataPath}`);
      
      // Restore files and database data
      for (const file of manifest.files) {
        const sourcePath = path.join(backupPath, file.name);
        
        if (await fs.pathExists(sourcePath)) {
          if (file.type === 'database') {
            // Restore database data
            await this.restoreDatabaseData(file.name, sourcePath);
            console.log(`   ✅ Restored database: ${file.name} (${file.recordCount} records)`);
          } else {
            // Restore regular files
            const destPath = path.join(this.dataPath, file.name);
            await fs.copy(sourcePath, destPath);
            console.log(`   ✅ Restored ${file.name}`);
          }
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

  async restoreDatabaseData(filename, sourcePath) {
    try {
      const DatabaseUserManager = require('./DatabaseUserManager');
      await DatabaseUserManager.initialize();
      
      const data = await fs.readJson(sourcePath);
      
      if (filename === 'colleges.json') {
        // Clear existing colleges and restore from backup
        const existingColleges = await DatabaseUserManager.getColleges();
        for (const college of existingColleges) {
          await DatabaseUserManager.deleteCollege(college.id);
        }
        
        // Restore colleges from backup
        for (const college of data) {
          await DatabaseUserManager.createCollege(college);
        }
      } else if (filename === 'accountManagers.json') {
        // Clear existing account managers and restore from backup
        const existingManagers = await DatabaseUserManager.getAccountManagers();
        for (const manager of existingManagers) {
          await DatabaseUserManager.deleteAccountManager(manager.id);
        }
        
        // Restore account managers from backup
        for (const manager of data) {
          await DatabaseUserManager.createAccountManager(manager);
        }
      } else if (filename === 'users.json') {
        // Note: We don't restore users to avoid overwriting admin accounts
        console.log(`   ⚠️ Skipping user restore to preserve admin accounts`);
      }
      
    } catch (error) {
      console.error(`❌ Error restoring database data from ${filename}:`, error);
      throw error;
    }
  }

  async restoreFromLatestBackupIfNeeded() {
    try {
      console.log('🔄 Checking if database restoration is needed...');
      
      const DatabaseUserManager = require('./DatabaseUserManager');
      await DatabaseUserManager.initialize();
      
      // Check if database has data
      const colleges = await DatabaseUserManager.getColleges();
      const accountManagers = await DatabaseUserManager.getAccountManagers();
      
      // If database has data, no restoration needed
      if (colleges.length > 0 || accountManagers.length > 0) {
        console.log(`✅ Database has data (${colleges.length} colleges, ${accountManagers.length} managers) - no restoration needed`);
        return;
      }
      
      // Database is empty, restore from latest backup
      const existingBackups = await this.listBackups();
      if (existingBackups.length === 0) {
        console.log('ℹ️ No backups available for restoration');
        return;
      }
      
      // Get the most recent backup
      const latestBackup = existingBackups[0]; // Backups are sorted by timestamp desc
      console.log(`🔄 Database is empty, restoring from latest backup: ${latestBackup.backupId}`);
      
      // Restore the backup
      await this.restoreBackup(latestBackup.backupId);
      console.log('✅ Database restored from latest backup');
      
    } catch (error) {
      console.error('❌ Error during automatic backup restoration:', error);
      // Don't throw error - this is a recovery mechanism, shouldn't break the app
    }
  }

  async backupDatabaseData(backupDir, manifest) {
    try {
      const DatabaseUserManager = require('./DatabaseUserManager');
      await DatabaseUserManager.initialize();
      
      // Backup colleges
      const colleges = await DatabaseUserManager.getColleges();
      const collegesPath = path.join(backupDir, 'colleges.json');
      await fs.writeJson(collegesPath, colleges, { spaces: 2 });
      const collegesStats = await fs.stat(collegesPath);
      
      manifest.files.push({
        name: 'colleges.json',
        size: collegesStats.size,
        type: 'database',
        recordCount: colleges.length
      });
      manifest.metadata.totalSize += collegesStats.size;
      manifest.metadata.fileCount++;
      
      console.log(`   ✅ colleges.json (${this.formatBytes(collegesStats.size)}, ${colleges.length} colleges)`);
      
      // Backup account managers
      const accountManagers = await DatabaseUserManager.getAccountManagers();
      const accountManagersPath = path.join(backupDir, 'accountManagers.json');
      await fs.writeJson(accountManagersPath, accountManagers, { spaces: 2 });
      const accountManagersStats = await fs.stat(accountManagersPath);
      
      manifest.files.push({
        name: 'accountManagers.json',
        size: accountManagersStats.size,
        type: 'database',
        recordCount: accountManagers.length
      });
      manifest.metadata.totalSize += accountManagersStats.size;
      manifest.metadata.fileCount++;
      
      console.log(`   ✅ accountManagers.json (${this.formatBytes(accountManagersStats.size)}, ${accountManagers.length} managers)`);
      
      // Backup users
      const users = await DatabaseUserManager.getUsers();
      const usersPath = path.join(backupDir, 'users.json');
      await fs.writeJson(usersPath, users, { spaces: 2 });
      const usersStats = await fs.stat(usersPath);
      
      manifest.files.push({
        name: 'users.json',
        size: usersStats.size,
        type: 'database',
        recordCount: users.length
      });
      manifest.metadata.totalSize += usersStats.size;
      manifest.metadata.fileCount++;
      
      console.log(`   ✅ users.json (${this.formatBytes(usersStats.size)}, ${users.length} users)`);
      
    } catch (error) {
      console.error('❌ Error backing up database data:', error);
      throw error;
    }
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

  isRailwayEnvironment() {
    // Simplified Railway environment detection using key Railway-specific variables
    const isRailway = !!(
      process.env.RAILWAY_SERVICE_NAME || 
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_ENVIRONMENT
    );
    
    console.log('🔍 Railway Environment Detection:');
    console.log(`   RAILWAY_SERVICE_NAME: ${process.env.RAILWAY_SERVICE_NAME || 'Not set'}`);
    console.log(`   RAILWAY_PROJECT_ID: ${process.env.RAILWAY_PROJECT_ID || 'Not set'}`);
    console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'Not set'}`);
    console.log(`   Is Railway: ${isRailway}`);
    
    return isRailway;
  }
}

module.exports = RailwayBackupService; 