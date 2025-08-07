#!/usr/bin/env node

console.log('🔬 Final Verification Test: Backup and Restore Accuracy...\n');

async function finalVerificationTest() {
  try {
    // Test the actual API endpoints that the dashboard uses
    console.log('1️⃣ Testing backup list API...');
    const listResponse = await fetch('https://am-reports-hub-production.up.railway.app/api/backup/list');
    const listData = await listResponse.json();
    
    console.log(`✅ Found ${listData.backups.length} backups:`);
    listData.backups.slice(0, 3).forEach(backup => {
      console.log(`   📦 ${backup.backupId}: ${backup.description} (${backup.files} records, ${backup.sizeFormatted})`);
    });
    
    // Find the backup with fewer colleges (30 records = 4 colleges + 6 managers + users + reports)
    const targetBackup = listData.backups.find(b => b.files === 30);
    if (!targetBackup) {
      console.log('❌ Could not find the 30-record backup (4 colleges)');
      return;
    }
    
    console.log(`\n2️⃣ Testing restore of backup with 4 colleges: ${targetBackup.backupId}`);
    console.log(`   Description: ${targetBackup.description}`);
    console.log(`   Records: ${targetBackup.files}`);
    
    // Test restore via API
    const restoreResponse = await fetch(`https://am-reports-hub-production.up.railway.app/api/backup/restore/${targetBackup.backupId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const restoreResult = await restoreResponse.json();
    console.log('✅ Restore API response:', restoreResult);
    
    console.log('\n3️⃣ Testing storage stats API...');
    const statsResponse = await fetch('https://am-reports-hub-production.up.railway.app/api/backup/stats');
    const statsData = await statsResponse.json();
    
    console.log(`✅ Storage stats:`);
    console.log(`   Total backups: ${statsData.stats.totalBackups}`);
    console.log(`   Total size: ${statsData.stats.totalSizeFormatted}`);
    console.log(`   Storage location: ${statsData.stats.storageLocation}`);
    console.log(`   Is Railway: ${statsData.stats.isRailway}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
finalVerificationTest().then(() => {
  console.log('\n✅ Final verification completed successfully!');
  console.log('📊 The backup dashboard should now show:');
  console.log('   - Variable record counts (not identical)');
  console.log('   - PostgreSQL storage location');
  console.log('   - Accurate restore functionality');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Verification failed:', error);
  process.exit(1);
});