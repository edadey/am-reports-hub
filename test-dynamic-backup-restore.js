#!/usr/bin/env node

console.log('🧪 Testing Dynamic Backup/Restore with College Changes...\n');

async function testDynamicBackupRestore() {
  try {
    // Initialize services
    console.log('🚀 Initializing services...');
    const PostgreSQLBackupService = require('./src/services/PostgreSQLBackupService');
    const DatabaseUserManager = require('./src/services/DatabaseUserManager');
    
    const backupService = new PostgreSQLBackupService();
    await backupService.initialize();
    await DatabaseUserManager.initialize();
    
    // Step 1: Check current state
    console.log('\n📊 Step 1: Checking current database state...');
    let colleges = await DatabaseUserManager.getColleges();
    console.log(`✅ Current colleges count: ${colleges.length}`);
    colleges.forEach((college, index) => {
      console.log(`   ${index + 1}. ${college.name} (ID: ${college.id})`);
    });
    
    // Step 2: Create backup of current state
    console.log('\n📦 Step 2: Creating backup of current state...');
    const currentStateBackup = await backupService.createBackup('Backup before deletions');
    console.log(`✅ Created backup: ${currentStateBackup.backupId}`);
    
    // Step 3: Delete some colleges (delete 2 colleges)
    console.log('\n🗑️ Step 3: Deleting 2 colleges...');
    if (colleges.length >= 2) {
      const college1 = colleges[0];
      const college2 = colleges[1];
      
      console.log(`   Deleting: ${college1.name} (ID: ${college1.id})`);
      await DatabaseUserManager.deleteCollege(college1.id);
      
      console.log(`   Deleting: ${college2.name} (ID: ${college2.id})`);
      await DatabaseUserManager.deleteCollege(college2.id);
      
      // Check new state
      const remainingColleges = await DatabaseUserManager.getColleges();
      console.log(`✅ Colleges after deletion: ${remainingColleges.length}`);
      remainingColleges.forEach((college, index) => {
        console.log(`   ${index + 1}. ${college.name} (ID: ${college.id})`);
      });
    } else {
      console.log('⚠️ Not enough colleges to delete (need at least 2)');
      return;
    }
    
    // Step 4: Create backup of reduced state
    console.log('\n📦 Step 4: Creating backup with fewer colleges...');
    const reducedStateBackup = await backupService.createBackup('Backup after deletions');
    console.log(`✅ Created backup: ${reducedStateBackup.backupId}`);
    
    // Step 5: Delete one more college
    console.log('\n🗑️ Step 5: Deleting one more college...');
    const currentColleges = await DatabaseUserManager.getColleges();
    if (currentColleges.length > 0) {
      const college3 = currentColleges[0];
      console.log(`   Deleting: ${college3.name} (ID: ${college3.id})`);
      await DatabaseUserManager.deleteCollege(college3.id);
      
      const finalColleges = await DatabaseUserManager.getColleges();
      console.log(`✅ Colleges after final deletion: ${finalColleges.length}`);
      finalColleges.forEach((college, index) => {
        console.log(`   ${index + 1}. ${college.name} (ID: ${college.id})`);
      });
    }
    
    // Step 6: Show all backups with details
    console.log('\n📋 Step 6: Analyzing backup details...');
    const allBackups = await backupService.listBackups();
    console.log(`Total backups: ${allBackups.length}\n`);
    
    for (const backup of allBackups.slice(0, 3)) { // Show latest 3 backups
      const details = await backupService.getBackupDetails(backup.backupId);
      console.log(`📦 Backup: ${backup.backupId}`);
      console.log(`   Description: ${backup.description}`);
      console.log(`   Timestamp: ${backup.timestamp}`);
      console.log(`   Colleges Count: ${details.collegesCount}`);
      console.log(`   College Names: ${details.collegeNames.join(', ')}`);
      console.log(`   Account Managers: ${details.accountManagersCount}`);
      console.log(`   Total Records: ${backup.metadata.totalRecords}`);
      console.log('');
    }
    
    // Step 7: Restore from the backup with fewer colleges (reducedStateBackup)
    console.log(`🔄 Step 7: Restoring from backup with fewer colleges...`);
    console.log(`   Restoring backup: ${reducedStateBackup.backupId}`);
    
    const restoreResult = await backupService.restoreBackup(reducedStateBackup.backupId);
    
    if (restoreResult.success) {
      console.log('✅ Restore completed!');
      console.log(`   Restored tables: ${restoreResult.restoredTables.join(', ')}`);
      console.log(`   Restored records: ${restoreResult.restoredRecords}`);
      
      // Step 8: Verify restored state
      console.log('\n🔍 Step 8: Verifying restored state...');
      const restoredColleges = await DatabaseUserManager.getColleges();
      console.log(`✅ Colleges after restore: ${restoredColleges.length}`);
      restoredColleges.forEach((college, index) => {
        console.log(`   ${index + 1}. ${college.name} (ID: ${college.id})`);
      });
      
      // Get details of the backup we restored from
      const restoredBackupDetails = await backupService.getBackupDetails(reducedStateBackup.backupId);
      
      console.log('\n📊 Verification Results:');
      console.log(`   Expected colleges from backup: ${restoredBackupDetails.collegesCount}`);
      console.log(`   Actual colleges after restore: ${restoredColleges.length}`);
      console.log(`   Match: ${restoredBackupDetails.collegesCount === restoredColleges.length ? '✅ YES' : '❌ NO'}`);
      
      if (restoredBackupDetails.collegesCount !== restoredColleges.length) {
        console.log('❌ ISSUE FOUND: Backup college count does not match restored count!');
        console.log(`   This confirms the bug you mentioned.`);
      } else {
        console.log('✅ SUCCESS: Backup and restore counts match perfectly!');
      }
    } else {
      console.error('❌ Restore failed:', restoreResult.error);
    }
    
    // Final summary
    console.log('\n📊 Final Summary:');
    const finalBackups = await backupService.listBackups();
    console.log(`   Total backups: ${finalBackups.length}`);
    
    const finalColleges = await DatabaseUserManager.getColleges();
    console.log(`   Current colleges: ${finalColleges.length}`);
    
    const stats = await backupService.getStorageStats();
    console.log(`   Storage used: ${stats.formattedSize}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDynamicBackupRestore().then(() => {
  console.log('\n✅ Dynamic backup/restore test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});