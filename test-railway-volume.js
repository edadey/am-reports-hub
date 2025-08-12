#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

async function testRailwayVolume() {
  console.log('🧪 Testing Railway Persistent Volume...\n');
  
  // Test paths
  const testPaths = [
    '/data',
    '/data/data',
    '/app/data',
    process.cwd() + '/data'
  ];
  
  console.log('=== TESTING VOLUME PATHS ===');
  for (const testPath of testPaths) {
    try {
      const exists = await fs.pathExists(testPath);
      const canWrite = await testWriteAccess(testPath);
      console.log(`${testPath}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'} ${canWrite ? '✅ WRITABLE' : '❌ NOT WRITABLE'}`);
      
      if (exists && canWrite) {
        // Test writing a file
        const testFile = path.join(testPath, 'railway-volume-test.json');
        const testData = {
          timestamp: new Date().toISOString(),
          deployment: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
          environment: process.env.NODE_ENV || 'unknown'
        };
        
        await fs.writeJson(testFile, testData, { spaces: 2 });
        console.log(`  📝 Wrote test file: ${testFile}`);
        
        // Read it back
        const readData = await fs.readJson(testFile);
        console.log(`  📖 Read back: ${JSON.stringify(readData)}`);
        
        return testPath;
      }
    } catch (error) {
      console.log(`${testPath}: ❌ ERROR - ${error.message}`);
    }
  }
  
  console.log('\n❌ No suitable Railway volume path found');
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

async function main() {
  try {
    const bestPath = await testRailwayVolume();
    
    if (bestPath) {
      console.log(`\n✅ Railway volume test completed successfully`);
      console.log(`📁 Best volume path: ${bestPath}`);
      
      // Check for existing templates
      const templatesPath = path.join(bestPath, 'templates.json');
      if (await fs.pathExists(templatesPath)) {
        const templates = await fs.readJson(templatesPath);
        console.log(`📋 Found ${templates.length} existing templates`);
        templates.forEach(t => console.log(`  - ${t.name} (${t.id})`));
      } else {
        console.log('📝 No existing templates found');
      }
    } else {
      console.log('\n❌ Railway volume test failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error testing Railway volume:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testRailwayVolume };
