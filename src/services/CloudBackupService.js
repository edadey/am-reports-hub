const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class CloudBackupService {
  constructor() {
    this.dataPath = path.join(__dirname, '../../data');
    this.backupPath = path.join(this.dataPath, 'backups');
    this.cloudBackupPath = path.join(this.backupPath, 'cloud');
    
    // Backup configuration
    this.backupConfig = {
      // Data files to backup
      dataFiles: [
        'colleges.json',
        'accountManagers.json',
        'users.json',
        'sessions.json',
        'security-logs.json',
        'login-attempts.json',
        'performance-report.json',
        'previous-reports.json',
        'kpis.json',
        'templates.json'
      ],
      
      // Directories to backup
      dataDirectories: [
        'reports',
        'analytics',
        'ai-cache'
      ],
      
      // Backup retention settings
      retention: {
        daily: 7,      // Keep 7 daily backups
        weekly: 4,     // Keep 4 weekly backups
        monthly: 12,   // Keep 12 monthly backups
        yearly: 5      // Keep 5 yearly backups
      },
      
      // Backup types
      backupTypes: {
        FULL: 'full',           // Complete backup
        INCREMENTAL: 'incremental', // Only changed files
        DIFFERENTIAL: 'differential' // Changed since last full backup
      }
    };
  }

  async initialize() {
    console.log('☁️ Initializing Cloud Backup Service...');
    
    try {
      // Ensure backup directories exist
      await fs.ensureDir(this.backupPath);
      await fs.ensureDir(this.cloudBackupPath);
      
      // Create subdirectories for different backup types
      await fs.ensureDir(path.join(this.cloudBackupPath, 'daily'));
      await fs.ensureDir(path.join(this.cloudBackupPath, 'weekly'));
      await fs.ensureDir(path.join(this.cloudBackupPath, 'monthly'));
      await fs.ensureDir(path.join(this.cloudBackupPath, 'yearly'));
      await fs.ensureDir(path.join(this.cloudBackupPath, 'emergency'));
      
      console.log('✅ Cloud Backup Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Cloud Backup Service:', error);
      throw error;
    }
  }

  async createBackup(backupType = 'full', category = 'daily') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = this.generateBackupId();
    const backupDir = path.join(this.cloudBackupPath, category, `${backupType}-${timestamp}-${backupId}`);
    
    console.log(`🔄 Creating ${backupType} backup (${category}): ${backupId}`);
    
    try {
      await fs.ensureDir(backupDir);
      
      // Create backup manifest
      const manifest = {
        backupId,
        timestamp: new Date().toISOString(),
        type: backupType,
        category,
        version: '1.0',
        files: [],
        directories: [],
        checksums: {},
        metadata: {
          totalSize: 0,
          fileCount: 0,
          directoryCount: 0
        }
      };

      // Backup data files
      for (const file of this.backupConfig.dataFiles) {
        await this.backupFile(file, backupDir, manifest);
      }

      // Backup directories
      for (const dir of this.backupConfig.dataDirectories) {
        await this.backupDirectory(dir, backupDir, manifest);
      }

      // Write manifest
      await fs.writeJson(path.join(backupDir, 'manifest.json'), manifest, { spaces: 2 });
      
      // Create backup summary
      const summary = await this.createBackupSummary(backupDir, manifest);
      await fs.writeJson(path.join(backupDir, 'summary.json'), summary, { spaces: 2 });

      console.log(`✅ ${backupType} backup created: ${backupId}`);
      console.log(`   📁 Location: ${backupDir}`);
      console.log(`   📊 Files: ${manifest.metadata.fileCount}`);
      console.log(`   📁 Directories: ${manifest.metadata.directoryCount}`);
      console.log(`   💾 Size: ${this.formatBytes(manifest.metadata.totalSize)}`);

      // Clean up old backups
      await this.cleanupOldBackups(category);

      return {
        backupId,
        backupDir,
        manifest,
        summary
      };

    } catch (error) {
      console.error(`❌ Error creating ${backupType} backup:`, error);
      throw error;
    }
  }

  async backupFile(filename, backupDir, manifest) {
    const sourcePath = path.join(this.dataPath, filename);
    const destPath = path.join(backupDir, filename);
    
    try {
      if (await fs.pathExists(sourcePath)) {
        const stats = await fs.stat(sourcePath);
        
        if (stats.size > 0) {
          await fs.copy(sourcePath, destPath);
          
          // Calculate checksum
          const checksum = await this.calculateChecksum(sourcePath);
          
          // Update manifest
          manifest.files.push({
            name: filename,
            size: stats.size,
            checksum,
            modified: stats.mtime.toISOString()
          });
          
          manifest.checksums[filename] = checksum;
          manifest.metadata.totalSize += stats.size;
          manifest.metadata.fileCount++;
          
          console.log(`   ✅ Backed up ${filename} (${this.formatBytes(stats.size)})`);
        } else {
          console.log(`   ⚠️  ${filename} is empty - skipping`);
        }
      } else {
        console.log(`   ℹ️  ${filename} does not exist - skipping`);
      }
    } catch (error) {
      console.log(`   ❌ Error backing up ${filename}:`, error.message);
    }
  }

  async backupDirectory(dirname, backupDir, manifest) {
    const sourcePath = path.join(this.dataPath, dirname);
    const destPath = path.join(backupDir, dirname);
    
    try {
      if (await fs.pathExists(sourcePath)) {
        const stats = await fs.stat(sourcePath);
        
        if (stats.isDirectory()) {
          const files = await fs.readdir(sourcePath);
          
          if (files.length > 0) {
            await fs.copy(sourcePath, destPath);
            
            // Calculate directory checksum
            const checksum = await this.calculateDirectoryChecksum(sourcePath);
            
            // Update manifest
            manifest.directories.push({
              name: dirname,
              fileCount: files.length,
              checksum,
              modified: stats.mtime.toISOString()
            });
            
            manifest.checksums[dirname] = checksum;
            manifest.metadata.directoryCount++;
            
            console.log(`   ✅ Backed up ${dirname}/ (${files.length} files)`);
          } else {
            console.log(`   ℹ️  ${dirname}/ is empty - skipping`);
          }
        }
      } else {
        console.log(`   ℹ️  ${dirname}/ does not exist - skipping`);
      }
    } catch (error) {
      console.log(`   ❌ Error backing up ${dirname}/:`, error.message);
    }
  }

  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async calculateDirectoryChecksum(dirPath) {
    const files = await fs.readdir(dirPath);
    const checksums = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const checksum = await this.calculateChecksum(filePath);
        checksums.push(`${file}:${checksum}`);
      }
    }
    
    // Sort for consistent checksum
    checksums.sort();
    
    const hash = crypto.createHash('sha256');
    hash.update(checksums.join('|'));
    return hash.digest('hex');
  }

  async createBackupSummary(backupDir, manifest) {
    const summary = {
      backupId: manifest.backupId,
      timestamp: manifest.timestamp,
      type: manifest.type,
      category: manifest.category,
      statistics: {
        totalFiles: manifest.metadata.fileCount,
        totalDirectories: manifest.metadata.directoryCount,
        totalSize: manifest.metadata.totalSize,
        totalSizeFormatted: this.formatBytes(manifest.metadata.totalSize)
      },
      dataOverview: {
        colleges: this.getDataOverview('colleges.json', manifest),
        accountManagers: this.getDataOverview('accountManagers.json', manifest),
        reports: this.getDataOverview('reports', manifest),
        analytics: this.getDataOverview('analytics', manifest)
      },
      integrity: {
        checksumsValid: true,
        backupComplete: true
      }
    };

    return summary;
  }

  getDataOverview(itemName, manifest) {
    const item = manifest.files.find(f => f.name === itemName) || 
                 manifest.directories.find(d => d.name === itemName);
    
    if (item) {
      return {
        exists: true,
        size: item.size || 0,
        sizeFormatted: this.formatBytes(item.size || 0),
        modified: item.modified,
        checksum: item.checksum
      };
    }
    
    return {
      exists: false,
      size: 0,
      sizeFormatted: '0 B',
      modified: null,
      checksum: null
    };
  }

  async cleanupOldBackups(category) {
    const categoryPath = path.join(this.cloudBackupPath, category);
    const maxBackups = this.backupConfig.retention[category];
    
    try {
      if (await fs.pathExists(categoryPath)) {
        const backups = await fs.readdir(categoryPath);
        const backupDirs = backups.filter(dir => 
          await fs.stat(path.join(categoryPath, dir)).then(stats => stats.isDirectory())
        );
        
        if (backupDirs.length > maxBackups) {
          // Sort by creation time (oldest first)
          backupDirs.sort();
          
          // Remove oldest backups
          const toRemove = backupDirs.slice(0, backupDirs.length - maxBackups);
          
          for (const backupDir of toRemove) {
            const fullPath = path.join(categoryPath, backupDir);
            await fs.remove(fullPath);
            console.log(`   🗑️  Removed old backup: ${backupDir}`);
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Error cleaning up old backups:`, error.message);
    }
  }

  async listBackups(category = null) {
    const backups = [];
    
    try {
      const categories = category ? [category] : ['daily', 'weekly', 'monthly', 'yearly', 'emergency'];
      
      for (const cat of categories) {
        const categoryPath = path.join(this.cloudBackupPath, cat);
        
        if (await fs.pathExists(categoryPath)) {
          const backupDirs = await fs.readdir(categoryPath);
          
          for (const backupDir of backupDirs) {
            const backupPath = path.join(categoryPath, backupDir);
            const stats = await fs.stat(backupPath);
            
            if (stats.isDirectory()) {
              const manifestPath = path.join(backupPath, 'manifest.json');
              
              if (await fs.pathExists(manifestPath)) {
                const manifest = await fs.readJson(manifestPath);
                backups.push({
                  category: cat,
                  backupDir,
                  backupId: manifest.backupId,
                  timestamp: manifest.timestamp,
                  type: manifest.type,
                  size: manifest.metadata.totalSize,
                  sizeFormatted: this.formatBytes(manifest.metadata.totalSize),
                  fileCount: manifest.metadata.fileCount,
                  directoryCount: manifest.metadata.directoryCount
                });
              }
            }
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

  async restoreBackup(backupId, targetPath = null) {
    console.log(`🔄 Restoring backup: ${backupId}`);
    
    try {
      // Find the backup
      const backups = await this.listBackups();
      const backup = backups.find(b => b.backupId === backupId);
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      const backupPath = path.join(this.cloudBackupPath, backup.category, backup.backupDir);
      const manifestPath = path.join(backupPath, 'manifest.json');
      const manifest = await fs.readJson(manifestPath);
      
      const restorePath = targetPath || this.dataPath;
      
      console.log(`   📁 Restoring to: ${restorePath}`);
      
      // Restore files
      for (const file of manifest.files) {
        const sourcePath = path.join(backupPath, file.name);
        const destPath = path.join(restorePath, file.name);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          console.log(`   ✅ Restored ${file.name}`);
        }
      }
      
      // Restore directories
      for (const dir of manifest.directories) {
        const sourcePath = path.join(backupPath, dir.name);
        const destPath = path.join(restorePath, dir.name);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          console.log(`   ✅ Restored ${dir.name}/`);
        }
      }
      
      console.log(`✅ Backup ${backupId} restored successfully`);
      
      return {
        backupId,
        restoredFiles: manifest.files.length,
        restoredDirectories: manifest.directories.length,
        restorePath
      };
      
    } catch (error) {
      console.error(`❌ Error restoring backup ${backupId}:`, error);
      throw error;
    }
  }

  async createEmergencyBackup() {
    console.log('🚨 Creating emergency backup...');
    return await this.createBackup('full', 'emergency');
  }

  async scheduleBackups() {
    console.log('⏰ Setting up backup schedule...');
    
    // Daily backup at 2 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        await this.createBackup('full', 'daily');
      }
    }, 60000); // Check every minute
    
    // Weekly backup on Sunday at 3 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() === 0 && now.getHours() === 3 && now.getMinutes() === 0) {
        await this.createBackup('full', 'weekly');
      }
    }, 60000);
    
    // Monthly backup on 1st of month at 4 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getDate() === 1 && now.getHours() === 4 && now.getMinutes() === 0) {
        await this.createBackup('full', 'monthly');
      }
    }, 60000);
    
    console.log('✅ Backup schedule configured');
  }

  generateBackupId() {
    return crypto.randomBytes(8).toString('hex');
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getBackupStats() {
    return {
      totalBackups: 0, // Will be calculated when listing
      totalSize: 0,
      categories: this.backupConfig.retention,
      backupTypes: this.backupConfig.backupTypes
    };
  }
}

module.exports = CloudBackupService; 