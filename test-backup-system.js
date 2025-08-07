#!/usr/bin/env node

console.log('🧪 Testing Backup System Integration...\n');

async function testBackupSystem() {
  try {
    // Test 1: PostgreSQL Backup Service
    console.log('📊 Testing PostgreSQL Backup Service...');
    const PostgreSQLBackupService = require('./src/services/PostgreSQLBackupService');
    const postgresBackup = new PostgreSQLBackupService();
    
    try {
      await postgresBackup.initialize();
      console.log('✅ PostgreSQL Backup Service initialized');
      
      // Create a backup
      const backupResult = await postgresBackup.createBackup('Test backup from Railway');
      console.log('✅ PostgreSQL backup created:', backupResult.backupId);
      
      // List backups
      const backups = await postgresBackup.listBackups();
      console.log(`✅ Found ${backups.length} PostgreSQL backups`);
      
      // Get storage stats
      const stats = await postgresBackup.getStorageStats();
      console.log('✅ Storage stats:', stats.formattedSize);
      
    } catch (error) {
      console.error('❌ PostgreSQL Backup Service failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Railway Backup Service
    console.log('☁️ Testing Railway Backup Service...');
    const RailwayBackupService = require('./src/services/RailwayBackupService');
    const railwayBackup = new RailwayBackupService();
    
    try {
      await railwayBackup.initialize();
      console.log('✅ Railway Backup Service initialized');
      
      // Create a backup
      const railwayBackupResult = await railwayBackup.createBackup('Test Railway cloud backup');
      console.log('✅ Railway backup created:', railwayBackupResult.backupId);
      
      // List backups
      const railwayBackups = await railwayBackup.listBackups();
      console.log(`✅ Found ${railwayBackups.length} Railway backups`);
      
      // Get storage stats
      const railwayStats = await railwayBackup.getStorageStats();
      console.log('✅ Railway storage stats:', railwayStats.totalSizeFormatted);
      
    } catch (error) {
      console.error('❌ Railway Backup Service failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: App Integration
    console.log('🚀 Testing App Integration...');
    const app = require('./app');
    console.log('✅ App loaded successfully');
    
  } catch (error) {
    console.error('❌ Backup system test failed:', error);
    process.exit(1);
  }
}

// Run the test
testBackupSystem().then(() => {
  console.log('\n✅ Backup system test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});