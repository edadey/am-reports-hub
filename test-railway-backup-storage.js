require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

async function testRailwayBackupStorage() {
  console.log('🔍 Testing Railway Backup Storage in Production Environment...\n');
  
  // Set Railway environment variables for testing
  process.env.NODE_ENV = 'production';
  process.env.RAILWAY_ENVIRONMENT = 'production';
  process.env.RAILWAY_SERVICE_NAME = 'am-reports-hub';
  process.env.RAILWAY_PROJECT_ID = '161d7a31-643e-4882-ba73-a1e8da97c2db';
  
  console.log('=== RAILWAY ENVIRONMENT SIMULATION ===');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);
  console.log(`RAILWAY_SERVICE_NAME: ${process.env.RAILWAY_SERVICE_NAME}`);
  console.log(`PERSISTENT_STORAGE_PATH: ${process.env.PERSISTENT_STORAGE_PATH}`);
  console.log(`HOSTNAME: ${process.env.HOSTNAME}\n`);
  
  // Test Railway backup service
  console.log('=== RAILWAY BACKUP SERVICE TEST ===');
  const RailwayBackupService = require('./src/services/RailwayBackupService');
  const backupService = new RailwayBackupService();
  
  console.log(`Data Path: ${backupService.getDataPath()}`);
  console.log(`Backup Path: ${backupService.getBackupPath()}`);
  console.log(`Is Railway Environment: ${backupService.isRailwayEnvironment()}\n`);
  
  // Check if paths exist
  try {
    const dataPathExists = await fs.pathExists(backupService.getDataPath());
    const backupPathExists = await fs.pathExists(backupService.getBackupPath());
    
    console.log(`Data Path Exists: ${dataPathExists ? '✅' : '❌'}`);
    console.log(`Backup Path Exists: ${backupPathExists ? '✅' : '❌'}`);
    
    if (dataPathExists) {
      const files = await fs.readdir(backupService.getDataPath());
      console.log(`Data Path Contents: ${files.length} items`);
      console.log(`Files: ${files.join(', ')}`);
      
      // Check essential files
      const essentialFiles = ['colleges.json', 'users.json', 'accountManagers.json'];
      for (const file of essentialFiles) {
        const filePath = path.join(backupService.getDataPath(), file);
        const exists = await fs.pathExists(filePath);
        if (exists) {
          const stats = await fs.stat(filePath);
          console.log(`  ✅ ${file}: ${stats.size} bytes`);
        } else {
          console.log(`  ❌ ${file}: NOT FOUND`);
        }
      }
    }
    
    if (backupPathExists) {
      const files = await fs.readdir(backupService.getBackupPath());
      console.log(`\nBackup Path Contents: ${files.length} items`);
      
      if (files.length > 0) {
        console.log(`Backup directories: ${files.join(', ')}`);
        
        // Check recent backups
        const recentBackups = files.filter(file => 
          file.includes('2025-08-07') || file.includes('backup-')
        ).slice(0, 5);
        
        if (recentBackups.length > 0) {
          console.log(`\nRecent backups:`);
          for (const backup of recentBackups) {
            const backupDir = path.join(backupService.getBackupPath(), backup);
            try {
              const backupFiles = await fs.readdir(backupDir);
              console.log(`  ${backup}: ${backupFiles.length} files`);
              
              if (backupFiles.length > 0) {
                console.log(`    Files: ${backupFiles.join(', ')}`);
                
                // Check backup info
                const backupInfoPath = path.join(backupDir, 'backup-info.json');
                if (await fs.pathExists(backupInfoPath)) {
                  const backupInfo = await fs.readJson(backupInfoPath);
                  console.log(`    Size: ${backupInfo.metadata?.totalSize || 0} bytes`);
                  console.log(`    File count: ${backupInfo.metadata?.fileCount || 0}`);
                }
              }
            } catch (error) {
              console.log(`  ${backup}: ERROR - ${error.message}`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking Railway backup service paths:', error.message);
  }
  
  // Test creating a backup
  console.log('\n=== CREATING TEST BACKUP ===');
  try {
    const result = await backupService.createBackup('Test backup from local environment');
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
    
  } catch (error) {
    console.error('❌ Error creating test backup:', error.message);
  }
  
  console.log('\n✅ Railway backup storage test completed');
}

testRailwayBackupStorage().catch(console.error); 