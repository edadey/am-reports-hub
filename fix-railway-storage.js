require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

async function fixRailwayStorage() {
  console.log('🔧 Fixing Railway Storage Paths...\n');
  
  // Test different possible Railway storage paths
  const possiblePaths = [
    '/data',
    '/app/data',
    '/app/volume',
    '/volume',
    '/tmp/data',
    process.cwd() + '/data',
    path.join(process.cwd(), 'data')
  ];
  
  console.log('=== TESTING RAILWAY STORAGE PATHS ===');
  for (const testPath of possiblePaths) {
    try {
      const exists = await fs.pathExists(testPath);
      const canWrite = await testWriteAccess(testPath);
      console.log(`${testPath}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'} ${canWrite ? '✅ WRITABLE' : '❌ NOT WRITABLE'}`);
      
      if (exists && canWrite) {
        console.log(`  📁 This path is available for Railway storage`);
        return testPath;
      }
    } catch (error) {
      console.log(`${testPath}: ❌ ERROR - ${error.message}`);
    }
  }
  
  console.log('\n❌ No suitable Railway storage path found');
  return null;
}

async function testWriteAccess(dirPath) {
  try {
    const testFile = path.join(dirPath, '.test-write-access');
    await fs.writeFile(testFile, 'test');
    await fs.remove(testFile);
    return true;
  } catch {
    return false;
  }
}

async function updateRailwayBackupService() {
  console.log('\n=== UPDATING RAILWAY BACKUP SERVICE ===');
  
  const backupServicePath = './src/services/RailwayBackupService.js';
  let content = await fs.readFile(backupServicePath, 'utf8');
  
  // Find the best available path
  const bestPath = await fixRailwayStorage();
  
  if (bestPath) {
    console.log(`✅ Using storage path: ${bestPath}`);
    
    // Update the path in the backup service
    content = content.replace(
      /this\.railwayDataPath = process\.env\.PERSISTENT_STORAGE_PATH \|\| '\/app\/data';/,
      `this.railwayDataPath = process.env.PERSISTENT_STORAGE_PATH || '${bestPath}';`
    );
    
    await fs.writeFile(backupServicePath, content);
    console.log('✅ Updated RailwayBackupService with correct path');
  } else {
    console.log('❌ Could not determine correct Railway storage path');
  }
}

async function testBackupWithFixedPaths() {
  console.log('\n=== TESTING BACKUP WITH FIXED PATHS ===');
  
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
    await backupService.initialize();
    
    // Create a test backup
    const result = await backupService.createBackup('Test backup after storage fix');
    console.log('✅ Test backup created successfully');
    console.log(`Backup ID: ${result.backupId}`);
    console.log(`Files: ${result.files}`);
    console.log(`Size: ${result.sizeFormatted}`);
    
    // List backups
    const backups = await backupService.listBackups();
    console.log(`Total backups: ${backups.length}`);
    
  } catch (error) {
    console.error('❌ Error testing backup:', error.message);
  }
}

async function main() {
  try {
    await updateRailwayBackupService();
    await testBackupWithFixedPaths();
    console.log('\n✅ Railway storage fix completed');
  } catch (error) {
    console.error('❌ Error fixing Railway storage:', error);
  }
}

main(); 