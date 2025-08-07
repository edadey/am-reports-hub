require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

async function testBackupStorage() {
  console.log('🔍 Testing Backup Storage and File Paths...\n');
  
  // Test Railway environment detection
  console.log('=== RAILWAY ENVIRONMENT DETECTION ===');
  const railwayIndicators = [
    process.env.NODE_ENV === 'production',
    process.env.RAILWAY_ENVIRONMENT === 'production',
    process.env.RAILWAY_SERVICE_NAME,
    process.env.RAILWAY_PROJECT_ID,
    process.env.PERSISTENT_STORAGE_PATH,
    process.env.HOSTNAME && process.env.HOSTNAME.includes('railway')
  ];
  
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);
  console.log(`RAILWAY_SERVICE_NAME: ${process.env.RAILWAY_SERVICE_NAME}`);
  console.log(`PERSISTENT_STORAGE_PATH: ${process.env.PERSISTENT_STORAGE_PATH}`);
  console.log(`HOSTNAME: ${process.env.HOSTNAME}`);
  console.log(`Is Railway: ${railwayIndicators.some(indicator => !!indicator)}\n`);
  
  // Test different data paths
  console.log('=== DATA PATH ANALYSIS ===');
  const possibleDataPaths = [
    '/data',
    '/app/data',
    path.join(process.cwd(), 'data'),
    path.join(__dirname, '../data'),
    process.env.PERSISTENT_STORAGE_PATH ? path.join(process.env.PERSISTENT_STORAGE_PATH, 'data') : null
  ].filter(Boolean);
  
  console.log('Checking possible data paths:');
  for (const dataPath of possibleDataPaths) {
    try {
      const exists = await fs.pathExists(dataPath);
      console.log(`  ${dataPath}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
      
      if (exists) {
        const stats = await fs.stat(dataPath);
        console.log(`    Type: ${stats.isDirectory() ? 'Directory' : 'File'}`);
        
        if (stats.isDirectory()) {
          const files = await fs.readdir(dataPath);
          console.log(`    Files: ${files.length} items`);
          console.log(`    Sample files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
        }
      }
    } catch (error) {
      console.log(`  ${dataPath}: ❌ ERROR - ${error.message}`);
    }
  }
  
  // Test backup paths
  console.log('\n=== BACKUP PATH ANALYSIS ===');
  const possibleBackupPaths = [
    '/data/backups',
    '/app/data/backups',
    path.join(process.cwd(), 'data/backups'),
    path.join(__dirname, '../data/backups'),
    process.env.PERSISTENT_STORAGE_PATH ? path.join(process.env.PERSISTENT_STORAGE_PATH, 'backups') : null
  ].filter(Boolean);
  
  console.log('Checking possible backup paths:');
  for (const backupPath of possibleBackupPaths) {
    try {
      const exists = await fs.pathExists(backupPath);
      console.log(`  ${backupPath}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
      
      if (exists) {
        const stats = await fs.stat(backupPath);
        console.log(`    Type: ${stats.isDirectory() ? 'Directory' : 'File'}`);
        
        if (stats.isDirectory()) {
          const files = await fs.readdir(backupPath);
          console.log(`    Files: ${files.length} items`);
          
          if (files.length > 0) {
            console.log(`    Contents: ${files.join(', ')}`);
            
            // Check for recent backup directories
            const recentBackups = files.filter(file => 
              file.includes('2025-08-07') || file.includes('backup-')
            );
            if (recentBackups.length > 0) {
              console.log(`    Recent backups: ${recentBackups.join(', ')}`);
              
              // Check contents of recent backups
              for (const backup of recentBackups.slice(0, 3)) {
                const backupDir = path.join(backupPath, backup);
                try {
                  const backupFiles = await fs.readdir(backupDir);
                  console.log(`      ${backup}: ${backupFiles.length} files`);
                  if (backupFiles.length > 0) {
                    console.log(`        Files: ${backupFiles.join(', ')}`);
                  }
                } catch (error) {
                  console.log(`      ${backup}: ERROR - ${error.message}`);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`  ${backupPath}: ❌ ERROR - ${error.message}`);
    }
  }
  
  // Test file copying
  console.log('\n=== FILE COPYING TEST ===');
  const testDataPath = path.join(process.cwd(), 'data');
  const testBackupPath = path.join(process.cwd(), 'data/test-backup');
  
  try {
    // Create test backup directory
    await fs.ensureDir(testBackupPath);
    console.log(`✅ Created test backup directory: ${testBackupPath}`);
    
    // Check if source files exist
    const essentialFiles = ['colleges.json', 'users.json', 'accountManagers.json'];
    let copiedFiles = 0;
    
    for (const filename of essentialFiles) {
      const sourcePath = path.join(testDataPath, filename);
      const destPath = path.join(testBackupPath, filename);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath);
        const stats = await fs.stat(sourcePath);
        console.log(`✅ Copied ${filename} (${stats.size} bytes)`);
        copiedFiles++;
      } else {
        console.log(`❌ Source file not found: ${sourcePath}`);
      }
    }
    
    console.log(`\n📊 File copying test: ${copiedFiles}/${essentialFiles.length} files copied`);
    
    // Clean up test directory
    await fs.remove(testBackupPath);
    console.log('🧹 Cleaned up test backup directory');
    
  } catch (error) {
    console.error('❌ File copying test failed:', error.message);
  }
  
  // Test Railway backup service paths
  console.log('\n=== RAILWAY BACKUP SERVICE PATHS ===');
  const RailwayBackupService = require('./src/services/RailwayBackupService');
  const backupService = new RailwayBackupService();
  
  console.log(`Data Path: ${backupService.getDataPath()}`);
  console.log(`Backup Path: ${backupService.getBackupPath()}`);
  console.log(`Is Railway Environment: ${backupService.isRailwayEnvironment()}`);
  
  // Check if Railway backup service paths exist
  try {
    const dataPathExists = await fs.pathExists(backupService.getDataPath());
    const backupPathExists = await fs.pathExists(backupService.getBackupPath());
    
    console.log(`Data Path Exists: ${dataPathExists ? '✅' : '❌'}`);
    console.log(`Backup Path Exists: ${backupPathExists ? '✅' : '❌'}`);
    
    if (dataPathExists) {
      const files = await fs.readdir(backupService.getDataPath());
      console.log(`Data Path Contents: ${files.length} items`);
      console.log(`Sample: ${files.slice(0, 5).join(', ')}`);
    }
    
    if (backupPathExists) {
      const files = await fs.readdir(backupService.getBackupPath());
      console.log(`Backup Path Contents: ${files.length} items`);
      console.log(`Sample: ${files.slice(0, 5).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking Railway backup service paths:', error.message);
  }
  
  console.log('\n✅ Backup storage test completed');
}

testBackupStorage().catch(console.error); 