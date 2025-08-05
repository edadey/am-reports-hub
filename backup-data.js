#!/usr/bin/env node
// Data Backup Script for cPanel

const fs = require('fs-extra');
const path = require('path');

async function backupData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups', `backup-${timestamp}`);
  
  try {
    await fs.ensureDir(backupDir);
    
    // Backup data files
    const dataFiles = ['colleges.json', 'kpis.json', 'templates.json', 'users.json'];
    for (const file of dataFiles) {
      const sourcePath = path.join(__dirname, 'data', file);
      if (fs.existsSync(sourcePath)) {
        await fs.copy(sourcePath, path.join(backupDir, file));
        console.log(`✅ Backed up: ${file}`);
      }
    }
    
    // Create backup manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      files: dataFiles.filter(file => fs.existsSync(path.join(__dirname, 'data', file))),
      version: '1.0.0'
    };
    
    await fs.writeJson(path.join(backupDir, 'manifest.json'), manifest, { spaces: 2 });
    console.log('✅ Created backup manifest');
    
    console.log(`🎉 Backup completed: ${backupDir}`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
  }
}

backupData();
