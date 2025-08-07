require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

async function testFixedBackup() {
  console.log('🧪 Testing Fixed Backup Service...\n');
  
  // Set Railway environment
  process.env.NODE_ENV = 'production';
  process.env.RAILWAY_ENVIRONMENT = 'production';
  process.env.RAILWAY_SERVICE_NAME = 'am-reports-hub';
  
  const RailwayBackupService = require('./src/services/RailwayBackupService');
  const backupService = new RailwayBackupService();
  
  console.log(`Data Path: ${backupService.getDataPath()}`);
  console.log(`Backup Path: ${backupService.getBackupPath()}`);
  
  try {
    // Initialize the service
    console.log('\n=== INITIALIZING BACKUP SERVICE ===');
    await backupService.initialize();
    
    // Check what files are now available
    console.log('\n=== CHECKING AVAILABLE FILES ===');
    const dataPath = backupService.getDataPath();
    if (await fs.pathExists(dataPath)) {
      const files = await fs.readdir(dataPath);
      console.log(`Files in data path: ${files.length} items`);
      console.log(`Files: ${files.join(', ')}`);
      
      // Check essential files
      const essentialFiles = ['colleges.json', 'users.json', 'accountManagers.json'];
      for (const file of essentialFiles) {
        const filePath = path.join(dataPath, file);
        const exists = await fs.pathExists(filePath);
        if (exists) {
          const stats = await fs.stat(filePath);
          console.log(`  ✅ ${file}: ${stats.size} bytes`);
        } else {
          console.log(`  ❌ ${file}: NOT FOUND`);
        }
      }
    }
    
    // Create a test backup
    console.log('\n=== CREATING TEST BACKUP ===');
    const result = await backupService.createBackup('Test backup with fixed migration');
    console.log('✅ Test backup created successfully');
    console.log(`Backup ID: ${result.backupId}`);
    console.log(`Description: ${result.description}`);
    console.log(`Files: ${result.files}`);
    console.log(`Size: ${result.sizeFormatted}`);
    
    // List all backups
    console.log('\n=== LISTING ALL BACKUPS ===');
    const backups = await backupService.listBackups();
    console.log(`Total backups: ${backups.length}`);
    
    if (backups.length > 0) {
      backups.slice(0, 5).forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.backupId} - ${backup.description} (${backup.sizeFormatted})`);
      });
    }
    
    // Check the latest backup contents
    if (backups.length > 0) {
      console.log('\n=== CHECKING LATEST BACKUP CONTENTS ===');
      const latestBackup = backups[0];
      const backupDir = path.join(backupService.getBackupPath(), latestBackup.backupId);
      
      if (await fs.pathExists(backupDir)) {
        const backupFiles = await fs.readdir(backupDir);
        console.log(`Backup directory: ${backupDir}`);
        console.log(`Files in backup: ${backupFiles.length} items`);
        console.log(`Files: ${backupFiles.join(', ')}`);
        
        // Check backup info
        const backupInfoPath = path.join(backupDir, 'backup-info.json');
        if (await fs.pathExists(backupInfoPath)) {
          const backupInfo = await fs.readJson(backupInfoPath);
          console.log(`Backup info: ${backupInfo.metadata?.fileCount || 0} files, ${backupInfo.metadata?.totalSize || 0} bytes`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing backup:', error.message);
    console.error('Full error:', error);
  }
}

testFixedBackup().catch(console.error); 