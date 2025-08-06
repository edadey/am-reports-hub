const fs = require('fs-extra');
const path = require('path');

class DataPreservationService {
  constructor(volumeService = null) {
    this.volumeService = volumeService;
    this.dataPath = volumeService ? '/app/data' : path.join(__dirname, '../../data');
    this.backupPath = path.join(this.dataPath, 'backups');
  }

  async initializeDataPreservation() {
    console.log('🔄 Initializing Data Preservation Service...');
    
    try {
      // Ensure backup directory exists
      await fs.ensureDir(this.backupPath);
      
      // Check if we're in production (Railway)
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
      
      if (isProduction) {
        console.log('🌍 Production environment detected - preserving existing data');
        await this.preserveProductionData();
      } else {
        console.log('💻 Development environment - using local data');
        await this.initializeDevelopmentData();
      }
      
      console.log('✅ Data Preservation Service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Data Preservation Service:', error);
      throw error;
    }
  }

  async preserveProductionData() {
    console.log('🛡️ Preserving production data...');
    
    const dataFiles = [
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
    ];

    for (const file of dataFiles) {
      await this.preserveFile(file);
    }

    // Preserve reports directory
    await this.preserveDirectory('reports');
    await this.preserveDirectory('analytics');
    await this.preserveDirectory('ai-cache');
  }

  async preserveFile(filename) {
    const filePath = path.join(this.dataPath, filename);
    const backupPath = path.join(this.backupPath, `${filename}.backup`);
    
    try {
      // Check if file exists and has content
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          // Backup existing data
          await fs.copy(filePath, backupPath);
          console.log(`   ✅ Preserved ${filename} (${stats.size} bytes)`);
        } else {
          console.log(`   ⚠️  ${filename} exists but is empty`);
        }
      } else {
        console.log(`   ℹ️  ${filename} does not exist - will be created`);
      }
    } catch (error) {
      console.log(`   ❌ Error preserving ${filename}:`, error.message);
    }
  }

  async preserveDirectory(dirname) {
    const dirPath = path.join(this.dataPath, dirname);
    const backupPath = path.join(this.backupPath, dirname);
    
    try {
      if (await fs.pathExists(dirPath)) {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          // Check if directory has files
          const files = await fs.readdir(dirPath);
          if (files.length > 0) {
            // Backup existing directory
            await fs.copy(dirPath, backupPath);
            console.log(`   ✅ Preserved ${dirname}/ directory (${files.length} files)`);
          } else {
            console.log(`   ℹ️  ${dirname}/ directory exists but is empty`);
          }
        }
      } else {
        console.log(`   ℹ️  ${dirname}/ directory does not exist - will be created`);
      }
    } catch (error) {
      console.log(`   ❌ Error preserving ${dirname}/:`, error.message);
    }
  }

  async restoreData() {
    console.log('🔄 Restoring preserved data...');
    
    const dataFiles = [
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
    ];

    for (const file of dataFiles) {
      await this.restoreFile(file);
    }

    // Restore directories
    await this.restoreDirectory('reports');
    await this.restoreDirectory('analytics');
    await this.restoreDirectory('ai-cache');
  }

  async restoreFile(filename) {
    const filePath = path.join(this.dataPath, filename);
    const backupPath = path.join(this.backupPath, `${filename}.backup`);
    
    try {
      // Check if we have a backup and the current file is empty or doesn't exist
      if (await fs.pathExists(backupPath)) {
        const backupStats = await fs.stat(backupPath);
        
        if (backupStats.size > 0) {
          // Check if current file exists and has content
          let shouldRestore = false;
          
          if (await fs.pathExists(filePath)) {
            const currentStats = await fs.stat(filePath);
            shouldRestore = currentStats.size === 0;
          } else {
            shouldRestore = true;
          }
          
          if (shouldRestore) {
            await fs.copy(backupPath, filePath);
            console.log(`   ✅ Restored ${filename} from backup`);
          } else {
            console.log(`   ℹ️  ${filename} already has data - keeping current version`);
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error restoring ${filename}:`, error.message);
    }
  }

  async restoreDirectory(dirname) {
    const dirPath = path.join(this.dataPath, dirname);
    const backupPath = path.join(this.backupPath, dirname);
    
    try {
      if (await fs.pathExists(backupPath)) {
        const backupStats = await fs.stat(backupPath);
        
        if (backupStats.isDirectory()) {
          const backupFiles = await fs.readdir(backupPath);
          
          if (backupFiles.length > 0) {
            // Check if current directory exists and has files
            let shouldRestore = false;
            
            if (await fs.pathExists(dirPath)) {
              const currentFiles = await fs.readdir(dirPath);
              shouldRestore = currentFiles.length === 0;
            } else {
              shouldRestore = true;
            }
            
            if (shouldRestore) {
              await fs.copy(backupPath, dirPath);
              console.log(`   ✅ Restored ${dirname}/ directory from backup (${backupFiles.length} files)`);
            } else {
              console.log(`   ℹ️  ${dirname}/ directory already has data - keeping current version`);
            }
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error restoring ${dirname}/:`, error.message);
    }
  }

  async initializeDevelopmentData() {
    console.log('💻 Initializing development data...');
    
    // Copy sample data files if they don't exist
    const sampleFiles = [
      { source: 'sample-colleges.json', target: 'colleges.json' },
      { source: 'sample-accountManagers.json', target: 'accountManagers.json' }
    ];

    for (const { source, target } of sampleFiles) {
      const sourcePath = path.join(this.dataPath, source);
      const targetPath = path.join(this.dataPath, target);
      
      if (await fs.pathExists(sourcePath) && !await fs.pathExists(targetPath)) {
        await fs.copy(sourcePath, targetPath);
        console.log(`   ✅ Copied ${source} to ${target}`);
      } else if (!await fs.pathExists(targetPath)) {
        // Create empty file if no sample exists
        await fs.writeFile(targetPath, '[]');
        console.log(`   ✅ Created ${target} with empty array`);
      }
    }

    // Create other required files if they don't exist
    const defaultFiles = {
      'users.json': '[]',
      'sessions.json': '[]',
      'security-logs.json': '[]',
      'login-attempts.json': '[]',
      'performance-report.json': '{}',
      'previous-reports.json': '[]',
      'kpis.json': '[]',
      'templates.json': '[]'
    };

    for (const [filename, defaultContent] of Object.entries(defaultFiles)) {
      const filePath = path.join(this.dataPath, filename);
      
      if (!await fs.pathExists(filePath)) {
        await fs.writeFile(filePath, defaultContent);
        console.log(`   ✅ Created ${filename} with default content`);
      }
    }

    // Create directories if they don't exist
    const directories = ['reports', 'analytics', 'ai-cache', 'backups'];
    
    for (const dir of directories) {
      const dirPath = path.join(this.dataPath, dir);
      await fs.ensureDir(dirPath);
      console.log(`   ✅ Ensured ${dir}/ directory exists`);
    }
  }

  async createDataBackup() {
    console.log('💾 Creating data backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupPath, `backup-${timestamp}`);
    
    try {
      await fs.ensureDir(backupDir);
      
      // Copy all data files to backup
      const dataFiles = await fs.readdir(this.dataPath);
      
      for (const file of dataFiles) {
        const sourcePath = path.join(this.dataPath, file);
        const destPath = path.join(backupDir, file);
        
        const stats = await fs.stat(sourcePath);
        if (stats.isFile()) {
          await fs.copy(sourcePath, destPath);
        } else if (stats.isDirectory()) {
          await fs.copy(sourcePath, destPath);
        }
      }
      
      console.log(`✅ Backup created: ${backupDir}`);
      return backupDir;
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw error;
    }
  }
}

module.exports = DataPreservationService; 