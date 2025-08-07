require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

async function testRailwayPersistentStorage() {
  console.log('🧪 Testing Railway Persistent Storage Fix...\n');
  
  // Set Railway environment variables
  process.env.NODE_ENV = 'production';
  process.env.RAILWAY_ENVIRONMENT = 'production';
  process.env.RAILWAY_SERVICE_NAME = 'am-reports-hub';
  process.env.HOSTNAME = 'railway-test-container';
  
  console.log('=== RAILWAY ENVIRONMENT SIMULATION ===');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);
  console.log(`RAILWAY_SERVICE_NAME: ${process.env.RAILWAY_SERVICE_NAME}`);
  console.log(`HOSTNAME: ${process.env.HOSTNAME}\n`);
  
  const RailwayBackupService = require('./src/services/RailwayBackupService');
  const backupService = new RailwayBackupService();
  
  console.log(`Railway Data Path: ${backupService.getDataPath()}`);
  console.log(`Railway Backup Path: ${backupService.getBackupPath()}`);
  console.log(`Is Railway Environment: ${backupService.isRailwayEnvironment()}\n`);
  
  // Test the paths that would be used in Railway
  const railwayDataPath = '/data';
  const railwayBackupPath = '/data/backups';
  
  console.log('=== TESTING RAILWAY PATHS ===');
  console.log(`Railway data path: ${railwayDataPath}`);
  console.log(`Railway backup path: ${railwayBackupPath}`);
  
  // Check if we can create these directories
  try {
    await fs.ensureDir(railwayDataPath);
    await fs.ensureDir(railwayBackupPath);
    console.log('✅ Railway paths are accessible');
    
    // Test writing a file
    const testFile = path.join(railwayDataPath, 'test-railway-storage.json');
    await fs.writeJson(testFile, { test: 'railway-storage', timestamp: new Date().toISOString() });
    console.log('✅ Can write to Railway storage');
    
    // Test reading the file
    const testData = await fs.readJson(testFile);
    console.log('✅ Can read from Railway storage:', testData.test);
    
    // Clean up
    await fs.remove(testFile);
    console.log('✅ Railway storage test completed successfully');
    
  } catch (error) {
    console.error('❌ Railway storage test failed:', error.message);
    console.log('💡 This is expected in local environment - Railway storage only works in Railway');
  }
  
  // Test the backup service initialization
  console.log('\n=== TESTING BACKUP SERVICE INITIALIZATION ===');
  try {
    await backupService.initialize();
    console.log('✅ Backup service initialized successfully');
    
    // Test creating a backup
    const result = await backupService.createBackup('Test Railway persistent storage');
    console.log('✅ Test backup created successfully');
    console.log(`Backup ID: ${result.backupId}`);
    console.log(`Files: ${result.files}`);
    console.log(`Size: ${result.sizeFormatted}`);
    
    // List backups
    const backups = await backupService.listBackups();
    console.log(`Total backups: ${backups.length}`);
    
  } catch (error) {
    console.error('❌ Backup service test failed:', error.message);
  }
  
  console.log('\n✅ Railway persistent storage test completed');
}

testRailwayPersistentStorage().catch(console.error); 