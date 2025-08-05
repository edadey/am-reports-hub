#!/usr/bin/env node
// cPanel Environment Setup Script

const fs = require('fs-extra');
const path = require('path');

console.log('🔧 Setting up cPanel environment...');

// Create necessary directories
const dirs = ['data', 'backups', 'uploads', 'templates', 'logs'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.ensureDirSync(dir);
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Set file permissions
const chmod = require('child_process').execSync;
try {
  chmod('chmod 755 data/ backups/ uploads/ templates/', { stdio: 'inherit' });
  chmod('chmod 644 data/*.json', { stdio: 'inherit' });
  console.log('✅ Set file permissions');
} catch (error) {
  console.log('⚠️ Could not set permissions (may need manual setup)');
}

// Create default environment file if not exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  const defaultEnv = `# cPanel Environment Configuration
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
AI_ANALYSIS_ENABLED=true
SESSION_SECRET=your-session-secret-here
`;
  
  fs.writeFileSync(envPath, defaultEnv);
  console.log('✅ Created default .env file');
  console.log('⚠️ Please update OPENAI_API_KEY in .env file');
}

console.log('🎉 Environment setup complete!');
console.log('📋 Next steps:');
console.log('1. Update .env file with your OpenAI API key');
console.log('2. Run: npm install');
console.log('3. Start the application');
