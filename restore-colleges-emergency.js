const fs = require('fs-extra');
const path = require('path');

async function restoreCollegesEmergency() {
  console.log('🚨 EMERGENCY: Restoring college data...');
  
  try {
    // Read local college data
    const localCollegesPath = path.join(__dirname, 'data/colleges.json');
    const localAccountManagersPath = path.join(__dirname, 'data/accountManagers.json');
    
    if (!await fs.pathExists(localCollegesPath)) {
      console.error('❌ Local colleges.json not found!');
      return;
    }
    
    const colleges = await fs.readJson(localCollegesPath);
    const accountManagers = await fs.pathExists(localAccountManagersPath) 
      ? await fs.readJson(localAccountManagersPath) 
      : [];
    
    console.log(`📊 Found ${colleges.length} colleges locally`);
    console.log(`📊 Found ${accountManagers.length} account managers locally`);
    
    // Create data-restoration directory
    const restorationDir = path.join(__dirname, 'data-restoration');
    await fs.ensureDir(restorationDir);
    
    // Copy data files to restoration directory
    await fs.copy(localCollegesPath, path.join(restorationDir, 'colleges.json'));
    if (await fs.pathExists(localAccountManagersPath)) {
      await fs.copy(localAccountManagersPath, path.join(restorationDir, 'accountManagers.json'));
    }
    
    // Create deployment trigger
    await fs.writeFile(path.join(__dirname, 'DEPLOYMENT_TRIGGER.md'), 
      `# Emergency Data Restoration\n\nRestoring college data at ${new Date().toISOString()}\n\n- Colleges: ${colleges.length}\n- Account Managers: ${accountManagers.length}\n\nThis file triggers deployment with data restoration.`);
    
    console.log('✅ Emergency restoration files created');
    console.log('📁 Files ready for deployment:');
    console.log(`   - data-restoration/colleges.json`);
    console.log(`   - data-restoration/accountManagers.json`);
    console.log(`   - DEPLOYMENT_TRIGGER.md`);
    
    // Validate data structure
    console.log('\n🔍 Validating data structure...');
    let issues = 0;
    
    for (const college of colleges) {
      if (!Array.isArray(college.keyStakeholders)) {
        college.keyStakeholders = [];
        issues++;
      }
      if (!Array.isArray(college.superUsers)) {
        college.superUsers = [];
        issues++;
      }
      if (!Array.isArray(college.modules)) {
        college.modules = [];
        issues++;
      }
    }
    
    if (issues > 0) {
      console.log(`⚠️  Fixed ${issues} data structure issues`);
      await fs.writeJson(localCollegesPath, colleges, { spaces: 2 });
      await fs.copy(localCollegesPath, path.join(restorationDir, 'colleges.json'));
    }
    
    console.log('✅ Data validation complete');
    
  } catch (error) {
    console.error('❌ Emergency restoration failed:', error);
  }
}

restoreCollegesEmergency(); 