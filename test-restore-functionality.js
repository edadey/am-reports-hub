#!/usr/bin/env node

console.log('🔄 Testing Backup Restore Functionality...\n');

async function testRestoreFunctionality() {
  try {
    // Initialize PostgreSQL Backup Service
    console.log('📊 Initializing PostgreSQL Backup Service...');
    const PostgreSQLBackupService = require('./src/services/PostgreSQLBackupService');
    const backupService = new PostgreSQLBackupService();
    await backupService.initialize();
    
    // List existing backups
    const backups = await backupService.listBackups();
    console.log(`✅ Found ${backups.length} existing backups`);
    
    if (backups.length === 0) {
      console.log('📦 No backups found, creating one first...');
      const newBackup = await backupService.createBackup('Test backup for restore');
      console.log('✅ Test backup created:', newBackup.backupId);
      
      // Get updated list
      const updatedBackups = await backupService.listBackups();
      backups.push(...updatedBackups);
    }
    
    // Show backup details
    const latestBackup = backups[0];
    console.log(`\n📋 Latest backup details:`);
    console.log(`   Backup ID: ${latestBackup.backupId}`);
    console.log(`   Description: ${latestBackup.description}`);
    console.log(`   Timestamp: ${latestBackup.timestamp}`);
    console.log(`   Size: ${backupService.formatBytes(latestBackup.size)}`);
    
    // Get detailed backup information
    const details = await backupService.getBackupDetails(latestBackup.backupId);
    console.log(`   Colleges: ${details.collegesCount} (${details.collegeNames.slice(0, 3).join(', ')}${details.collegeNames.length > 3 ? '...' : ''})`);
    console.log(`   Account Managers: ${details.accountManagersCount}`);
    
    console.log(`\n🔄 Testing restore functionality...`);
    
    // Test restore (this will create a pre-restore backup automatically)
    const restoreResult = await backupService.restoreBackup(latestBackup.backupId);
    
    if (restoreResult.success) {
      console.log('✅ Restore completed successfully!');
      console.log(`   Restored tables: ${restoreResult.restoredTables.join(', ')}`);
      console.log(`   Restored records: ${restoreResult.restoredRecords}`);
    } else {
      console.error('❌ Restore failed:', restoreResult.error);
    }
    
    // Final backup count
    const finalBackups = await backupService.listBackups();
    console.log(`\n📊 Final backup count: ${finalBackups.length} backups`);
    
    // Storage stats
    const stats = await backupService.getStorageStats();
    console.log(`💾 Total storage used: ${stats.formattedSize}`);
    console.log(`🗄️ Storage location: ${stats.storageLocation}`);
    
  } catch (error) {
    console.error('❌ Restore test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRestoreFunctionality().then(() => {
  console.log('\n✅ Restore functionality test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});