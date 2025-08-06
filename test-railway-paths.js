#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

console.log('🔍 Testing Railway Volume Path Configuration...\n');

// Test environment detection
const isRailway = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
console.log(`🌍 Environment Detection:`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'undefined'}`);
console.log(`   Is Railway: ${isRailway}\n`);

// Test volume paths
const railwayDataPath = isRailway ? (process.env.PERSISTENT_STORAGE_PATH || '/data') : path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data');
const backupPath = path.join(railwayDataPath, 'backups');
const dataPath = path.join(railwayDataPath, 'data');

console.log(`📁 Volume Paths:`);
console.log(`   Railway Data Path: ${railwayDataPath}`);
console.log(`   Backup Path: ${backupPath}`);
console.log(`   Data Path: ${dataPath}\n`);

// Test directory creation
async function testDirectoryCreation() {
  try {
    console.log(`🔧 Testing Directory Creation...`);
    
    // Create directories
    await fs.ensureDir(railwayDataPath);
    await fs.ensureDir(backupPath);
    await fs.ensureDir(dataPath);
    
    console.log(`   ✅ Created: ${railwayDataPath}`);
    console.log(`   ✅ Created: ${backupPath}`);
    console.log(`   ✅ Created: ${dataPath}\n`);
    
    // Test write permissions
    const testFile = path.join(railwayDataPath, '.test-write');
    await fs.writeFile(testFile, 'test');
    await fs.remove(testFile);
    
    console.log(`   ✅ Write permissions: OK\n`);
    
    // Check if directories exist
    const railwayExists = await fs.pathExists(railwayDataPath);
    const backupExists = await fs.pathExists(backupPath);
    const dataExists = await fs.pathExists(dataPath);
    
    console.log(`📊 Directory Status:`);
    console.log(`   Railway Data: ${railwayExists ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   Backup: ${backupExists ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   Data: ${dataExists ? '✅ Exists' : '❌ Missing'}\n`);
    
    if (railwayExists && backupExists && dataExists) {
      console.log(`🎉 All tests passed! Railway volume configuration is correct.`);
    } else {
      console.log(`❌ Some directories are missing. Check volume configuration.`);
    }
    
  } catch (error) {
    console.error(`❌ Error during testing:`, error.message);
  }
}

testDirectoryCreation(); 