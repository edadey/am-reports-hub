const fs = require('fs-extra');
const path = require('path');

async function migrateBackups() {
  console.log('🔄 Starting backup migration...');
  
  const sourceDir = path.join(__dirname, 'data/backups');
  const targetDir = path.join(__dirname, 'data/simple-backups');
  
  try {
    // Check if source directory exists
    if (!await fs.pathExists(sourceDir)) {
      console.log('⚠️ Source backup directory does not exist');
      return;
    }
    
    // Create target directory if it doesn't exist
    await fs.ensureDir(targetDir);
    
    // Get all backup directories
    const backupDirs = await fs.readdir(sourceDir);
    const existingBackups = backupDirs.filter(dir => 
      dir.startsWith('pre-restore-backup-') || dir.startsWith('pre-fix-backup-')
    );
    
    console.log(`📦 Found ${existingBackups.length} existing backups to migrate`);
    
    let migratedCount = 0;
    
    for (const backupDir of existingBackups) {
      const sourcePath = path.join(sourceDir, backupDir);
      const targetPath = path.join(targetDir, backupDir);
      
      // Check if target already exists
      if (await fs.pathExists(targetPath)) {
        console.log(`⚠️ Backup ${backupDir} already exists in target, skipping`);
        continue;
      }
      
      // Copy backup directory
      await fs.copy(sourcePath, targetPath);
      
      // Create backup info file for SimpleBackupService compatibility
      const collegesPath = path.join(targetPath, 'colleges.json');
      const accountManagersPath = path.join(targetPath, 'accountManagers.json');
      const usersPath = path.join(targetPath, 'users.json');
      
      let fileCount = 0;
      let totalSize = 0;
      const details = [];
      
      if (await fs.pathExists(collegesPath)) {
        const stats = await fs.stat(collegesPath);
        fileCount++;
        totalSize += stats.size;
        const data = await fs.readJson(collegesPath);
        details.push({
          file: 'colleges.json',
          size: stats.size,
          items: Array.isArray(data) ? data.length : 'object'
        });
      }
      
      if (await fs.pathExists(accountManagersPath)) {
        const stats = await fs.stat(accountManagersPath);
        fileCount++;
        totalSize += stats.size;
        const data = await fs.readJson(accountManagersPath);
        details.push({
          file: 'accountManagers.json',
          size: stats.size,
          items: Array.isArray(data) ? data.length : 'object'
        });
      }
      
      if (await fs.pathExists(usersPath)) {
        const stats = await fs.stat(usersPath);
        fileCount++;
        totalSize += stats.size;
        const data = await fs.readJson(usersPath);
        details.push({
          file: 'users.json',
          size: stats.size,
          items: Array.isArray(data) ? data.length : 'object'
        });
      }
      
      // Extract timestamp from directory name
      let timestamp;
      if (backupDir.startsWith('pre-restore-backup-')) {
        timestamp = backupDir.replace('pre-restore-backup-', '');
      } else if (backupDir.startsWith('pre-fix-backup-')) {
        timestamp = backupDir.replace('pre-fix-backup-', '');
      }
      
      // Convert timestamp format from 2025-08-06T09-13-40-769Z to 2025-08-06T09:13:40.769Z
      timestamp = timestamp.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
      
      const backupInfo = {
        timestamp: timestamp,
        files: fileCount,
        backupDir: targetPath,
        details: details,
        migrated: true,
        originalPath: sourcePath,
        protection: {
          autoBackupOnDataChange: true,
          backupBeforeRestore: true,
          maxBackups: 10
        }
      };
      
      await fs.writeJson(path.join(targetPath, 'backup-info.json'), backupInfo, { spaces: 2 });
      
      console.log(`✅ Migrated backup: ${backupDir} (${fileCount} files, ${formatBytes(totalSize)})`);
      migratedCount++;
    }
    
    console.log(`🎉 Migration completed: ${migratedCount} backups migrated`);
    
    // List all backups in target directory
    const finalBackups = await fs.readdir(targetDir);
    console.log(`📁 Total backups in simple-backups: ${finalBackups.length}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run migration
migrateBackups(); 