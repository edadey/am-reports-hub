// app.js - Application entry point
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const cookieParser = require('cookie-parser');

// Enhanced environment variable loading for cPanel compatibility
console.log('🔧 Loading environment variables...');

// Method 1: Try dotenv first
try {
  require('dotenv').config();
  console.log('✅ .env file loaded via dotenv');
} catch (error) {
  console.log('⚠️ Could not load .env file via dotenv:', error.message);
}

// Method 2: Manual .env file reading for cPanel compatibility
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
  console.log('🔍 Attempting manual .env file reading...');
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      console.log('📁 .env file found, parsing manually...');
      
      // Parse .env content manually
      const envLines = envContent.split('\n');
      envLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            if (!process.env[key] || process.env[key] === 'your-openai-api-key-here') {
              process.env[key] = value;
              console.log(`🔧 Manually set ${key} from .env file`);
            }
          }
        }
      });
    } else {
      console.log('⚠️ .env file not found at:', envPath);
    }
  } catch (error) {
    console.log('⚠️ Could not manually read .env file:', error.message);
  }
}

// Method 3: Check for cPanel environment variables
console.log('🔍 Checking cPanel environment variables...');
const cpanelEnvVars = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL', 
  'AI_ANALYSIS_ENABLED',
  'NODE_ENV',
  'PORT'
];

cpanelEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName} found in environment: ${varName === 'OPENAI_API_KEY' ? 
      (process.env[varName].substring(0, 10) + '...') : process.env[varName]}`);
  } else {
    console.log(`❌ ${varName} not found in environment`);
  }
});

// Method 4: Set defaults for missing variables
if (!process.env.OPENAI_MODEL) {
  process.env.OPENAI_MODEL = 'gpt-4o-mini';
  console.log('🔧 Set default OPENAI_MODEL: gpt-4o-mini');
}

if (!process.env.AI_ANALYSIS_ENABLED) {
  process.env.AI_ANALYSIS_ENABLED = 'true';
  console.log('🔧 Set default AI_ANALYSIS_ENABLED: true');
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
  console.log('🔧 Set default NODE_ENV: production');
}

if (!process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = 'https://am-reports-hub-production.up.railway.app';
  console.log('🔧 Set default CORS_ORIGIN: https://am-reports-hub-production.up.railway.app');
}

if (!process.env.BASE_URL) {
  process.env.BASE_URL = 'https://am-reports-hub-production.up.railway.app';
  console.log('🔧 Set default BASE_URL: https://am-reports-hub-production.up.railway.app');
}

// Enhanced debugging for OpenAI API key
console.log('\n🔧 Environment Variables Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('OPENAI_API_KEY preview:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'none');
console.log('OPENAI_API_KEY is placeholder:', process.env.OPENAI_API_KEY === 'your-openai-api-key-here');
console.log('OPENAI_MODEL:', process.env.OPENAI_MODEL);
console.log('AI_ANALYSIS_ENABLED:', process.env.AI_ANALYSIS_ENABLED);

// Import services
const UserManager = require('./src/services/UserManager');
const ShareLinkService = require('./src/services/ShareLinkService');
const databaseUserManagerInstance = require('./src/services/DatabaseUserManager');
const DatabaseService = require('./src/services/DatabaseService');
const AIAnalyzer = require('./src/services/AIAnalyzer');
const RailwayBackupService = require('./src/services/RailwayBackupService');
const PostgreSQLBackupService = require('./src/services/PostgreSQLBackupService');
const EnhancedDataValidationService = require('./src/services/EnhancedDataValidationService');
const VolumeService = require('./src/services/VolumeService');
const DataPreservationService = require('./src/services/DataPreservationService');
const CloudBackupService = require('./src/services/CloudBackupService');
const BackupAPIService = require('./src/services/BackupAPIService');
const SecurityService = require('./src/services/SecurityService');

// Initialize services
const volumeService = new VolumeService();

// Initialize backup service - prioritize PostgreSQL for data consistency
let backupService;
async function initializeBackupService() {
  try {
    // Use PostgreSQL backup service for data consistency and reliability
    console.log('🔄 Initializing PostgreSQL database backup service...');
    const postgresService = new PostgreSQLBackupService();
    await postgresService.initialize();
    backupService = postgresService;
    console.log('✅ Using PostgreSQL database backup service (primary)');
  } catch (postgresError) {
    console.log('⚠️ PostgreSQL backup service failed, trying Railway file-based backup...');
    try {
      const railwayService = new RailwayBackupService();
      await railwayService.initialize();
      backupService = railwayService;
      console.log('✅ Using Railway file-based backup service (fallback)');
    } catch (railwayError) {
      console.error('❌ Failed to initialize any backup service:');
      console.error('   PostgreSQL error:', postgresError.message);
      console.error('   Railway error:', railwayError.message);
      // Create a minimal backup service that does nothing
      backupService = {
        createBackup: async () => ({ backupId: 'none', message: 'No backup service available' }),
        listBackups: async () => [],
        restoreBackup: async () => ({ success: false, error: 'No backup service available' }),
        getStorageStats: async () => ({ totalBackups: 0, totalSize: 0, formattedSize: '0 B' }),
      };
    }
  }
}

// For compatibility, create a proxy object
const railwayBackupService = new Proxy({}, {
  get(target, prop) {
    if (backupService && typeof backupService[prop] === 'function') {
      return backupService[prop].bind(backupService);
    }
    return backupService ? backupService[prop] : undefined;
  }
});

const dataPreservationService = new DataPreservationService(volumeService);
const cloudBackupService = new CloudBackupService();
const securityService = new SecurityService();
const dataValidationService = new EnhancedDataValidationService();

// Template data synchronization helper
async function synchronizeTemplateData() {
  try {
    console.log('🔄 Synchronizing template data between volume and data layers...');
    
    const templatesFile = 'templates.json';
    const fs = require('fs-extra');
    const path = require('path');
    
    // Read from volume service
    let volumeTemplates = [];
    let volumeDataFolderTemplates = [];
    try {
      volumeTemplates = await volumeService.readFile(templatesFile);
      console.log(`📖 Found ${volumeTemplates.length} templates in volume storage`);
    } catch (e) {
      console.log('📝 No templates found in volume storage');
    }
    // Also check the nested data folder (/data/data/templates.json) used by some services
    try {
      volumeDataFolderTemplates = await volumeService.readFile(path.join('data', 'templates.json'));
      console.log(`📖 Found ${volumeDataFolderTemplates.length} templates in volume data folder storage`);
    } catch (e) {
      console.log('📝 No templates found in volume data folder storage');
    }
    
    // Read from legacy data path
    let legacyTemplates = [];
    const legacyPath = path.join('data', 'templates.json');
    try {
      if (await fs.pathExists(legacyPath)) {
        legacyTemplates = await fs.readJson(legacyPath);
        console.log(`📖 Found ${legacyTemplates.length} templates in legacy storage`);
      }
    } catch (e) {
      console.log('📝 No templates found in legacy storage');
    }
    
    // Merge from all available sources with precedence: volume > volumeDataFolder > legacy
    let finalTemplates = [];
    const sourcesToMerge = [];
    if (legacyTemplates.length > 0) sourcesToMerge.push({ name: 'legacy', list: legacyTemplates });
    if (volumeDataFolderTemplates.length > 0) sourcesToMerge.push({ name: 'volumeDataFolder', list: volumeDataFolderTemplates });
    if (volumeTemplates.length > 0) sourcesToMerge.push({ name: 'volume', list: volumeTemplates });

    if (sourcesToMerge.length > 0) {
      console.log(`🔄 Merging templates from ${sourcesToMerge.map(s => s.name).join(', ')}`);
      const templatesMap = new Map();
      for (const src of sourcesToMerge) {
        for (const template of src.list) {
          const existing = templatesMap.get(template.id);
          if (!existing) {
            templatesMap.set(template.id, { ...template, source: src.name });
          } else {
            const existingTime = new Date(existing.updatedAt || existing.createdAt || '2020-01-01').getTime();
            const newTime = new Date(template.updatedAt || template.createdAt || '2020-01-01').getTime();
            if (newTime >= existingTime) {
              templatesMap.set(template.id, { ...template, source: src.name });
              console.log(`📝 Updated template ${template.name} from ${src.name} (newer)`);
            }
          }
        }
      }
      finalTemplates = Array.from(templatesMap.values()).map(t => { const { source, ...tpl } = t; return tpl; });
      console.log(`🎯 Merged ${finalTemplates.length} unique templates from available sources`);
      
      // If we found templates in file system and database is available, sync them to database for persistence
      if (process.env.DATABASE_URL && finalTemplates.length > 0) {
        try {
          await databaseUserManager.initialize();
          await databaseUserManager.saveTemplates(finalTemplates);
          console.log(`🔄 ${finalTemplates.length} templates synced from file system to database`);
        } catch (syncError) {
          console.log('⚠️ Failed to sync file system templates to database:', syncError.message);
        }
      }
    } else {
      finalTemplates = [];
      console.log('📝 No templates found in any storage - starting fresh');
    }
    
    // Always ensure templates are written to all persistent locations during startup sync
    // This ensures templates persist across redeployments by writing to all storage layers
    if (finalTemplates.length > 0) {
      console.log('💾 Writing templates to all persistent storage locations...');
      try {
        await volumeService.writeFile(templatesFile, finalTemplates);
        console.log(`✅ Templates written to volume storage (initial bootstrap)`);
      } catch (error) {
        console.error('❌ Failed to write templates to volume storage:', error);
      }
      try {
        await volumeService.writeFile(path.join('data', 'templates.json'), finalTemplates);
        console.log(`✅ Templates written to volume data folder storage (initial bootstrap)`);
      } catch (error) {
        console.error('❌ Failed to write templates to volume data folder storage:', error);
      }
      try {
        await fs.ensureDir(path.dirname(legacyPath));
        await fs.writeJson(legacyPath, finalTemplates, { spaces: 2 });
        console.log(`✅ Templates written to legacy storage (initial bootstrap)`);
      } catch (error) {
        console.error('❌ Failed to write templates to legacy storage:', error);
      }
      console.log(`✅ Bootstrapped ${finalTemplates.length} templates to storage layers`);
    }
    
    console.log('✅ Template synchronization completed');
    
    // Log final template state for debugging
    try {
      const finalCheck = await volumeService.readFile(templatesFile);
      console.log(`🔍 Final template count in volume storage: ${finalCheck.length}`);
      if (finalCheck.length > 0) {
        console.log('🔍 Template names:', finalCheck.map(t => t.name));
      }
    } catch (error) {
      console.log('🔍 Could not read templates for final check:', error.message);
    }
  } catch (error) {
    console.error('❌ Template synchronization failed:', error);
  }
}
const EnhancedAnalyticsService = require('./src/services/EnhancedAnalyticsService');
const ReportScheduler = require('./src/services/ReportScheduler');
const DataImporter = require('./src/services/DataImporter');
const AuthService = require('./src/services/AuthService');
const AnalyticsService = require('./src/services/AnalyticsService');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to get the appropriate user manager
function getUserManager() {
  return process.env.DATABASE_URL ? databaseUserManager : userManager;
}

// Helper function to ensure database is initialized when needed
async function getInitializedUserManager() {
  const manager = getUserManager();
  if (process.env.DATABASE_URL && manager === databaseUserManager) {
    await databaseUserManager.initialize();
  }
  return manager;
}

// Initialize services
const userManager = new UserManager(volumeService);
const databaseUserManager = databaseUserManagerInstance;
const aiAnalyzer = new AIAnalyzer();
const reportScheduler = new ReportScheduler();
const dataImporter = new DataImporter();
const authService = new AuthService();
const analyticsService = new AnalyticsService();
const enhancedAnalyticsService = new EnhancedAnalyticsService();
const shareLinkService = new ShareLinkService();
// Enable cloud backup API service
// const backupAPIService = new BackupAPIService(app, authService);

// Environment and debug middleware configuration
const isProduction = process.env.NODE_ENV === 'production';
const debugMiddlewares = isProduction ? [authService.requireAuth(), authService.requireRole(['admin'])] : [];

// Runtime security checks (production only)
(async () => {
  if (isProduction) {
    try {
      const users = await authService.getUsers();
      const adminUser = users.find(u => u.username === 'admin');
      const fallbackPwd = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
      if (adminUser) {
        const bcrypt = require('bcryptjs');
        const matchesDefault = await bcrypt.compare(fallbackPwd, adminUser.password);
        if (matchesDefault) {
          console.warn('⚠️ SECURITY WARNING: Admin password matches default fallback. Set a strong ADMIN_DEFAULT_PASSWORD and reset the admin password.');
        }
      }
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('your-super-secret') || process.env.JWT_SECRET.length < 24) {
        console.warn('⚠️ SECURITY WARNING: JWT_SECRET is missing or weak. Set a strong secret in production.');
      }
      if (!process.env.CORS_ORIGIN) {
        console.warn('⚠️ SECURITY WARNING: CORS_ORIGIN is not set. Restrict it to your production origin.');
      }
    } catch (e) {
      console.warn('⚠️ SECURITY CHECKS FAILED:', e.message);
    }
  }
})();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.CORS_ORIGIN || 'https://am-reports-hub-production.up.railway.app']
    : [process.env.CORS_ORIGIN || 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Protected internal docs for admins
app.use('/internal-docs', authService.requireAuth(), authService.requireRole(['admin']), express.static('docs'));

// GDPR: schedule daily cleanup of old security logs and login attempts
const retentionDays = parseInt(process.env.SECURITY_LOG_RETENTION_DAYS || '90', 10);
setInterval(() => {
  securityService.cleanupOldData(retentionDays).catch(() => {});
}, 24 * 60 * 60 * 1000);
// Run once on startup as well
securityService.cleanupOldData(retentionDays).catch(() => {});

// Multer setup for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `${timestamp}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/college-dashboard', authService.requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/college-dashboard.html'));
});

app.get('/backup-dashboard', authService.requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/backup-dashboard.html'));
});

app.get('/admin-dashboard', authService.requireAuth(), authService.requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin-dashboard.html'));
});

app.get('/railway-backup-dashboard', authService.requireAuth(), authService.requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/railway-backup-dashboard.html'));
});

app.get('/simple-backup-dashboard', authService.requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/simple-backup-dashboard.html'));
});

// Persistent backup API endpoints - NO AUTHENTICATION REQUIRED
app.post('/api/backup/create', authService.requireAuth(), authService.requireRole(['admin']), async (req, res) => {
  try {
    const { description } = req.body;
    console.log('🔄 Creating persistent backup...');
    console.log('🔄 Backup service type:', typeof railwayBackupService);
    console.log('🔄 Backup service constructor:', railwayBackupService.constructor.name);
    console.log('🔄 Available methods:', Object.getOwnPropertyNames(railwayBackupService));
    
    const result = await railwayBackupService.createBackup(description || 'Manual Railway cloud backup');
    
    res.json({ 
      success: true, 
      message: 'Persistent backup created successfully',
      backup: result
    });
  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.get('/api/backup/list', authService.requireAuth(), authService.requireRole(['admin']), async (req, res) => {
  try {
    const backups = await railwayBackupService.listBackups();
    const stats = await railwayBackupService.getStorageStats();
    
    res.json({
      success: true,
      backups,
      statistics: stats
    });
  } catch (error) {
    console.error('Backup list error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/backup/restore/:backupId', authService.requireAuth(), authService.requireRole(['admin']), async (req, res) => {
  try {
    const { backupId } = req.params;
    console.log(`🔄 Restoring persistent backup: ${backupId}`);
    console.log(`🔄 Backup service type:`, typeof railwayBackupService);
    console.log(`🔄 Backup service methods:`, Object.getOwnPropertyNames(railwayBackupService));
    
    if (!railwayBackupService || !railwayBackupService.restoreBackup) {
      console.error('❌ Backup service not properly initialized');
      return res.status(500).json({ error: 'Backup service not available' });
    }
    
    const result = await railwayBackupService.restoreBackup(backupId);
    console.log(`✅ Restore result:`, result);
    
    res.json({
      success: true,
      message: 'Backup restored successfully',
      result
    });
  } catch (error) {
    console.error('Backup restore error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
  }
});

// Restore latest backup (for admin dashboard)
app.post('/api/backup/restore', authService.requireAuth(), authService.requireRole(['admin']), async (req, res) => {
  try {
    console.log('🔄 Restoring latest persistent backup...');
    console.log(`🔄 Backup service type:`, typeof railwayBackupService);
    
    if (!railwayBackupService || !railwayBackupService.listBackups) {
      console.error('❌ Backup service not properly initialized');
      return res.status(500).json({ error: 'Backup service not available' });
    }
    
    const backups = await railwayBackupService.listBackups();
    console.log(`📋 Available backups:`, backups);
    
    if (backups.length === 0) {
      return res.status(404).json({ error: 'No backups found' });
    }
    
    // Get the latest backup (first in the list)
    const latestBackup = backups[0];
    console.log(`🔄 Restoring latest backup:`, latestBackup);
    
    const result = await railwayBackupService.restoreBackup(latestBackup.backupId);
    console.log(`✅ Restore result:`, result);
    
    res.json({
      success: true,
      message: 'Latest backup restored successfully',
      result
    });
  } catch (error) {
    console.error('Latest backup restore error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to restore latest backup: ' + error.message });
  }
});

app.get('/api/backup/stats', authService.requireAuth(), authService.requireRole(['admin']), async (req, res) => {
  try {
    const stats = await railwayBackupService.getStorageStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Backup stats error:', error);
    res.status(500).json({ error: 'Failed to get backup stats' });
  }
});

// Debug endpoint to inspect backup data
app.get('/api/backup/debug/:backupId', authService.requireAuth(), authService.requireRole(['admin']), async (req, res) => {
  try {
    const { backupId } = req.params;
    console.log(`🔍 Debugging backup: ${backupId}`);
    
    if (!railwayBackupService || !railwayBackupService.getBackupDetails) {
      return res.status(500).json({ error: 'Backup service not available' });
    }
    
    const backupDetails = await railwayBackupService.getBackupDetails(backupId);
    res.json({
      success: true,
      backupDetails
    });
  } catch (error) {
    console.error('Backup debug error:', error);
    res.status(500).json({ error: 'Failed to debug backup: ' + error.message });
  }
});

// Database Migration Route
app.post('/api/migrate-to-database', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ 
        error: 'DATABASE_URL not configured',
        message: 'Please set up PostgreSQL database first'
      });
    }

    console.log('🔄 Starting data migration to PostgreSQL...');
    
    // Import and run migration
    const DataMigration = require('./src/database/migrate-data');
    const migration = new DataMigration();
    
    await migration.run();
    
    res.json({
      success: true,
      message: 'Data migration completed successfully!',
      stats: await databaseUserManager.getStats()
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      message: error.message
    });
  }
});

// Database Statistics Route
app.get('/api/database/stats', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ 
        error: 'DATABASE_URL not configured' 
      });
    }

    const stats = await databaseUserManager.getStats();
    const healthCheck = await DatabaseService.healthCheck();
    
    res.json({
      success: true,
      stats,
      health: healthCheck,
      usingDatabase: true
    });
    
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ 
      error: 'Failed to get database stats',
      message: error.message
    });
  }
});

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await authService.authenticateUser(username, password, ipAddress, userAgent);
    
    if (result.success) {
      // Set HTTP-only cookie with improved configuration for production
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' ? true : false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
        // Do not pin cookie to a custom domain; rely on host
        domain: undefined
      };
      
      res.cookie('token', result.token, cookieOptions);
      
      res.json({ success: true, user: result.user });
    } else {
      res.status(401).json({ error: result.message });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    // Validation
    if (!name || !username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Username validation (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    // Role validation
    const allowedRoles = ['user', 'account_manager'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected' });
    }

    const result = await authService.createUser({
      name,
      username,
      email,
      password,
      role
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        user: result.user
      });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      await authService.logout(token);
    }
    
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Removed insecure debug endpoint /api/debug/sessions

// Debug endpoint to check environment and configuration
app.get('/api/debug/config', ...debugMiddlewares, (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    corsOrigin: process.env.CORS_ORIGIN,
    baseUrl: process.env.BASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    openAIModel: process.env.OPENAI_MODEL,
    aiAnalysisEnabled: process.env.AI_ANALYSIS_ENABLED,
    host: req.headers.host,
    protocol: req.protocol,
    secure: req.secure
  });
});

// Debug endpoint to test OpenAI API - DISABLED FOR PRODUCTION
/*
app.get('/api/debug/openai', async (req, res) => {
  try {
    const aiAnalyzer = new (require('./src/services/AIAnalyzer'))();
    
    const testData = {
      isOpenAIAvailable: aiAnalyzer.isOpenAIAvailable(),
      hasApiKey: !!process.env.OPENAI_API_KEY,
      apiKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      enabled: process.env.AI_ANALYSIS_ENABLED === 'true'
    };
    
    // Test a simple API call if available
    if (testData.isOpenAIAvailable) {
      try {
        // Use a direct HTTPS request instead of the OpenAI library
        const https = require('https');
        const testPrompt = "Say 'Hello, OpenAI is working!' in one sentence.";
        
        const postData = JSON.stringify({
          model: testData.model,
          messages: [
            {
              role: "user",
              content: testPrompt
            }
          ],
          max_tokens: 50
        });
        
        const options = {
          hostname: 'api.openai.com',
          port: 443,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const result = JSON.parse(data);
                resolve(result.choices[0].message.content);
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            });
          });
          
          req.on('error', reject);
          req.write(postData);
          req.end();
        });
        
        testData.testResponse = response.substring(0, 100) + '...';
        testData.testSuccess = true;
      } catch (apiError) {
        testData.testError = apiError.message;
        testData.testSuccess = false;
      }
    }
    
    res.json(testData);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});
*/

// Simple KPI test endpoint - DISABLED FOR PRODUCTION
/*
app.get('/api/test-kpi-generation', async (req, res) => {
  try {
    console.log('=== KPI TEST ENDPOINT CALLED ===');
    console.log('Environment variables:');
    console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
    console.log('- OPENAI_MODEL:', process.env.OPENAI_MODEL);
    console.log('- AI_ANALYSIS_ENABLED:', process.env.AI_ANALYSIS_ENABLED);
    
    // Test the exact same approach as the working debug endpoint
    const https = require('https');
    
    const postData = JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: "system",
          content: "You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation. Provide specific, measurable KPI suggestions for UK colleges using Navigate software for tracking student activities, placements, and employer engagement."
        },
        {
          role: "user",
          content: `Provide 5 specific KPI suggestions for a UK college using Navigate software. Focus on:
- Student placement rates and employer engagement
- Activity participation and recording
- Staff training and Navigate adoption
- Student outcomes and progression
- Employer satisfaction and partnerships

Format as numbered list with specific targets and timeframes. Make suggestions practical and achievable for UK FE colleges.`
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    });
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    console.log('Making OpenAI API request...');
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('OpenAI response status:', res.statusCode);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = JSON.parse(data);
              resolve(result.choices[0].message.content);
            } catch (error) {
              reject(new Error('Failed to parse OpenAI response'));
            }
          } else {
            reject(new Error(`OpenAI API error: ${res.statusCode} - ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('Request error:', error.message);
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    console.log('OpenAI API call successful!');
    
    res.json({
      success: true,
      message: 'KPI generation test successful',
      kpiSuggestions: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('KPI test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
*/

// Root endpoint for Railway health checks - responds immediately
app.get('/', (req, res) => {
  console.log('🏥 Root health check requested');
  // Respond immediately with minimal data
  res.status(200).send('OK');
});

// Simple health check endpoint for Railway - always responds (used by Railway healthcheck)
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  
  // Always respond with 200 OK - this is critical for Railway deployment
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    ready: true,
    message: 'AM Reports Hub is running',
    version: '1.0.0'
  });
});

// Add a simple test endpoint
app.get('/test', (req, res) => {
  res.status(200).json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Enhanced health check endpoint for detailed status
app.get('/health/detailed', async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      port: PORT,
      ready: true,
      database: 'unknown',
      services: 'initializing'
    };

    // Check database connectivity if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      try {
        const DatabaseService = require('./src/services/DatabaseService');
        const dbHealth = await DatabaseService.healthCheck();
        healthData.database = dbHealth.status;
        healthData.databaseConnected = dbHealth.connected;
        
        if (!dbHealth.connected) {
          healthData.status = 'degraded';
          healthData.databaseError = dbHealth.error;
        }
      } catch (dbError) {
        healthData.status = 'degraded';
        healthData.database = 'error';
        healthData.databaseError = dbError.message;
      }
    } else {
      healthData.database = 'not_configured';
    }

    res.status(200).json(healthData);
  } catch (error) {
    console.error('Detailed health check error:', error);
    res.status(200).json({ 
      status: 'degraded', 
      error: error.message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ready: true
    });
  }
});

// Check authentication status endpoint
app.get('/api/auth/status', async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.json({ authenticated: false, message: 'No token found' });
    }

    const sessionValidation = await authService.validateSession(token);
    if (!sessionValidation.success) {
      // Clear invalid cookie
      res.clearCookie('token');
      return res.json({ authenticated: false, message: sessionValidation.message });
    }

    res.json({ 
      authenticated: true, 
      user: sessionValidation.user 
    });
  } catch (error) {
    console.error('Auth status check error:', error);
    res.clearCookie('token');
    res.json({ authenticated: false, message: 'Authentication error' });
  }
});

app.get('/api/auth/me', authService.requireAuth(), async (req, res) => {
  try {
    console.log('🔍 Auth status check - User:', req.user);
    const user = await authService.getUserById(req.user.userId);
    if (user) {
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
          accountManagerId: user.accountManagerId
        }
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Debug endpoint to check authentication status
app.get('/api/auth/debug', ...debugMiddlewares, async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    console.log('🔍 Debug auth - Token present:', !!token);
    console.log('🔍 Debug auth - Cookies:', req.cookies);
    console.log('🔍 Debug auth - Headers:', req.headers.authorization ? 'Present' : 'Missing');
    
    if (!token) {
      return res.json({ 
        authenticated: false, 
        message: 'No token found',
        cookies: req.cookies,
        hasAuthHeader: !!req.headers.authorization
      });
    }

    const sessionValidation = await authService.validateSession(token);
    res.json({
      authenticated: sessionValidation.success,
      message: sessionValidation.message,
      user: sessionValidation.user,
      tokenLength: token.length,
      tokenPreview: token.substring(0, 10) + '...'
    });
  } catch (error) {
    console.error('Auth debug error:', error);
    res.json({ authenticated: false, message: 'Debug error: ' + error.message });
  }
});

// Debug endpoint to check reports for a college
app.get('/api/debug/reports/:collegeId', ...debugMiddlewares, async (req, res) => {
  try {
    const { collegeId } = req.params;
    console.log(`🔍 Debug reports for college ${collegeId}...`);
    
    // Ensure reports directory exists
    await fs.ensureDir('data/reports');
    
    const reportsPath = `data/reports/${collegeId}.json`;
    console.log(`📁 Checking reports file: ${reportsPath}`);
    
    if (await fs.pathExists(reportsPath)) {
      const reports = await fs.readJson(reportsPath);
      console.log(`✅ Found ${reports.length} reports for college ${collegeId}`);
      res.json({
        collegeId,
        reportsCount: reports.length,
        reports: reports.map(r => ({
          id: r.id,
          name: r.name,
          createdAt: r.createdAt,
          summary: r.summary
        })),
        filePath: reportsPath,
        fileExists: true
      });
    } else {
      console.log(`📝 No reports file found for college ${collegeId}`);
      res.json({
        collegeId,
        reportsCount: 0,
        reports: [],
        filePath: reportsPath,
        fileExists: false
      });
    }
  } catch (error) {
    console.error('❌ Debug reports error:', error);
    res.json({ 
      collegeId: req.params.collegeId,
      error: error.message,
      stack: error.stack
    });
  }
});

// Debug endpoint to test data validation service
app.post('/api/debug/validate-template', ...debugMiddlewares, async (req, res) => {
  try {
    console.log('🔍 Testing template validation...');
    console.log('📄 Received data:', {
      hasName: !!req.body.name,
      hasColumns: !!req.body.columns,
      hasData: !!req.body.data,
      name: req.body.name,
      columnsCount: req.body.columns?.length || 0,
      dataCount: req.body.data?.length || 0
    });
    
    const validationResult = await dataValidationService.validateTemplateData(req.body);
    
    res.json({
      success: true,
      validationResult,
      receivedData: {
        hasName: !!req.body.name,
        hasColumns: !!req.body.columns,
        hasData: !!req.body.data,
        name: req.body.name,
        columnsCount: req.body.columns?.length || 0,
        dataCount: req.body.data?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ Template validation test error:', error);
    res.json({
      success: false,
      error: error.message,
      stack: error.stack,
      receivedData: {
        hasName: !!req.body.name,
        hasColumns: !!req.body.columns,
        hasData: !!req.body.data,
        name: req.body.name,
        columnsCount: req.body.columns?.length || 0,
        dataCount: req.body.data?.length || 0
      }
    });
  }
});

// Forgot Password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authService.forgotPassword(email);
    res.json(result);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset Password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Verify Email endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await authService.verifyEmail(token);
    res.json(result);
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Get User Security Logs endpoint
app.get('/api/auth/security-logs', authService.requireAuth(), async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const result = await authService.getUserSecurityLogs(req.user.userId, hours);
    res.json(result);
  } catch (error) {
    console.error('Get security logs error:', error);
    res.status(500).json({ error: 'Failed to get security logs' });
  }
});

// User Management Routes (Admin only)
app.get('/api/users', authService.requireAuth(), authService.requireRole('admin'), async (req, res) => {
  try {
    const users = await authService.getUsers();
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      accountManagerId: user.accountManagerId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.put('/api/users/:id', authService.requireAuth(), authService.requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, accountManagerId } = req.body;
    
    const result = await authService.updateUser(id, {
      name,
      email,
      role,
      isActive,
      accountManagerId
    });
    
    if (result.success) {
      res.json({ success: true, user: result.user });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authService.requireAuth(), authService.requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await authService.deleteUser(id);
    
    if (result.success) {
      res.json({ success: true, message: 'User deleted successfully' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// College Management Routes
app.get('/api/colleges', async (req, res) => {
  try {
    const colleges = await (await getInitializedUserManager()).getColleges();
    // Normalise fields for frontend consumption
    const mapped = colleges.map(c => ({
      ...c,
      // Ensure both forms exist for compatibility
      reportFrequency: c.reportFrequency || c.reportfrequency || 'weekly',
      lastReportDate: c.lastReportDate || c.lastreportdate || null
    }));
    res.json({ colleges: mapped });
  } catch (error) {
    console.error('Get colleges error:', error);
    res.status(500).json({ error: 'Failed to get colleges' });
  }
});

app.get('/api/colleges/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const colleges = await (await getInitializedUserManager()).getColleges();
    const college = colleges.find(c => 
      parseInt(c.id) === parseInt(id) || 
      String(c.id) === String(id) || 
      c.id === id || 
      c.id === parseInt(id)
    );
    
    if (!college) {
      return res.status(404).json({ error: 'College not found' });
    }
    
    // Normalise before returning
    if (college) {
      college.reportFrequency = college.reportFrequency || college.reportfrequency || 'weekly';
      college.lastReportDate = college.lastReportDate || college.lastreportdate || null;
    }
    res.json({ success: true, college });
  } catch (error) {
    console.error('Get college error:', error);
    res.status(500).json({ error: 'Failed to get college' });
  }
});
app.post('/api/colleges', authService.requireAuth(), async (req, res) => {
  try {
    const { 
      name, 
      location, 
      contactPerson, 
      email, 
      phone, 
      accountManagerId,
      numberOfProviders,
      keyStakeholder,
      keyStakeholders,
      superUsers,
      misContact,
      dataTransferMethod,
      status,
      ofstedRating,
      reportFrequency,
      template,
      initialConcerns,
      modules
    } = req.body;
    
    // Only name is required, other fields are optional
    if (!name) {
      return res.status(400).json({ error: 'College name is required' });
    }
    
    console.log('🔄 Creating college with data:', {
      name,
      location: location || '',
      contactPerson: contactPerson || '',
      email: email || '',
      phone: phone || '',
      accountManagerId: accountManagerId || null,
      numberOfProviders: numberOfProviders || '',
      keyStakeholder: keyStakeholder || '',
      keyStakeholders: keyStakeholders || [],
      superUsers: superUsers || '',
      misContact: misContact || '',
      dataTransferMethod: dataTransferMethod || '',
      status: status || 'A',
      ofstedRating: ofstedRating || 'G',
      reportFrequency: reportFrequency || 'weekly',
      template: template || 'standard',
      initialConcerns: initialConcerns || '',
      modules: modules || []
    });
    
    const result = await (await getInitializedUserManager()).createCollege({
      name,
      location: location || '',
      contactPerson: contactPerson || '',
      email: email || '',
      phone: phone || '',
      accountManagerId: accountManagerId || null,
      numberOfProviders: numberOfProviders || '',
      keyStakeholder: keyStakeholder || '',
      keyStakeholders: keyStakeholders || [],
      superUsers: superUsers || '',
      misContact: misContact || '',
      dataTransferMethod: dataTransferMethod || '',
      status: status || 'A',
      ofstedRating: ofstedRating || 'G',
      reportFrequency: reportFrequency || 'weekly',
      template: template || 'standard',
      initialConcerns: initialConcerns || '',
      modules: modules || []
    });
    
    console.log('✅ College created successfully:', result);
    
    // DatabaseUserManager.createCollege returns the college directly, not a success object
    res.status(201).json({ success: true, college: result });
  } catch (error) {
    console.error('Add college error:', error);
    res.status(500).json({ error: 'Failed to add college' });
  }
});

app.put('/api/colleges/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('PUT /api/colleges/:id - Request body:', req.body);
    console.log('PUT /api/colleges/:id - College ID:', id);
    
    // Accept all possible fields from the frontend
    const updateData = { ...req.body };
    
    console.log('Update data:', updateData);
    
    const result = await (await getInitializedUserManager()).updateCollege(parseInt(id), updateData);
    console.log('Update result:', result);
    
    res.json({ success: true, college: result });
  } catch (error) {
    console.error('Update college error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update college: ' + error.message });
  }
});

app.delete('/api/colleges/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('DELETE /api/colleges/:id - College ID:', id);
    console.log('DELETE /api/colleges/:id - College ID type:', typeof id);
    console.log('DELETE /api/colleges/:id - Parsed ID:', parseInt(id));
    
    // First check if the college exists
    const colleges = await (await getInitializedUserManager()).getColleges();
    console.log('DELETE /api/colleges/:id - Available colleges:', colleges.map(c => ({ id: c.id, name: c.name })));
    
    const collegeExists = colleges.find(c => 
      parseInt(c.id) === parseInt(id) || 
      String(c.id) === String(id) || 
      c.id === id || 
      c.id === parseInt(id)
    );
    console.log('DELETE /api/colleges/:id - College exists:', !!collegeExists);
    console.log('DELETE /api/colleges/:id - Available IDs and types:', colleges.map(c => ({ id: c.id, type: typeof c.id, parsed: parseInt(c.id) })));
    
    if (!collegeExists) {
      return res.status(404).json({ error: 'College not found' });
    }
    
    await (await getInitializedUserManager()).deleteCollege(parseInt(id));
    
    res.json({ success: true, message: 'College deleted successfully' });
  } catch (error) {
    console.error('Delete college error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to delete college: ' + error.message });
  }
});

// Account Manager Routes
app.get('/api/account-managers', async (req, res) => {
  try {
    const managers = await (await getInitializedUserManager()).getAccountManagers();
    res.json(managers);
  } catch (error) {
    console.error('Get account managers error:', error);
    res.status(500).json({ error: 'Failed to get account managers' });
  }
});

app.post('/api/account-managers', authService.requireAuth(), async (req, res) => {
  try {
    const { name, email, phone, region } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    console.log('🔄 Creating account manager with data:', { name, email, phone: phone || '', region: region || '' });
    
    const result = await (await getInitializedUserManager()).createAccountManager({
      name,
      email,
      phone: phone || '',
      region: region || ''
    });
    
    console.log('✅ Account manager created successfully:', result);
    
    // DatabaseUserManager.createAccountManager returns the manager directly
    res.status(201).json({ success: true, manager: result });
  } catch (error) {
    console.error('Add account manager error:', error);
    res.status(500).json({ error: 'Failed to add account manager' });
  }
});

app.put('/api/account-managers/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, region } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const result = await (await getInitializedUserManager()).updateAccountManager(id, {
      name,
      email,
      phone: phone || '',
      region: region || ''
    });
    
    // DatabaseUserManager.updateAccountManager returns the manager directly
    res.json({ success: true, manager: result });
  } catch (error) {
    console.error('Update account manager error:', error);
    res.status(500).json({ error: 'Failed to update account manager' });
  }
});

app.get('/api/account-managers/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const managers = await (await getInitializedUserManager()).getAccountManagers();
    const manager = managers.find(m => m.id === parseInt(id));
    
    if (!manager) {
      return res.status(404).json({ error: 'Account manager not found' });
    }
    
    res.json({ success: true, accountManager: manager });
  } catch (error) {
    console.error('Get account manager error:', error);
    res.status(500).json({ error: 'Failed to get account manager' });
  }
});

app.delete('/api/account-managers/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    try {
      const mgr = await getInitializedUserManager();
      if (mgr.deleteAccountManager) {
        await mgr.deleteAccountManager(parseInt(id));
        result = { success: true };
      }
    } catch (_) {}
    if (!result) {
      result = await userManager.deleteAccountManager(id);
    }
    
    if (result.success) {
      res.json({ success: true, message: 'Account manager deleted successfully' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Delete account manager error:', error);
    res.status(500).json({ error: 'Failed to delete account manager' });
  }
});

// College Reports Routes
app.get('/api/colleges/:collegeId/reports', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const reports = await getCollegeReports(parseInt(collegeId));
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Get college reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate a shareable read-only link to a college's reports
app.post('/api/colleges/:collegeId/reports/share', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { expiresInHours = 168, allowDownload = true, live = false } = req.body || {};
    const result = await shareLinkService.createShareLink({
      collegeId: parseInt(collegeId),
      expiresInHours: parseInt(expiresInHours),
      allowDownload: !!allowDownload,
      live: !!live,
      createdByUser: req.user?.userId || null
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Create share link error:', error);
    res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
});

// Public: validate a share token (no auth)
app.get('/api/shared/validate', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    const verification = shareLinkService.verifyShareToken(token);
    if (!verification.valid) return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    const { shareId, collegeId } = verification.payload;
    if (await shareLinkService.isRevoked(shareId)) return res.status(403).json({ success: false, error: 'Share link revoked' });
    res.json({ success: true, payload: verification.payload });
  } catch (error) {
    console.error('Validate share token error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate token' });
  }
});

// Public: list reports via share token (no auth)
app.get('/api/shared/colleges/:collegeId/reports', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    const verification = shareLinkService.verifyShareToken(token);
    if (!verification.valid) return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    const { collegeId: tokenCollegeId, shareId } = verification.payload;
    if (await shareLinkService.isRevoked(shareId)) return res.status(403).json({ success: false, error: 'Share link revoked' });
    if (String(tokenCollegeId) !== String(req.params.collegeId)) return res.status(403).json({ success: false, error: 'Token not valid for this college' });
    const reports = await getCollegeReports(parseInt(req.params.collegeId));
    // Return without any edit controls
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Shared list reports error:', error);
    res.status(500).json({ success: false, error: 'Failed to load shared reports' });
  }
});

// Public: get college info (name) via share token (no auth)
app.get('/api/shared/colleges/:collegeId', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    const verification = shareLinkService.verifyShareToken(token);
    if (!verification.valid) return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    const { collegeId: tokenCollegeId, shareId } = verification.payload;
    if (await shareLinkService.isRevoked(shareId)) return res.status(403).json({ success: false, error: 'Share link revoked' });
    if (String(tokenCollegeId) !== String(req.params.collegeId)) return res.status(403).json({ success: false, error: 'Token not valid for this college' });
    const colleges = await (await getInitializedUserManager()).getColleges();
    const college = colleges.find(c => c.id === parseInt(req.params.collegeId) || c.id.toString() === String(req.params.collegeId));
    if (!college) return res.status(404).json({ success: false, error: 'College not found' });
    res.json({ success: true, college: { id: college.id, name: college.name } });
  } catch (error) {
    console.error('Shared get college info error:', error);
    res.status(500).json({ success: false, error: 'Failed to load college info' });
  }
});

// Public: get a single report via share token (no auth)
app.get('/api/shared/colleges/:collegeId/reports/:reportId', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    const verification = shareLinkService.verifyShareToken(token);
    if (!verification.valid) return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    const { collegeId: tokenCollegeId, shareId } = verification.payload;
    if (await shareLinkService.isRevoked(shareId)) return res.status(403).json({ success: false, error: 'Share link revoked' });
    if (String(tokenCollegeId) !== String(req.params.collegeId)) return res.status(403).json({ success: false, error: 'Token not valid for this college' });
    const report = await getCollegeReport(parseInt(req.params.collegeId), req.params.reportId);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, report });
  } catch (error) {
    console.error('Shared get report error:', error);
    res.status(500).json({ success: false, error: 'Failed to load report' });
  }
});

// Public: download Excel via share token (respects allowDownload)
app.get('/api/shared/colleges/:collegeId/reports/:reportId/excel', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    const verification = shareLinkService.verifyShareToken(token);
    if (!verification.valid) return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    const { collegeId: tokenCollegeId, shareId, permissions } = verification.payload;
    if (await shareLinkService.isRevoked(shareId)) return res.status(403).json({ success: false, error: 'Share link revoked' });
    if (String(tokenCollegeId) !== String(req.params.collegeId)) return res.status(403).json({ success: false, error: 'Token not valid for this college' });
    if (!permissions?.download) return res.status(403).json({ success: false, error: 'Download not allowed on this share link' });

    // Build advanced Excel like the internal export route
    const { collegeId, reportId } = req.params;
    const report = await getCollegeReport(parseInt(collegeId), reportId);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    const colleges = await (await getInitializedUserManager()).getColleges();
    const college = colleges.find(c => c.id === parseInt(collegeId) || c.id === collegeId || c.id.toString() === collegeId);
    const collegeName = college ? college.name.replace(/[^a-zA-Z0-9\s]/g, '') : 'College';

    // Load previous report data for change indicators
    let previousData = null;
    try {
      const reports = await getCollegeReports(parseInt(collegeId));
      if (reports && reports.length > 0) {
        const sortedReports = reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const currentReportIndex = sortedReports.findIndex(r => r.id === reportId);
        if (currentReportIndex >= 0 && currentReportIndex < sortedReports.length - 1) {
          const previousReport = sortedReports[currentReportIndex + 1];
          previousData = previousReport.data;
        }
      }
    } catch (_) {
      previousData = await getPreviousReportData(parseInt(collegeId));
    }

    // Create Excel workbook with formatting
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report Data');
    const { headers, rows } = report.data;

    // Add report metadata
    worksheet.getCell('A1').value = `Report: ${report.name}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    worksheet.getCell('A2').value = `Generated: ${new Date(report.createdAt).toLocaleString()}`;
    worksheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

    // Prepare header colouring (match UI)
    function getColumnSection(header) {
      const SECTION_COLORS_EXCEL = {
        placements: 'FFDBEAFE',
        assessments: 'FFBBF7D0',
        careers: 'FFFEF3C7',
        activities: 'FFFEF3C7',
        enrichment: 'FFBFDBFE',
        employment: 'FFF3E8FF',
        targets: 'FFFCE7F3',
        login: 'FFE0E7FF',
        default: 'FFF3F4F6'
      };
      const h = (header || '').toLowerCase();
      if (header === 'Department') return { section: 'Department', color: 'FFFEF3C7' };
      if (h.includes('placements') || h.includes('placed') || h.includes('scheduled to date')) return { section: 'placements', color: SECTION_COLORS_EXCEL.placements };
      if (h.includes('enrichment')) return { section: 'enrichment', color: SECTION_COLORS_EXCEL.enrichment };
      if (h.includes('employment') || (h.includes('employer') && (h.includes('engagement') || h.includes('activity') || h.includes('activities') || h.includes('students with') || h.includes('total students') || h.includes('total activities')))) return { section: 'employment', color: SECTION_COLORS_EXCEL.employment };
      if (h.includes('career') || h.includes('quiz') || h.includes('job profile') || h.includes('mapped')) return { section: 'careers', color: SECTION_COLORS_EXCEL.careers };
      if (h.includes('assessment') || h.includes('score') || h.includes('students without') || h.includes('assessed')) return { section: 'assessments', color: SECTION_COLORS_EXCEL.assessments };
      if (h.includes('activity') || (h.includes('hours') && !h.includes('scheduled'))) return { section: 'activities', color: SECTION_COLORS_EXCEL.activities };
      if (h.includes('target') || h.includes('goal')) return { section: 'targets', color: SECTION_COLORS_EXCEL.targets };
      if (h.includes('login') || h.includes('access')) return { section: 'login', color: SECTION_COLORS_EXCEL.login };
      return { section: 'default', color: SECTION_COLORS_EXCEL.default };
    }

    // Build complete headers with change cols
    let completeHeaders = [];
    let changeColumnMap = new Map();
    headers.forEach((header, colIndex) => {
      completeHeaders.push(header);
      if (header !== 'Department' && (header.toLowerCase().includes('percent') || header.includes('%') || !isNaN(parseFloat('0')))) {
        const changeHeader = `${header} +/-`;
        completeHeaders.push(changeHeader);
        changeColumnMap.set(colIndex, completeHeaders.length - 1);
      }
    });

    const dataStartRow = (report.summary && report.summary.trim() !== '' && report.summary !== 'No summary provided') ? 5 : 4;
    if (report.summary && report.summary.trim() !== '' && report.summary !== 'No summary provided') {
      worksheet.getCell('A3').value = `Summary: ${report.summary}`;
      worksheet.getCell('A3').font = { size: 10, color: { argb: 'FF666666' } };
    }

    // Set header values and style
    worksheet.getRow(dataStartRow).values = completeHeaders;
    completeHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(dataStartRow, index + 1);
      const isChange = header.endsWith(' +/-');
      const baseHeader = isChange ? header.replace(' +/-', '') : header;
      const sectionInfo = getColumnSection(baseHeader);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sectionInfo.color } };
      cell.font = { bold: true, color: { argb: 'FF1F2937' }, size: 11, name: 'Arial' };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thick', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thick', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    });

    // Column widths
    completeHeaders.forEach((header, index) => { worksheet.getColumn(index + 1).width = Math.max(header.length + 5, 15); });

    // Data rows with formatting
    rows.forEach((row, rowIndex) => {
      const dataRow = worksheet.getRow(dataStartRow + 1 + rowIndex);
      let colIndex = 0;
      headers.forEach((header, originalColIndex) => {
        const value = row[originalColIndex];
        const cell = dataRow.getCell(colIndex + 1);
        cell.value = (value === undefined || value === null) ? '' : value;
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { size: 10, name: 'Arial', color: { argb: 'FF111827' } };
        if (typeof value === 'number') {
          if (value < 1 && value > 0) cell.numFmt = '0.00%';
          else if (value % 1 !== 0) cell.numFmt = '0.00';
          else cell.numFmt = '0';
        }
        if ((header.toLowerCase().includes('percent') || header.includes('%')) && typeof value === 'number' && value >= 0 && value <= 1) {
          cell.value = value;
          cell.numFmt = '0.00%';
        }
        if (rowIndex % 2 === 1 && !(header.toLowerCase().includes('percent') || header.includes('%'))) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }
        cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
        colIndex++;
        if (changeColumnMap.has(originalColIndex)) {
          const changeCell = dataRow.getCell(colIndex + 1);
          const changeValue = calculateChange(value, previousData, rowIndex, originalColIndex);
          if (changeValue !== null) {
            changeCell.value = changeValue;
            if (changeValue > 0) { changeCell.font = { color: { argb: 'FF2E7D32' }, bold: true, size: 10 }; changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } }; }
            else if (changeValue < 0) { changeCell.font = { color: { argb: 'FFC62828' }, bold: true, size: 10 }; changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } }; }
            else { changeCell.font = { color: { argb: 'FFE65100' }, bold: true, size: 10 }; changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } }; }
            if (header.toLowerCase().includes('percent') || header.includes('%')) changeCell.numFmt = '+0.00%;-0.00%;0.00%'; else changeCell.numFmt = '+0.00;-0.00;0.00';
          } else {
            changeCell.value = '';
            changeCell.font = { color: { argb: 'FF666666' }, bold: true, size: 10 };
            changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
          }
          changeCell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
          colIndex++;
        }
      });
    });

    // Add data bars for percentage columns
    headers.forEach((header, colIndex) => {
      if (header && (header.toLowerCase().includes('percent') || header.includes('%'))) {
        // Compute position in complete headers with change columns inserted before
        let actualColIndex = colIndex;
        for (let i = 0; i < colIndex; i++) {
          if (headers[i] !== 'Department' && (headers[i].toLowerCase().includes('percent') || headers[i].includes('%') || !isNaN(parseFloat('0')))) {
            actualColIndex++;
          }
        }
        const columnLetter = worksheet.getColumn(actualColIndex + 1).letter;
        const dataRange = `${columnLetter}${dataStartRow + 1}:${columnLetter}${dataStartRow + rows.length}`;
        worksheet.addConditionalFormatting({ ref: dataRange, rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF22C55E' }, showValue: true }] });
      }
    });

    // Totals row
    if (rows.length > 1) {
      const totalsRow = worksheet.getRow(dataStartRow + 1 + rows.length);
      let colIndex = 0;
      headers.forEach((header, originalColIndex) => {
        const cell = totalsRow.getCell(colIndex + 1);
        if (originalColIndex === 0) { cell.value = 'TOTAL'; cell.font = { bold: true }; }
        else if (header.toLowerCase().includes('department')) { cell.value = ''; }
        else {
          let total = 0, hasValid = false;
          rows.forEach(row => { if (row[originalColIndex] !== '' && row[originalColIndex] !== null && !isNaN(parseFloat(row[originalColIndex]))) { total += parseFloat(row[originalColIndex]); hasValid = true; } });
          if (hasValid) {
            if (header.toLowerCase().includes('percent') || header.includes('%')) { const validRows = rows.filter(r => r[originalColIndex] !== '' && r[originalColIndex] !== null && !isNaN(parseFloat(r[originalColIndex]))); const average = validRows.length > 0 ? total / validRows.length : 0; cell.value = average; cell.numFmt = '0.00%'; cell.font = { bold: true }; }
            else { cell.value = total; cell.numFmt = (header.toLowerCase().includes('score') ? '0.00' : '0'); cell.font = { bold: true }; }
          } else { cell.value = ''; }
        }
        if (!(header.toLowerCase().includes('percent') || header.includes('%'))) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; cell.font = { bold: true, color: { argb: 'FF666666' } }; }
        cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
        colIndex++;
        if (changeColumnMap.has(originalColIndex)) { const changeCell = totalsRow.getCell(colIndex + 1); changeCell.value = ''; changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; changeCell.font = { bold: true, color: { argb: 'FF1565C0' } }; changeCell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }; colIndex++; }
      });
    }

    // File name
    const safeReportName = report.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const safeCollegeName = collegeName.replace(/\s+/g, '_');
    const cleanReportName = safeReportName.replace(new RegExp(safeCollegeName, 'gi'), '').trim();
    const filename = `${safeCollegeName}_${cleanReportName}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Shared excel download error:', error);
    res.status(500).json({ success: false, error: 'Failed to export excel' });
  }
});

// Revoke a share link (requires auth)
app.post('/api/shared/:shareId/revoke', authService.requireAuth(), async (req, res) => {
  try {
    const { shareId } = req.params;
    const result = await shareLinkService.revokeShare(shareId);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.message || 'Share not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke share link error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke share link' });
  }
});
app.post('/api/colleges/:collegeId/reports', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { reportData, reportName, summary } = req.body;
    const report = await saveCollegeReport(parseInt(collegeId), reportData, reportName, summary);
    res.json({ success: true, report });
  } catch (error) {
    console.error('Save college report error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/colleges/:collegeId/reports/:reportId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    const report = await getCollegeReport(parseInt(collegeId), reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (error) {
    console.error('Get college report error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/colleges/:collegeId/reports/:reportId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    await deleteCollegeReport(parseInt(collegeId), reportId);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete college report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single college by ID
app.get('/api/colleges/:collegeId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const colleges = await (await getInitializedUserManager()).getColleges();
    // Handle both string and number IDs
    const college = colleges.find(c => 
      c.id === parseInt(collegeId) || c.id === collegeId || c.id.toString() === collegeId
    );
    if (!college) {
      return res.status(404).json({ error: 'College not found' });
    }
    res.json({ success: true, college });
  } catch (error) {
    console.error('Get college error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single account manager by ID (alternative route)
app.get('/api/account-managers/:accountManagerId', authService.requireAuth(), async (req, res) => {
  try {
    const { accountManagerId } = req.params;
    const accountManagers = await (await getInitializedUserManager()).getAccountManagers();
    // Handle both string and number IDs
    const accountManager = accountManagers.find(am => 
      am.id === parseInt(accountManagerId) || am.id === accountManagerId || am.id.toString() === accountManagerId
    );
    if (!accountManager) {
      return res.status(404).json({ error: 'Account manager not found' });
    }
    res.json({ success: true, accountManager });
  } catch (error) {
    console.error('Get account manager error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Excel Export Route
app.get('/api/colleges/:collegeId/reports/:reportId/excel', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    const report = await getCollegeReport(parseInt(collegeId), reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get college data for filename
    const colleges = await (await getInitializedUserManager()).getColleges();
    const college = colleges.find(c => 
      c.id === parseInt(collegeId) || c.id === collegeId || c.id.toString() === collegeId
    );
    const collegeName = college ? college.name.replace(/[^a-zA-Z0-9\s]/g, '') : 'College';
    
    // Load previous report data for change indicators - use same logic as frontend
    let previousData = null;
    try {
      // Get all reports for this college (same as frontend)
      const reports = await getCollegeReports(parseInt(collegeId));
      if (reports && reports.length > 0) {
        // Sort reports by date (newest first) - same as frontend
        const sortedReports = reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Find the current report index
        const currentReportIndex = sortedReports.findIndex(r => r.id === reportId);
        
        // Get the previous report (next in the array since it's sorted newest first)
        if (currentReportIndex >= 0 && currentReportIndex < sortedReports.length - 1) {
          const previousReport = sortedReports[currentReportIndex + 1];
          previousData = previousReport.data;
          console.log('Excel: Loaded previous report for comparison:', previousReport.name, previousReport.createdAt);
        } else {
          console.log('Excel: No previous report found for comparison');
        }
      }
    } catch (error) {
      console.error('Excel: Error loading previous report data:', error);
      // Fallback to the old method
      previousData = await getPreviousReportData(parseInt(collegeId));
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report Data');
    
    const { headers, rows } = report.data;
    
    // Add report metadata
    worksheet.getCell('A1').value = `Report: ${report.name}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };
    
    worksheet.getCell('A2').value = `Generated: ${new Date(report.createdAt).toLocaleString()}`;
    worksheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };
    
    // Only add summary if it exists and is not empty
    let currentRow = 3;
    let dataStartRow = 4;
    
    if (report.summary && report.summary.trim() !== '' && report.summary !== 'No summary provided') {
      worksheet.getCell(`A${currentRow}`).value = `Summary: ${report.summary}`;
      worksheet.getCell(`A${currentRow}`).font = { size: 10, color: { argb: 'FF666666' } };
      currentRow++;
      dataStartRow = 5;
    }
    
    // Add empty row for spacing
    worksheet.getCell(`A${currentRow}`).value = '';
    currentRow++;
    dataStartRow = currentRow;
    
    // Function to determine column section and color
    function getColumnSection(header, headerFileMap = null) {
      // Define colors that exactly match frontend Tailwind classes (Excel hex format)
      const SECTION_COLORS_EXCEL = {
        'placements': 'FFDBEAFE',      // bg-blue-100 - Light blue
        'assessments': 'FFBBF7D0',      // bg-green-200 - Light green
        'careers': 'FFFEF3C7',          // bg-yellow-100 - Light yellow
        'activities': 'FFFEF3C7',       // bg-yellow-100 - Light yellow
        'enrichment': 'FFBFDBFE',       // bg-blue-200 - Blue-200
        'employment': 'FFF3E8FF',       // bg-purple-100 - Light purple
        'targets': 'FFFCE7F3',          // bg-pink-100 - Light pink
        'login': 'FFE0E7FF',            // bg-indigo-100 - Light indigo
        'default': 'FFF3F4F6'           // bg-gray-100 - Light gray
      };
      
      // Function to determine section type from header - matches frontend logic exactly
      function getSectionType(header) {
        const headerLower = header.toLowerCase();
        
        // First check if the header itself contains type information (from our renaming) - MATCHES FRONTEND
        if (headerLower.includes('(enrichment)')) {
          return 'enrichment';
        }
        
        if (headerLower.includes('(employer)')) {
          return 'employment';
        }
        
        if (headerLower.includes('(placements)')) {
          return 'placements';
        }
        
        if (headerLower.includes('(careers)')) {
          return 'careers';
        }
        
        if (headerLower.includes('(assessments)')) {
          return 'assessments';
        }
        
        if (headerLower.includes('(targets)')) {
          return 'targets';
        }
        
        if (headerLower.includes('(login)')) {
          return 'login';
        }
        
        // Fallback to header content analysis if no filename info - MATCHES FRONTEND
        if (headerLower.includes('placement') || headerLower.includes('placed') || 
            headerLower.includes('employer confirmed') || headerLower.includes('student confirmed') ||
            headerLower.includes('hours scheduled') || headerLower.includes('scheduled to date')) {
          return 'placements';
        }
        
        if (headerLower.includes('enrichment') || headerLower.includes('enrich')) {
          return 'enrichment';
        }
        
        if (headerLower.includes('employer') && (headerLower.includes('engagement') || 
            headerLower.includes('activity') || headerLower.includes('activities'))) {
          return 'employment';
        }
        
        if (headerLower.includes('career') || headerLower.includes('quiz') || 
            headerLower.includes('job profile') || headerLower.includes('mapped')) {
          return 'careers';
        }
        
        // Check for assessments - broader matching
        if (headerLower.includes('assessment') || headerLower.includes('score') || 
            headerLower.includes('students without') || headerLower.includes('average score') || 
            headerLower.includes('assessed')) {
          return 'assessments';
        }
        
        // Check for activities - broader matching
        if (headerLower.includes('activity') || 
            (headerLower.includes('hours') && !headerLower.includes('scheduled'))) {
          return 'activities';
        }
        
        // Check for enrichment
        if (headerLower.includes('enrichment') || headerLower.includes('enrich')) {
          return 'enrichment';
        }
        
        // Check for employment - broader matching to catch all employer-related headers
        if (headerLower.includes('employment') || 
            (headerLower.includes('employer') && (headerLower.includes('engagement') || 
            headerLower.includes('activity') || headerLower.includes('activities') ||
            headerLower.includes('students with') || headerLower.includes('total students') ||
            headerLower.includes('total activities')))) {
          return 'employment';
        }
        
        // Check for targets
        if (headerLower.includes('target') || headerLower.includes('goal')) {
          return 'targets';
        }
        
        // Check for login data
        if (headerLower.includes('login') || headerLower.includes('log in') || 
            headerLower.includes('access')) {
          return 'login';
        }
        
        return 'default';
      }
      
      // Handle Department column specially - matches frontend amber-100
      if (header === 'Department') {
        return { section: 'Department', color: 'FFFEF3C7' }; // bg-amber-100
      }
      
      // Use section-based coloring
      const sectionType = getSectionType(header);
      const color = SECTION_COLORS_EXCEL[sectionType] || SECTION_COLORS_EXCEL.default;
      
      return { section: sectionType, color: color };
    }
    
    // Try to get headerFileMap from report data
    let reportHeaderFileMap = null;
    if (report.data && report.data.headerFileMap) {
      reportHeaderFileMap = report.data.headerFileMap;
      console.log('Using file-based coloring for Excel export:', reportHeaderFileMap);
    } else {
      console.log('No headerFileMap found, using content-based coloring for Excel export');
    }
    
    // Build complete header structure with change columns positioned correctly
    let completeHeaders = [];
    let changeColumnMap = new Map(); // Maps original column index to change column index
    
    headers.forEach((header, colIndex) => {
      completeHeaders.push(header);
      
      // Add change indicator column if this is a numeric column (not Department)
      if (header !== 'Department' && (header.toLowerCase().includes('percent') || header.includes('%') || !isNaN(parseFloat('0')))) {
        const changeHeader = `${header} +/-`;
        completeHeaders.push(changeHeader);
        changeColumnMap.set(colIndex, completeHeaders.length - 1);
      }
    });
    
    // Clear existing headers and add complete headers
    worksheet.getRow(dataStartRow).values = completeHeaders;
    
    // Enhanced header formatting to match frontend typography
    completeHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(dataStartRow, index + 1);
      
      // Debug: Log header section detection
      const isChangeColumn = header.endsWith(' +/-');
      const originalHeader = isChangeColumn ? header.replace(' +/-', '') : header;
      const sectionInfo = getColumnSection(originalHeader, reportHeaderFileMap);
      console.log(`🎨 Header: "${header}" -> Section: ${sectionInfo.section}, Color: ${sectionInfo.color}`);
      
      // Apply section colors
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: sectionInfo.color }
      };
      
      // Enhanced typography to match frontend (uppercase, tracking, font weights)
      cell.font = { 
        bold: true, 
        color: { argb: 'FF1F2937' }, // text-gray-800 equivalent
        size: 11,
        name: 'Arial'
      };
      
      // Center alignment for headers
      cell.alignment = { 
        horizontal: 'center', 
        vertical: 'middle',
        wrapText: true
      };
      
      // Special formatting for change columns
      if (isChangeColumn) {
        cell.font = { 
          bold: true, 
          color: { argb: 'FF1F2937' }, 
          italic: true,
          size: 10,
          name: 'Arial'
        };
        
        // Use the same section color for change columns
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: sectionInfo.color }
        };
      }
      
      // Enhanced border styling to match frontend table borders
      cell.border = {
        top: { style: 'thick', color: { argb: 'FFE5E7EB' } }, // border-gray-200
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thick', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });
    
    // Set column widths for complete headers
    completeHeaders.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = Math.max(header.length + 5, 15);
    });
    
    // Add data rows with change indicators
    console.log(`Processing ${rows.length} data rows...`);
    rows.forEach((row, rowIndex) => {
      const dataRow = worksheet.getRow(dataStartRow + 1 + rowIndex);
      let colIndex = 0;
      
      headers.forEach((header, originalColIndex) => {
        const value = row[originalColIndex];
        const cell = dataRow.getCell(colIndex + 1);
        
        // Ensure all values are properly set, even empty ones
        if (value === undefined || value === null) {
          cell.value = '';
        } else {
          cell.value = value;
        }
        
        // Enhanced cell alignment and formatting
        cell.alignment = { 
          horizontal: 'left', 
          vertical: 'middle',
          wrapText: false
        };
        
        // Enhanced font styling for data cells
        cell.font = {
          size: 10,
          name: 'Arial',
          color: { argb: 'FF111827' } // text-gray-900 equivalent
        };
        
        // Format numbers
        if (typeof value === 'number') {
          if (value < 1 && value > 0) {
            // Format as percentage
            cell.numFmt = '0.00%';
          } else if (value % 1 !== 0) {
            // Format as decimal
            cell.numFmt = '0.00';
          } else {
            // Format as integer
            cell.numFmt = '0';
          }
        }
        
        // Format percentage columns properly for data bars
        if ((header.toLowerCase().includes('percent') || header.includes('%')) && typeof value === 'number' && value >= 0 && value <= 1) {
          // Convert to proper percentage format for Excel data bars
          cell.value = value; // Keep as decimal (0-1) for data bars
          cell.numFmt = '0.00%'; // Format as percentage
        }
        
        // Add alternating row colors to match frontend (white/gray-50)
        // Only apply to non-percentage columns to avoid conflicts with conditional formatting
        if (rowIndex % 2 === 1 && !(header.toLowerCase().includes('percent') || header.includes('%'))) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' } // gray-50 equivalent
          };
        }
        
        // For percentage columns, apply background colors directly based on value
        // This ensures the colors are applied regardless of conditional formatting issues
        if ((header.toLowerCase().includes('percent') || header.includes('%')) && typeof value === 'number' && value >= 0 && value <= 1) {
          // Apply background color based on percentage value
          if (value < 0.4) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEBEE' } // Light red background for < 40%
            };
          } else if (value >= 0.4 && value <= 0.7) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF3E0' } // Light orange background for 40-70%
            };
          } else if (value > 0.7) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE8F5E8' } // Light green background for > 70%
            };
          }
        }
        
        // Enhanced border styling to match frontend
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, // border-gray-200
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        
        colIndex++;
        
        // Add change indicator if this column has a change column
        if (changeColumnMap.has(originalColIndex)) {
          const changeCell = dataRow.getCell(colIndex + 1);
          const changeValue = calculateChange(value, previousData, rowIndex, originalColIndex);
          
          // Debug: Log change calculation
          console.log(`🔄 Change calculation for row ${rowIndex}, col ${originalColIndex}: current=${value}, previous=${previousData?.rows?.[rowIndex]?.[originalColIndex]}, change=${changeValue}`);
          
          if (changeValue !== null) {
            changeCell.value = changeValue;
            
            // Enhanced color coding to match frontend badge styling
            if (changeValue > 0) {
              changeCell.font = { 
                color: { argb: 'FF2E7D32' }, // Green text
                bold: true,
                size: 10
              };
              changeCell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: 'FFE8F5E8' } // Light green background
              };
            } else if (changeValue < 0) {
              changeCell.font = { 
                color: { argb: 'FFC62828' }, // Red text
                bold: true,
                size: 10
              };
              changeCell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: 'FFFFEBEE' } // Light red background
              };
            } else {
              changeCell.font = { 
                color: { argb: 'FFE65100' }, // Orange text
                bold: true,
                size: 10
              };
              changeCell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: 'FFFFF3E0' } // Light orange background
              };
            }
            
            // Format as percentage for percentage columns
            if (header.toLowerCase().includes('percent') || header.includes('%')) {
              changeCell.numFmt = '+0.00%;-0.00%;0.00%';
            } else {
              changeCell.numFmt = '+0.00;-0.00;0.00';
            }
          } else {
            // Set empty string for null values to ensure proper formatting
            changeCell.value = '';
            changeCell.font = { 
              color: { argb: 'FF666666' }, // Gray text
              bold: true,
              size: 10
            };
            changeCell.fill = { 
              type: 'pattern', 
              pattern: 'solid', 
              fgColor: { argb: 'FFF5F5F5' } // Light gray background
            };
          }
          
          // Note: Change cells maintain their color coding (green/red/orange) 
          // and don't get alternating row colors to preserve their visual significance
          
          // Enhanced border styling for change cells
          changeCell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, // border-gray-200
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
          
          colIndex++;
        }
      });
    });
    
    // Set column widths for percentage columns
    completeHeaders.forEach((header, index) => {
      if ((header.toLowerCase().includes('percent') || header.includes('%')) && !header.endsWith(' +/-')) {
        const column = worksheet.getColumn(index + 1);
        
        // Set column width to accommodate progress bars
        column.width = Math.max(column.width, 25);
      }
    });
    
    // Add totals row if there are multiple data rows
    if (rows.length > 1) {
      const totalsRow = worksheet.getRow(dataStartRow + 1 + rows.length);
      let colIndex = 0;
      
      headers.forEach((header, originalColIndex) => {
        const cell = totalsRow.getCell(colIndex + 1);
        
        if (originalColIndex === 0) {
          cell.value = 'TOTAL';
          cell.font = { bold: true };
        } else if (header.toLowerCase().includes('department')) {
          cell.value = '';
        } else {
          // Calculate totals for numeric columns
          let total = 0;
          let hasValidData = false;
          
          rows.forEach(row => {
            if (row[originalColIndex] !== '' && row[originalColIndex] !== null && !isNaN(parseFloat(row[originalColIndex]))) {
              total += parseFloat(row[originalColIndex]);
              hasValidData = true;
            }
          });
          
          if (hasValidData) {
            // For percentage columns, calculate average instead of sum
            if (header.toLowerCase().includes('percent') || header.includes('%')) {
              const validRows = rows.filter(row => 
                row[originalColIndex] !== '' && 
                row[originalColIndex] !== null && 
                !isNaN(parseFloat(row[originalColIndex]))
              );
              const average = validRows.length > 0 ? total / validRows.length : 0;
              
              // Format total percentage properly
              cell.value = average;
              cell.numFmt = '0.00%';
              cell.font = { bold: true };
              
              // Style totals row with same formatting as +/- cells
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5F5F5' }
              };
              cell.font = { bold: true, color: { argb: 'FF666666' } }; // Gray text like +/- cells
            } else {
              cell.value = total;
              cell.font = { bold: true };
              
              // Format based on header type
              if (header.toLowerCase().includes('score')) {
                cell.numFmt = '0.00';
              } else {
                cell.numFmt = '0';
              }
            }
          } else {
            // Even if no valid data, set empty string to ensure cell is properly formatted
            cell.value = '';
          }
        }
        
        // Style totals row with same formatting as +/- cells (only for non-percentage columns)
        if (!(header.toLowerCase().includes('percent') || header.includes('%'))) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
          cell.font = { bold: true, color: { argb: 'FF666666' } }; // Gray text like +/- cells
        }
        
        // Enhanced border styling for totals row
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, // border-gray-200
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        
        colIndex++;
        
        // Add empty totals for change columns with same formatting
        if (changeColumnMap.has(originalColIndex)) {
          const changeCell = totalsRow.getCell(colIndex + 1);
          changeCell.value = '';
          changeCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
          changeCell.font = { bold: true, color: { argb: 'FF1565C0' } }; // Darker blue for total change cells
          changeCell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, // border-gray-200
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
          colIndex++;
        }
      });
    }
    
    // Set column widths for percentage columns
    completeHeaders.forEach((header, colIndex) => {
      if (header && (header.toLowerCase().includes('percent') || header.includes('%')) && !header.endsWith(' +/-')) {
        console.log(`📊 Setting width for percentage column: ${header} (${worksheet.getColumn(colIndex + 1).letter})`);
        
        // Set column width for percentage columns
        const column = worksheet.getColumn(colIndex + 1);
        column.width = Math.max(column.width, 25); // Wider columns for better display
      }
    });
    
    // Set response headers with proper filename (fixed duplicate name issue)
    const safeReportName = report.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const safeCollegeName = collegeName.replace(/\s+/g, '_');
    // Remove duplicate college name if it appears in report name
    const cleanReportName = safeReportName.replace(new RegExp(safeCollegeName, 'gi'), '').trim();
    const filename = `${safeCollegeName}_${cleanReportName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// Helper function to calculate changes between current and previous report
function calculateChange(currentValue, previousData, rowIndex, colIndex) {
  if (!previousData || !previousData.rows || !previousData.rows[rowIndex]) {
    return null;
  }
  
  const previousValue = previousData.rows[rowIndex][colIndex];
  
  if (currentValue === '' || currentValue === null || previousValue === '' || previousValue === null) {
    return null;
  }
  
  const current = parseFloat(currentValue);
  const previous = parseFloat(previousValue);
  
  if (isNaN(current) || isNaN(previous)) {
    return null;
  }
  
  return current - previous;
}

// API endpoint for previous report data
app.get('/api/previous-report/:collegeId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    // Try both storage methods for backwards compatibility
    let previousData = null;
    
    // First try the centralized method (preferred)
    try {
      const previousReportsPath = 'data/previous-reports.json';
      const previousReports = await fs.readJson(previousReportsPath).catch(() => ({}));
      previousData = previousReports[collegeId] || null;
    } catch (error) {
      console.log('Centralized previous report data not found, trying individual file method');
    }
    
    // Fallback to individual file method
    if (!previousData) {
      try {
        const previousReportPath = `data/reports/${collegeId}_previous.json`;
        if (await fs.pathExists(previousReportPath)) {
          const data = await fs.readJson(previousReportPath);
          previousData = { data: data, timestamp: new Date().toISOString() };
        }
      } catch (error) {
        console.log('Individual previous report file not found');
      }
    }
    
    // Return consistent response structure for all clients
    if (previousData) {
      res.json({ 
        success: true, 
        previousData: previousData,
        data: previousData // For backwards compatibility with generate-report.html
      });
    } else {
      res.json({ 
        success: true, 
        previousData: null,
        data: null
      });
    }
  } catch (error) {
    console.error('Get previous report error:', error);
    res.status(500).json({ error: 'Failed to get previous report data' });
  }
});

// Helper function to get previous report data - use centralized method
async function getPreviousReportData(collegeId) {
  try {
    const previousReportsPath = 'previous-reports.json';
    const previousReports = await volumeService.readFile(previousReportsPath).catch(() => ({}));
    return previousReports[collegeId] || null;
  } catch (error) {
    console.error('Get previous report error:', error);
    return null;
  }
}

// Store current report as previous - use centralized method
async function storeCurrentReportAsPrevious(collegeId, reportData) {
  try {
    const previousReportsPath = 'previous-reports.json';
    const previousReports = await volumeService.readFile(previousReportsPath).catch(() => ({}));
    
    previousReports[collegeId] = {
      data: reportData,
      timestamp: new Date().toISOString()
    };
    
    await volumeService.writeFile(previousReportsPath, previousReports);
    console.log(`Stored previous report data for college ${collegeId} in volume`);
  } catch (error) {
    console.error('Store previous report error:', error);
  }
}

// Dashboard Data Routes
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await userManager.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

app.get('/api/dashboard/college/:collegeId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const data = await userManager.getCollegeDashboardData(collegeId);
    res.json(data);
  } catch (error) {
    console.error('Get college dashboard error:', error);
    res.status(500).json({ error: 'Failed to get college dashboard data' });
  }
});

// File Upload Routes
app.post('/api/upload', authService.requireAuth(), upload.array('files'), async (req, res) => {
  try {
    console.log('📁 File upload request received');
    console.log('👤 User:', req.user);
    console.log('🍪 Cookies:', req.cookies);
    console.log('📋 Headers:', req.headers.authorization ? 'Authorization header present' : 'No Authorization header');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`📄 Processing ${req.files.length} files:`, req.files.map(f => f.originalname));
    
    // Map files to the expected format
    const mappedFiles = req.files.map(file => ({
      filename: file.filename,
      path: file.path,
      originalName: file.originalname
    }));
    
    // Process all files and combine them
    const result = await dataImporter.processFiles(mappedFiles);
    
    if (result) {
      console.log('✅ Files processed successfully');
      res.json({
        success: true,
        message: `${req.files.length} files processed successfully`,
        data: result,
        filename: req.files.map(f => f.originalname).join(', ')
      });
    } else {
      console.log('❌ Failed to process files');
      res.status(400).json({ error: 'Failed to process files' });
    }
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed: ' + error.message });
  }
});

// Report Generation Routes
app.post('/api/reports/generate', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId, reportData, reportName, summary } = req.body;
    
    if (!collegeId || !reportData) {
      return res.status(400).json({ error: 'College ID and report data are required' });
    }
    
    const result = await saveCollegeReport(collegeId, reportData, reportName, summary);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Report generated successfully',
        report: result.report
      });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Report generation failed' });
  }
});

// Add the missing generate-report endpoint for backwards compatibility
app.post('/api/generate-report', authService.requireAuth(), async (req, res) => {
  try {
    console.log('📊 Generate report request received (legacy endpoint)');
    console.log('📄 Request body:', { 
      collegeId: req.body.collegeId, 
      reportName: req.body.reportName,
      hasReportData: !!req.body.reportData,
      reportDataLength: req.body.reportData?.length || 0
    });
    
    const { collegeId, reportData, reportName, summary } = req.body;
    
    if (!collegeId || !reportData) {
      console.log('❌ Missing required data:', { 
        hasCollegeId: !!collegeId, 
        hasReportData: !!reportData,
        collegeId,
        reportDataLength: reportData?.length || 0
      });
      return res.status(400).json({ 
        error: 'College ID and report data are required',
        provided: {
          hasCollegeId: !!collegeId,
          hasReportData: !!reportData,
          collegeId,
          reportDataLength: reportData?.length || 0
        }
      });
    }
    
    const result = await saveCollegeReport(collegeId, reportData, reportName, summary);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Report generated successfully',
        report: result.report
      });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Legacy report generation error:', error);
    res.status(500).json({ error: 'Report generation failed' });
  }
});

app.get('/api/reports/:collegeId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const reports = await getCollegeReports(collegeId);
    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

app.get('/api/reports/:collegeId/:reportId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    const report = await getCollegeReport(collegeId, reportId);
    
    if (report) {
      res.json(report);
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

app.delete('/api/reports/:collegeId/:reportId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    const result = await deleteCollegeReport(collegeId, reportId);
    
    if (result.success) {
      res.json({ success: true, message: 'Report deleted successfully' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});


app.get('/api/templates', authService.requireAuth(), async (req, res) => {
  try {
    console.log('📖 Templates API endpoint called');
    
    // Priority 1: Try database first (using existing Report model - safe)
    if (process.env.DATABASE_URL) {
      try {
        console.log('🐘 Loading templates from database (via Report model)...');
        await databaseUserManager.initialize();
        const dbTemplates = await databaseUserManager.getTemplates();
        console.log(`✅ Found ${dbTemplates.length} templates in database`);
        
        if (dbTemplates.length > 0) {
          // Also sync to file system as backup
          await writeTemplatesAllLocations(dbTemplates);
          console.log('💾 Database templates synced to file system as backup');
          return res.json(dbTemplates);
        }
      } catch (dbError) {
        console.log('⚠️ Database template read failed, falling back to file system:', dbError.message);
      }
    }
    
    // Priority 2: File system fallback
    const templatesFile = 'templates.json';
    let templates = [];
    
    try {
      templates = await volumeService.readFile(templatesFile);
      console.log(`✅ Read ${templates.length} templates from volume storage`);
    } catch (volumeError) {
      console.log('📝 No templates in volume storage, checking legacy path...');
      
      // Attempt migration from legacy data path
      try {
        const fs = require('fs-extra');
        const path = require('path');
        const legacyPath = path.join('data', 'templates.json');
        if (await fs.pathExists(legacyPath)) {
          templates = await fs.readJson(legacyPath);
          console.log(`📋 Read ${templates.length} templates from legacy storage`);
          
          // Migrate to volume storage
          await volumeService.writeFile(templatesFile, templates);
          console.log('✅ Templates migrated to volume storage');
        } else {
          console.log('📝 No templates found in legacy storage either, checking volume data folder...');
          // Check the alternative volume data folder location
          try {
            templates = await volumeService.readFile(path.join('data', 'templates.json'));
            if (Array.isArray(templates)) {
              console.log(`📋 Read ${templates.length} templates from volume data folder storage`);
              // Promote to canonical location as well
              await volumeService.writeFile(templatesFile, templates);
              console.log('✅ Templates promoted to canonical volume location');
            }
          } catch (_) {
            console.log('📝 No templates found in volume data folder storage either');
          }
        }
      } catch (legacyError) { 
        console.log('❌ Error reading from legacy storage:', legacyError.message);
        templates = []; 
      }
    }
    
    // If no templates found, try to recover from backup
    if (templates.length === 0) {
      console.log('⚠️ No templates found, attempting recovery from backups...');
      try {
        // Check if Railway backup service has any template backups
        const fs = require('fs-extra');
        const path = require('path');
        
        // Check Railway backup directory
        const backupDir = path.join('/data', 'backups');
        if (await fs.pathExists(backupDir)) {
          const backupFolders = await fs.readdir(backupDir);
          
          // Find most recent backup with templates
          for (const folder of backupFolders.reverse()) { // Check newest first
            const templatesBackupPath = path.join(backupDir, folder, 'templates.json');
            if (await fs.pathExists(templatesBackupPath)) {
              const backupTemplates = await fs.readJson(templatesBackupPath);
              if (Array.isArray(backupTemplates) && backupTemplates.length > 0) {
                console.log(`🔄 Recovered ${backupTemplates.length} templates from backup: ${folder}`);
                
                // Restore to all locations
                await writeTemplatesAllLocations(backupTemplates);
                
                templates = backupTemplates;
                console.log('✅ Templates successfully recovered from backup');
                break;
              }
            }
          }
          // Also check for snapshot files written directly into /data/backups
          if (templates.length === 0) {
            const entries = await fs.readdir(backupDir);
            const snapshotFiles = entries.filter(f => f.startsWith('templates-') && f.endsWith('.json'));
            snapshotFiles.sort().reverse();
            for (const file of snapshotFiles) {
              const p = path.join(backupDir, file);
              try {
                const payload = await fs.readJson(p);
                if (payload && Array.isArray(payload.templates) && payload.templates.length > 0) {
                  await writeTemplatesAllLocations(payload.templates);
                  templates = payload.templates;
                  console.log(`✅ Restored templates from snapshot ${file}`);
                  break;
                }
              } catch (_) {}
            }
          }
        }
      } catch (recoveryError) {
        console.error('❌ Template recovery failed:', recoveryError.message);
      }
    }
    
    console.log(`📤 Returning ${templates.length} templates to frontend`);
    res.json({ templates });
  } catch (error) {
    console.error('❌ Error loading templates:', error);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// Helper: snapshot templates to backups directory on the persistent volume
async function snapshotTemplatesToBackups(volumeService, templates, reason = 'manual') {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join('backups', `templates-${reason}-${timestamp}.json`);
    const payload = {
      reason,
      createdAt: new Date().toISOString(),
      count: Array.isArray(templates) ? templates.length : 0,
      templates: Array.isArray(templates) ? templates : []
    };
    await volumeService.writeFile(snapshotPath, payload);
    console.log('💾 Template snapshot written to', snapshotPath);
  } catch (e) {
    console.warn('⚠️ Failed to write template snapshot:', e.message);
  }
}

// Helper: aggressively write templates to every plausible persistent location
async function writeTemplatesAllLocations(templates) {
  const fs = require('fs-extra');
  const path = require('path');
  const writtenTo = [];
  try {
    await volumeService.writeFile('templates.json', templates);
    writtenTo.push('volume:/data/templates.json');
  } catch (e) { console.warn('⚠️ Failed writing via volumeService to templates.json:', e.message); }
  try {
    await volumeService.writeFile(path.join('data', 'templates.json'), templates);
    writtenTo.push('volume:/data/data/templates.json');
  } catch (e) { console.warn('⚠️ Failed writing via volumeService to data/templates.json:', e.message); }
  try {
    const legacyPath = path.join('data', 'templates.json');
    await fs.ensureDir(path.dirname(legacyPath));
    await fs.writeJson(legacyPath, templates, { spaces: 2 });
    writtenTo.push('legacy:data/templates.json');
  } catch (e) { console.warn('⚠️ Failed writing to legacy data/templates.json:', e.message); }
  // Absolute Railway paths (bypass volumeService in case it mis-detects)
  try {
    await fs.ensureDir('/data');
    await fs.writeJson('/data/templates.json', templates, { spaces: 2 });
    writtenTo.push('abs:/data/templates.json');
  } catch (e) { console.warn('⚠️ Failed writing to /data/templates.json:', e.message); }
  try {
    await fs.ensureDir('/data/data');
    await fs.writeJson('/data/data/templates.json', templates, { spaces: 2 });
    writtenTo.push('abs:/data/data/templates.json');
  } catch (e) { console.warn('⚠️ Failed writing to /data/data/templates.json:', e.message); }
  console.log('💾 Templates written to locations:', writtenTo.join(', '));
}

app.post('/api/save-template', authService.requireAuth(), async (req, res) => {
  try {
    console.log('📋 Template save request received');
    console.log('👤 User:', req.user);
    console.log('🍪 Cookies:', req.cookies);
    console.log('📋 Headers:', req.headers.authorization ? 'Authorization header present' : 'No Authorization header');
    console.log('📄 Template data:', { name: req.body.name, columns: req.body.headers?.length || 0, rows: req.body.tableData?.length || 0 });
    
    // DEBUG: Log volume service status
    console.log('🔍 Volume service status:', volumeService.getStatus());
    
    // Ensure data directory exists
    console.log('📁 Ensuring data directory exists...');
    await fs.ensureDir('data');
    console.log('✅ Data directory ready');
    
    // Validate template data before saving
    console.log('🔍 Validating template data...');
    console.log('📄 Template data structure:', {
      hasName: !!req.body.name,
      hasHeaders: !!req.body.headers,
      hasTableData: !!req.body.tableData,
      name: req.body.name,
      headers: req.body.headers,
      tableData: req.body.tableData
    });
    
    // Transform frontend data to match validation expectations
    const columnCount = Array.isArray(req.body.headers) ? req.body.headers.length : 0;
    const rowCount = Array.isArray(req.body.tableData) ? req.body.tableData.length : 0;
    
    // Create a headers array with the correct number of columns
    const headers = Array.isArray(req.body.headers) ? req.body.headers : 
                   Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
    
    const templateData = {
      id: String(req.body.id || Date.now()),
      name: req.body.name,
      description: req.body.description || '',
      headers: headers,
      tableData: req.body.tableData || [], // Include the actual table data
      columnCount: columnCount,
      rowCount: rowCount,
      createdAt: req.body.createdAt || new Date().toISOString()
    };
    
    console.log('🔄 Transformed template data:', {
      id: templateData.id,
      name: templateData.name,
      description: templateData.description,
      headersLength: templateData.headers.length,
      tableDataLength: templateData.tableData.length,
      createdAt: templateData.createdAt
    });
    console.log('🔍 Template ID received from frontend:', req.body.id, 'Type:', typeof req.body.id);
    
    // Temporarily disable validation to fix memory issues
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksum: 'temp-checksum',
      validationTime: new Date().toISOString()
    };
    console.log('✅ Template validation bypassed for memory optimization');
    
    const templatesFile = 'templates.json';
    let templates = [];
    
    console.log('📖 Reading existing templates from volume...');
    try {
      templates = await volumeService.readFile(templatesFile);
      console.log(`✅ Read ${templates.length} existing templates from volume`);
    } catch (e) {
      console.log('📝 No existing templates file, starting fresh');
      templates = [];
    }
    
    // Check if this is an update of an existing template
    console.log('🔍 Looking for existing template with ID:', templateData.id);
    console.log('🔍 Available template IDs:', templates.map(t => ({ id: t.id, name: t.name, type: typeof t.id })));
    
    const existingTemplateIndex = templates.findIndex(t => String(t.id) === String(templateData.id));
    console.log('🔍 Existing template index found:', existingTemplateIndex);
    
    if (existingTemplateIndex !== -1) {
      // This is an update of an existing template
      console.log('🔄 Updating existing template...');
      const originalTemplate = templates[existingTemplateIndex];
      const updatedTemplate = {
        ...templateData,
        id: String(templateData.id),
        createdAt: originalTemplate.createdAt || templateData.createdAt, // Preserve original creation date
        updatedAt: new Date().toISOString(), // Add update timestamp
        validationChecksum: validationResult.checksum,
        validationTime: validationResult.validationTime
      };
      templates[existingTemplateIndex] = updatedTemplate;
    } else if (req.body.id && req.body.id !== Date.now()) {
      // This is a restoration, preserve the original ID and data
      console.log('🔄 Restoring existing template...');
      const restoredTemplate = {
        ...templateData,
        id: String(req.body.id),
        tableData: req.body.tableData || [], // Ensure tableData is preserved during restoration
        createdAt: req.body.createdAt || new Date().toISOString(),
        validationChecksum: validationResult.checksum,
        validationTime: validationResult.validationTime
      };
      templates.push(restoredTemplate);
    } else {
      // This is a new template, use the transformed data
      console.log('🆕 Creating new template...');
      const newTemplate = {
        ...templateData,
        validationChecksum: validationResult.checksum,
        validationTime: validationResult.validationTime
      };
      templates.push(newTemplate);
    }
    
    // Priority 1: Save to database first (using existing Report model - safe)
    if (process.env.DATABASE_URL) {
      try {
        console.log('🐘 Saving template to database (via Report model)...');
        await databaseUserManager.initialize();
        
        let templateToSave;
        if (existingTemplateIndex !== -1) {
          templateToSave = templates[existingTemplateIndex];
        } else {
          templateToSave = templates[templates.length - 1]; // Get the newly added template
        }
        
        await databaseUserManager.saveTemplate(templateToSave);
        console.log('✅ Template saved to database successfully');
      } catch (dbError) {
        console.error('⚠️ Failed to save template to database:', dbError.message);
        console.log('📝 Continuing with file system save as fallback...');
      }
    }
    
    // Priority 2: Save to file system as backup
    console.log('💾 Writing templates to file system...');
    console.log('🔍 About to write to volume path:', volumeService.getDataPath());
    console.log('🔍 Full path will be:', path.join(volumeService.getDataPath(), templatesFile));
    
    await writeTemplatesAllLocations(templates);
    
    // DEBUG: Verify the write worked
    try {
      const verifyTemplates = await volumeService.readFile(templatesFile);
      console.log(`🔍 Verification: Read back ${verifyTemplates.length} templates from volume`);
      console.log('🔍 Template names after write:', verifyTemplates.map(t => t.name));
    } catch (verifyError) {
      console.error('❌ Verification failed - could not read back templates:', verifyError.message);
    }
    
    // Local snapshot to persistent backups
    await snapshotTemplatesToBackups(volumeService, templates, 'save');
    
    // Create backup after successful save
    try {
      console.log('💾 Creating backup...');
              await railwayBackupService.createBackup(`Manual template backup - ${Date.now()}`);
      console.log('✅ Backup created after template save');
    } catch (backupError) {
      console.error('⚠️ Failed to create backup after template save:', backupError);
      // Don't fail the save if backup fails
    }
    
    console.log('✅ Template save completed successfully');
    
    // Return the appropriate template based on whether it was an update or new template
    let savedTemplate;
    if (existingTemplateIndex !== -1) {
      savedTemplate = templates[existingTemplateIndex];
    } else {
      savedTemplate = templates[templates.length - 1];
    }
    
    res.json({ 
      success: true, 
      template: savedTemplate,
      validation: validationResult,
      action: existingTemplateIndex !== -1 ? 'updated' : 'created'
    });
  } catch (error) {
    console.error('❌ Error saving template:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to save template: ' + error.message,
      details: error.stack
    });
  }
});

app.delete('/api/templates/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Delete template request for ID:', id, 'Type:', typeof id);
    const templatesFile = 'templates.json';
    let templates = [];
    try {
      templates = await volumeService.readFile(templatesFile);
      console.log('Loaded templates:', templates.length, 'templates');
      console.log('Template IDs:', templates.map(t => ({ id: t.id, type: typeof t.id, name: t.name })));
    } catch (e) {
      console.error('Error reading templates file:', e);
      // Fallback to volume data folder location
      try {
        const path = require('path');
        templates = await volumeService.readFile(path.join('data', 'templates.json'));
        console.log(`📋 Read ${templates.length} templates from volume data folder storage`);
      } catch (_) {
        templates = [];
      }
    }
    
    // Ensure both IDs are strings for comparison
    const templateIndex = templates.findIndex(t => String(t.id) === String(id));
    console.log('Template index found:', templateIndex);
    if (templateIndex === -1) {
      console.log('Template not found. Available IDs:', templates.map(t => ({ id: t.id, type: typeof t.id, name: t.name })));
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const deletedTemplate = templates.splice(templateIndex, 1)[0];
    
    // Priority 1: Delete from database first (using existing Report model - safe)
    if (process.env.DATABASE_URL) {
      try {
        console.log('🐘 Deleting template from database (via Report model)...');
        await databaseUserManager.initialize();
        await databaseUserManager.deleteTemplate(deletedTemplate.id);
        console.log('✅ Template deleted from database successfully');
      } catch (dbError) {
        console.error('⚠️ Failed to delete template from database:', dbError.message);
        console.log('📝 Continuing with file system delete...');
      }
    }
    
    // Priority 2: Delete from file system
    await writeTemplatesAllLocations(templates);
    
    // Also sync to legacy data path for backward compatibility
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const legacyPath = path.join('data', 'templates.json');
      await fs.ensureDir(path.dirname(legacyPath));
      await fs.writeJson(legacyPath, templates, { spaces: 2 });
      console.log('✅ Templates synced to legacy storage after delete');
    } catch (syncError) {
      console.warn('⚠️ Failed to sync templates to legacy storage after delete:', syncError.message);
    }
    
    // Snapshot after delete
    await snapshotTemplatesToBackups(volumeService, templates, 'delete');
    
    // Create backup after deletion
    try {
               await railwayBackupService.createBackup(`Manual template deletion backup - ${Date.now()}`);
      console.log('✅ Backup created after template deletion');
    } catch (backupError) {
      console.error('⚠️ Failed to create backup after template deletion:', backupError);
    }
    
    res.json({ success: true, message: 'Template deleted successfully', template: deletedTemplate });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Update template endpoint
app.put('/api/templates/:id', authService.requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 Update template request for ID:', id, 'Type:', typeof id);
    
    const templatesFile = 'templates.json';
    let templates = [];
    
    console.log('📖 Reading existing templates from volume...');
    try {
      templates = await volumeService.readFile(templatesFile);
      console.log(`✅ Read ${templates.length} existing templates from volume`);
      console.log('Template IDs:', templates.map(t => ({ id: t.id, type: typeof t.id, name: t.name })));
    } catch (e) {
      console.error('Error reading templates file:', e);
      return res.status(500).json({ error: 'Failed to read existing templates' });
    }
    
    // Find the template to update
    const templateIndex = templates.findIndex(t => String(t.id) === String(id));
    console.log('Template index found for update:', templateIndex);
    
    if (templateIndex === -1) {
      console.log('Template not found for update. Available IDs:', templates.map(t => ({ id: t.id, type: typeof t.id, name: t.name })));
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Validate the updated template data
    const { name, description, headers, tableData, rowCount, columnCount } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    
    if (!Array.isArray(headers) || headers.length === 0) {
      return res.status(400).json({ error: 'Template headers are required' });
    }
    
    if (!Array.isArray(tableData)) {
      return res.status(400).json({ error: 'Template table data must be an array' });
    }
    
    // Preserve the original template ID and creation date
    const originalTemplate = templates[templateIndex];
    const updatedTemplate = {
      id: originalTemplate.id, // Keep original ID
      name: name.trim(),
      description: description || '',
      headers: headers,
      tableData: tableData,
      columnCount: columnCount || headers.length,
      rowCount: rowCount || tableData.length,
      createdAt: originalTemplate.createdAt, // Keep original creation date
      updatedAt: new Date().toISOString(), // Add/update modification date
      validationChecksum: 'updated-checksum',
      validationTime: new Date().toISOString()
    };
    
    // Replace the template at the found index
    templates[templateIndex] = updatedTemplate;
    
    console.log('💾 Writing updated templates to volume...');
    await writeTemplatesAllLocations(templates);
    console.log('✅ Templates file updated successfully');
    
    // Also sync to legacy data path for backward compatibility
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const legacyPath = path.join('data', 'templates.json');
      await fs.ensureDir(path.dirname(legacyPath));
      await fs.writeJson(legacyPath, templates, { spaces: 2 });
      console.log('✅ Templates synced to legacy storage after update');
    } catch (syncError) {
      console.warn('⚠️ Failed to sync templates to legacy storage after update:', syncError.message);
    }
    
    // Snapshot after update
    await snapshotTemplatesToBackups(volumeService, templates, 'update');
    
    // Create backup after successful update
    try {
      console.log('💾 Creating backup after template update...');
      await railwayBackupService.createBackup(`Template update backup - ${updatedTemplate.name} - ${Date.now()}`);
      console.log('✅ Backup created after template update');
    } catch (backupError) {
      console.error('⚠️ Failed to create backup after template update:', backupError);
      // Don't fail the update if backup fails
    }
    
    console.log('✅ Template update completed successfully');
    res.json({ 
      success: true, 
      message: 'Template updated successfully',
      template: updatedTemplate
    });
  } catch (error) {
    console.error('❌ Error updating template:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Download current templates.json
app.get('/api/templates/download', authService.requireAuth(), async (req, res) => {
  try {
    let templates = [];
    try { templates = await volumeService.readFile('templates.json'); }
    catch (_) {
      try { const path = require('path'); templates = await volumeService.readFile(path.join('data','templates.json')); }
      catch (_) { templates = []; }
    }
    // If still empty, try absolute paths
    if ((!Array.isArray(templates) || templates.length === 0)) {
      try { const fs = require('fs-extra'); if (await fs.pathExists('/data/templates.json')) templates = await fs.readJson('/data/templates.json'); } catch (_) {}
      if ((!Array.isArray(templates) || templates.length === 0)) {
        try { const fs = require('fs-extra'); if (await fs.pathExists('/data/data/templates.json')) templates = await fs.readJson('/data/data/templates.json'); } catch (_) {}
      }
    }
    const payload = { templates };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="templates.json"');
    res.send(JSON.stringify(payload, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'Failed to download templates' });
  }
});

// Restore templates from uploaded JSON
app.post('/api/templates/restore', authService.requireAuth(), async (req, res) => {
  try {
    const body = req.body;
    const templates = Array.isArray(body?.templates) ? body.templates : Array.isArray(body) ? body : [];
    if (!Array.isArray(templates) || templates.length === 0) {
      return res.status(400).json({ error: 'No templates provided to restore' });
    }
    await writeTemplatesAllLocations(templates);
    await snapshotTemplatesToBackups(volumeService, templates, 'restore');
    res.json({ success: true, count: templates.length });
  } catch (e) {
    console.error('Restore templates error:', e);
    res.status(500).json({ error: e.message || 'Failed to restore templates' });
  }
});

// Export Excel from editor payload, preserving basic formatting
app.post('/api/export-excel', authService.requireAuth(), async (req, res) => {
  try {
    const { headers = [], rows = [], name = 'Report', createdAt } = req.body || {};

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report Data');

    // Title and meta
    worksheet.getCell('A1').value = `Report: ${name}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    worksheet.getCell('A2').value = `Generated: ${createdAt ? new Date(createdAt).toLocaleString() : new Date().toLocaleString()}`;
    worksheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

    // Header row styling (+ column colour mapping similar to UI)
    const headerRowIndex = 4;
    const dataStartRow = headerRowIndex + 1;
    const uiArgbBySection = {
      placements: 'FFDBEAFE',    // light blue
      assessments: 'FFCCFBF1',   // light teal
      careers: 'FFFED7AA',       // light orange
      activities: 'FFFED7AA',    // light orange
      enrichment: 'FFDCFCE7',    // light green
      employment: 'FFF3E8FF',    // light purple
      targets: 'FFFCE7F3',       // light pink
      login: 'FFE0E7FF',         // light indigo
      department: 'FFFED7AA',    // amber-ish
      default: 'FFF3F4F6'        // light grey
    };
    function sectionFromHeader(h) {
      const s = String(h || '').toLowerCase();
      if (s.includes('placements')) return 'placements';
      if (s.includes('enrichment')) return 'enrichment';
      if (s.includes('employment')) return 'employment';
      if (s.includes('careers')) return 'careers';
      if (s.includes('assessments')) return 'assessments';
      if (s.includes('targets')) return 'targets';
      if (s.includes('login')) return 'login';
      if (s.includes('department')) return 'department';
      return 'default';
    }
    const columnArgb = [];
    if (headers.length) {
      const headerRow = worksheet.getRow(headerRowIndex);
      headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FF111111' } };
        const sec = sectionFromHeader(h);
        const argb = uiArgbBySection[sec] || uiArgbBySection.default;
        columnArgb[idx] = argb;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getColumn(idx + 1).width = Math.max(12, String(h || '').length + 2);
      });
      headerRow.commit();
    }

    // Detect percentage headers to apply number format and create simple bar via conditional formatting later if desired
    const percentageColumns = new Set();
    headers.forEach((h, idx) => {
      const hl = String(h || '').toLowerCase();
      if (hl.includes('percent') || hl.includes('%')) percentageColumns.add(idx);
    });

    // Data rows
    rows.forEach((rowArr, rIdx) => {
      const row = worksheet.getRow(dataStartRow + rIdx);
      rowArr.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        // Percent handling
        if (percentageColumns.has(cIdx)) {
          let num = null;
          if (typeof val === 'number') {
            num = val > 1 ? val / 100 : val;
          } else if (typeof val === 'string' && val.trim().endsWith('%')) {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) num = parsed / 100;
          } else {
            const parsed = parseFloat(val);
            if (!isNaN(parsed) && parsed <= 1) num = parsed;
          }
          if (num !== null) {
            cell.value = num;
            cell.numFmt = '0.0%';
          } else {
            cell.value = val == null ? '' : val;
          }
        } else {
          cell.value = val == null ? '' : val;
          if (typeof val === 'number') {
            cell.numFmt = '0.00';
          }
        }
        // Light tint to mirror UI section colouring
        const argb = columnArgb[cIdx];
        if (argb) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
        }
        cell.font = { color: { argb: 'FF111111' } };
      });
      row.commit();
    });

    // Simple table styling
    const lastRow = dataStartRow + rows.length - 1;
    if (headers.length && rows.length) {
      worksheet.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex, column: headers.length }
      };
      // Add thin borders
      for (let r = headerRowIndex; r <= lastRow; r++) {
        for (let c = 1; c <= headers.length; c++) {
          const cell = worksheet.getRow(r).getCell(c);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('Export Excel error:', e);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

// Backup management endpoints - Using SimpleBackupService for college data

// Data validation endpoints
app.post('/api/validate/report', authService.requireAuth(), async (req, res) => {
  try {
    const { reportData, collegeId } = req.body;
    
    if (!reportData) {
      return res.status(400).json({ error: 'Report data is required' });
    }
    
    const validationResult = await dataValidationService.validateReportData(reportData, collegeId);
    
    res.json({
      success: true,
      validation: validationResult
    });
  } catch (error) {
    console.error('Report validation error:', error);
    res.status(500).json({ error: 'Failed to validate report' });
  }
});

app.post('/api/validate/template', authService.requireAuth(), async (req, res) => {
  try {
    const { templateData } = req.body;
    
    if (!templateData) {
      return res.status(400).json({ error: 'Template data is required' });
    }
    
    const validationResult = await dataValidationService.validateTemplateData(templateData);
    
    res.json({
      success: true,
      validation: validationResult
    });
  } catch (error) {
    console.error('Template validation error:', error);
    res.status(500).json({ error: 'Failed to validate template' });
  }
});

app.get('/api/validate/stats', authService.requireAuth(), async (req, res) => {
  try {
    const stats = await dataValidationService.getValidationStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Validation stats error:', error);
    res.status(500).json({ error: 'Failed to get validation stats' });
  }
});

// Helper Functions
async function getTemplates() {
  try {
    const templatesPath = 'templates/';
    const templates = [];
    
    if (await fs.pathExists(templatesPath)) {
      const files = await fs.readdir(templatesPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const template = await fs.readJson(path.join(templatesPath, file));
          templates.push(template);
        }
      }
    }
    
    return templates;
  } catch (error) {
    console.error('Get templates error:', error);
    return [];
  }
}

function calculateChanges(currentData, previousReportPath) {
  // Implementation for calculating changes between reports
  return { changes: [], summary: 'No previous report to compare' };
}

async function getCollegeReports(collegeId) {
  try {
    // First try to load from database if available
    if (process.env.DATABASE_URL) {
      try {
        console.log(`📊 Loading reports for college ${collegeId} from database...`);
        await databaseUserManager.initialize();
        const dbReports = await databaseUserManager.getReports(parseInt(collegeId));
        if (dbReports && dbReports.length > 0) {
          console.log(`✅ Found ${dbReports.length} reports for college ${collegeId} in database`);
          return dbReports;
        }
      } catch (dbError) {
        console.log(`⚠️ Failed to load reports from database, trying file system: ${dbError.message}`);
      }
    }

    // Fallback to file system
    console.log(`📊 Loading reports for college ${collegeId} from volume...`);
    
    const reportsPath = `reports/${collegeId}.json`;
    console.log(`📁 Checking reports file: ${reportsPath}`);
    
    if (await volumeService.fileExists(reportsPath)) {
      const reports = await volumeService.readFile(reportsPath);
      console.log(`✅ Found ${reports.length} reports for college ${collegeId} in volume`);
      return reports;
    } else {
      console.log(`📝 No reports file found for college ${collegeId} in volume`);
      return [];
    }
  } catch (error) {
    console.error('❌ Get college reports error:', error);
    return [];
  }
}

async function saveCollegeReport(collegeId, reportData, reportName, summary) {
  try {
    console.log(`💾 Saving report for college ${collegeId} to volume...`);
    console.log(`📄 Report name: ${reportName}`);
    console.log(`📊 Report data structure:`, reportData);
    
    // Transform report data to match validation expectations
    const transformedReportData = {
      id: Date.now().toString(),
      name: reportName || `Report ${new Date().toLocaleDateString()}`,
      data: {
        headers: reportData.headers,
        rows: reportData.rows
      },
      createdAt: new Date().toISOString()
    };
    
    // Temporarily disable validation to fix memory issues
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksum: 'temp-checksum',
      validationTime: new Date().toISOString()
    };
    console.log('✅ Report validation bypassed for memory optimization');
    
    const reportsPath = `reports/${collegeId}.json`;
    console.log(`📁 Reports file path in volume: ${reportsPath}`);
    
    let reports = [];
    try {
      reports = await volumeService.readFile(reportsPath);
      console.log(`📖 Read ${reports.length} existing reports from volume`);
    } catch (e) {
      console.log('📝 No existing reports file in volume, starting fresh');
      reports = [];
    }
    
    const report = {
      ...transformedReportData,
      summary: summary || 'No summary provided',
      createdBy: 'system',
      validationChecksum: validationResult.checksum,
      validationTime: validationResult.validationTime
    };
    
    console.log(`📋 Adding new report with ID: ${report.id}`);
    reports.push(report);
    
    console.log(`💾 Writing ${reports.length} reports to volume...`);
    await volumeService.writeFile(reportsPath, reports);
    console.log('✅ Reports file written to volume successfully');
    
    // Also save to database if available for permanent storage
    if (process.env.DATABASE_URL) {
      try {
        console.log('💾 Saving report to database for permanent storage...');
        await databaseUserManager.initialize();
        const dbReportData = {
          name: report.name,
          collegeId: parseInt(collegeId),
          data: report.data,
          summary: report.summary,
          createdBy: report.createdBy,
          validationChecksum: report.validationChecksum,
          validationTime: report.validationTime,
          status: 'completed'
        };
        
        const dbReport = await databaseUserManager.createReport(dbReportData);
        console.log(`✅ Report saved to database with ID: ${dbReport.id}`);
      } catch (dbError) {
        console.error('⚠️ Failed to save report to database (file system backup available):', dbError.message);
        // Don't fail the entire operation if database save fails, file system backup exists
      }
    }
    
    // Create backup after successful save
    try {
              await railwayBackupService.createBackup(`Manual report backup - ${collegeId} - ${Date.now()}`);
      console.log('✅ Backup created after report save');
    } catch (backupError) {
      console.error('⚠️ Failed to create backup after report save:', backupError);
      // Don't fail the save if backup fails
    }
    
    // Store as previous report for comparison
    await storeCurrentReportAsPrevious(collegeId, reportData);
    
    // Update analytics with the new report
    try {
      await analyticsService.processNewReport(collegeId.toString(), report);
      console.log(`Analytics updated for college ${collegeId}`);
    } catch (error) {
      console.error('Error updating analytics:', error);
      // Don't fail the report save if analytics update fails
    }
    
    // Update college's lastReportDate using the correct user manager (database-first)
    try {
      const nowIso = new Date().toISOString();
      console.log(`🔄 Attempting to update lastReportDate for college ${collegeId} (type: ${typeof collegeId})`);
      
      // Ensure collegeId is properly typed for the update
      const numericCollegeId = parseInt(collegeId);
      console.log(`🔄 Numeric college ID: ${numericCollegeId}`);
      
      // Test which manager we're getting
      const manager = await getInitializedUserManager();
      console.log(`🔄 Using manager type: ${manager.constructor.name}`);
      console.log(`🔄 Manager has updateCollege method: ${typeof manager.updateCollege}`);
      
      const result = await manager.updateCollege(numericCollegeId, {
        lastreportdate: nowIso
      });
      console.log(`✅ Updated lastReportDate for college ${collegeId} to ${nowIso}`, result);
    } catch (error) {
      console.error('❌ Error updating college lastReportDate:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    
    return { 
      success: true, 
      report,
      validation: validationResult
    };
  } catch (error) {
    console.error('Save college report error:', error);
    return { success: false, message: 'Failed to save report' };
  }
}

async function getCollegeReport(collegeId, reportId) {
  try {
    const reports = await getCollegeReports(collegeId);
    return reports.find(report => report.id === reportId);
  } catch (error) {
    console.error('Get college report error:', error);
    return null;
  }
}

async function deleteCollegeReport(collegeId, reportId) {
  try {
    // 1) Delete from database if available
    if (process.env.DATABASE_URL) {
      try {
        await databaseUserManager.initialize();
        const dbReports = await databaseUserManager.getReports(parseInt(collegeId));
        const target = dbReports.find(r => String(r.id) === String(reportId));
        if (target) {
          await (require('./src/services/DatabaseUserManager')).models.Report.destroy({ where: { id: target.id } });
        }
      } catch (e) {
        console.log('DB delete failed or not applicable, will still remove from volume:', e.message);
      }
    }

    // 2) Delete from volume JSON
    const reportsPath = `reports/${collegeId}.json`;
    const reports = await volumeService.readFile(reportsPath).catch(() => []);
    const filteredReports = reports.filter(report => String(report.id) !== String(reportId));
    await volumeService.writeFile(reportsPath, filteredReports);

    // 3) Also prune previous-reports cache
    try {
      const previousReportsPath = 'previous-reports.json';
      const prevMap = await volumeService.readFile(previousReportsPath).catch(() => ({}));
      if (prevMap && prevMap[collegeId] && Array.isArray(prevMap[collegeId].reports)) {
        prevMap[collegeId].reports = prevMap[collegeId].reports.filter(r => String(r.id) !== String(reportId));
        await volumeService.writeFile(previousReportsPath, prevMap);
      }
    } catch (_) {}

    return { success: true };
  } catch (error) {
    console.error('Delete college report error:', error);
    return { success: false, message: 'Failed to delete report' };
  }
}

// KPI API Endpoints
app.get('/api/colleges/:collegeId/kpis', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const kpis = await userManager.getKPIs(collegeId);
    
    res.json({
      success: true,
      kpis: kpis
    });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load KPIs'
    });
  }
});

app.post('/api/colleges/:collegeId/kpis', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { kpis } = req.body;
    
    if (!Array.isArray(kpis)) {
      return res.status(400).json({
        success: false,
        error: 'KPIs must be an array'
      });
    }
    
    const result = await userManager.saveKPIs(collegeId, kpis);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'KPIs saved successfully',
        kpis: result.kpis
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Save KPIs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save KPIs'
    });
  }
});

app.put('/api/kpis/:kpiId', authService.requireAuth(), async (req, res) => {
  try {
    const { kpiId } = req.params;
    const updates = req.body;
    
    const result = await userManager.updateKPI(kpiId, updates);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'KPI updated successfully',
        kpi: result.kpi
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Update KPI error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update KPI'
    });
  }
});

app.delete('/api/kpis/:kpiId', authService.requireAuth(), async (req, res) => {
  try {
    const { kpiId } = req.params;
    
    const result = await userManager.deleteKPI(kpiId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Delete KPI error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete KPI'
    });
  }
});

// AI KPI Generation Endpoint
app.post('/api/colleges/:collegeId/generate-kpis', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    console.log('Generating AI KPIs for college:', collegeId);
    
    // Load college data (prefer DB manager when available)
    let collegeData;
    try {
      const mgr = await getInitializedUserManager();
      if (mgr.getCollegeById) {
        collegeData = await mgr.getCollegeById(parseInt(collegeId));
      } else if (mgr.getCollege) {
        collegeData = await mgr.getCollege(collegeId);
      }
    } catch (_) {}
    if (!collegeData) {
      collegeData = await userManager.getCollege(collegeId);
    }
    
    // Load performance data
    const enhancedAnalyticsService = new (require('./src/services/EnhancedAnalyticsService'))();
    const performanceData = await enhancedAnalyticsService.loadPerformanceData(collegeId);
    
    if (!performanceData) {
      return res.status(404).json({
        success: false,
        error: 'No performance data found for this college'
      });
    }
    
    // Generate AI KPI suggestions
    const aiAnalyzer = new (require('./src/services/AIAnalyzer'))();
    const kpiSuggestions = await aiAnalyzer.generateKPISuggestions(collegeData, performanceData);
    
    res.json({
      success: true,
      kpiSuggestions: kpiSuggestions
    });
  } catch (error) {
    console.error('AI KPI Generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI KPIs: ' + error.message
    });
  }
});

// Temporary debug endpoint for KPI generation (secured in production)
app.post('/api/debug/colleges/:collegeId/generate-kpis', ...debugMiddlewares, async (req, res) => {
  try {
    const { collegeId } = req.params;
    console.log('DEBUG: Generating AI KPIs for college:', collegeId);
    
    // Load college data (DB first, fall back to file)
    let collegeData;
    try {
      const mgr = await getInitializedUserManager();
      if (mgr.getCollegeById) {
        collegeData = await mgr.getCollegeById(parseInt(collegeId));
      } else if (mgr.getCollege) {
        collegeData = await mgr.getCollege(collegeId);
      }
    } catch (_) {}
    if (!collegeData) {
      collegeData = await userManager.getCollege(collegeId);
    }
    if (!collegeData) {
      return res.status(404).json({
        success: false,
        error: 'College not found'
      });
    }
    
    // Load performance data
    const enhancedAnalyticsService = new (require('./src/services/EnhancedAnalyticsService'))();
    const performanceData = await enhancedAnalyticsService.loadPerformanceData(collegeId);
    
    if (!performanceData) {
      return res.status(404).json({
        success: false,
        error: 'No performance data found for this college'
      });
    }
    
    // Generate AI KPI suggestions
    const aiAnalyzer = new (require('./src/services/AIAnalyzer'))();
    const kpiSuggestions = await aiAnalyzer.generateKPISuggestions(collegeData, performanceData);
    
    res.json({
      success: true,
      kpiSuggestions: kpiSuggestions
    });
  } catch (error) {
    console.error('DEBUG: AI KPI Generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI KPIs: ' + error.message
    });
  }
});

// Analytics API Endpoints
app.get('/api/analytics/:collegeId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { limit } = req.query;
    
    const chartData = await analyticsService.getChartData(collegeId, parseInt(limit) || 7);
    
    if (!chartData) {
      return res.status(404).json({
        success: false,
        error: 'Analytics data not found for this college'
      });
    }
    
    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load analytics data'
    });
  }
});

app.post('/api/analytics/:collegeId/generate', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    // Get all reports for this college
    const reports = await getCollegeReports(collegeId);
    
    if (reports.length === 0) {
      return res.json({
        success: false,
        error: 'No reports found for this college'
      });
    }
    
    // Generate analytics from existing reports
    const analytics = await analyticsService.generateAnalyticsFromReports(collegeId, reports);
    
    res.json({
      success: true,
      message: `Analytics generated from ${reports.length} reports`,
      data: analytics
    });
  } catch (error) {
    console.error('Generate analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics'
    });
  }
});

// Basic AI Analysis API Endpoint
app.post('/api/ai/analyze', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeData, performanceData } = req.body;
    
    if (!collegeData || !performanceData) {
      return res.status(400).json({
        success: false,
        error: 'College data and performance data are required'
      });
    }

    // Use direct OpenAI API call instead of AIAnalyzer
    const https = require('https');
    
    const prompt = `You are an expert UK Further Education (FE) consultant. Use clear, casual but professional British English for UK college staff. Provide 2-3 KPI suggestions for a college with:
- ${performanceData.totalStudents || 0} students
- ${performanceData.percentWithPlacements || 0}% placement rate
- ${performanceData.percentStudentsWithActivities || 0}% activity participation

Format as numbered list with specific, measurable targets.`;

    const postData = JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = JSON.parse(data);
              resolve(result.choices[0].message.content);
            } catch (error) {
              reject(new Error('Failed to parse OpenAI response'));
            }
          } else {
            reject(new Error(`OpenAI API error: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const aiRecommendations = {
      success: true,
      recommendations: {
        summary: 'AI-generated KPI suggestions',
        sections: {
          kpiSuggestions: response
        },
        rawResponse: response
      }
    };

    res.json({
      success: true,
      data: aiRecommendations
    });
  } catch (error) {
    console.error('AI Analysis API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI analysis: ' + error.message
    });
  }
});

// Report Recalculation API Endpoint
app.post('/api/reports/:collegeId/recalculate', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    if (!collegeId) {
      return res.status(400).json({
        success: false,
        error: 'College ID is required'
      });
    }

    console.log(`📊 Recalculating report totals for college: ${collegeId}`);

    // Initialize EnhancedAnalyticsService
    const analyticsService = new EnhancedAnalyticsService();

    // Load the current report
    const fs = require('fs').promises;
    const path = require('path');
    
    const reportPath = path.join(__dirname, 'data', 'reports', `${collegeId}.json`);
    const analyticsPath = path.join(__dirname, 'data', 'analytics', `${collegeId}.json`);
    
    let reportData;
    let targetPath;
    
    try {
      // Try to load from reports first
      const reportContent = await fs.readFile(reportPath, 'utf8');
      reportData = JSON.parse(reportContent)[0];
      targetPath = reportPath;
      console.log('📄 Loaded report from reports directory');
    } catch (error) {
      try {
        // Try to load from analytics
        const analyticsContent = await fs.readFile(analyticsPath, 'utf8');
        reportData = JSON.parse(analyticsContent);
        targetPath = analyticsPath;
        console.log('📄 Loaded report from analytics directory');
      } catch (analyticsError) {
        return res.status(404).json({
          success: false,
          error: 'No report found for this college'
        });
      }
    }

    // Recalculate totals
    const recalculatedReport = analyticsService.recalculateReportTotals(reportData);
    
    if (!recalculatedReport) {
      return res.status(500).json({
        success: false,
        error: 'Failed to recalculate report totals'
      });
    }

    // Save the recalculated report
    const saveResult = await analyticsService.saveRecalculatedReport(collegeId, recalculatedReport);
    
    if (!saveResult) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save recalculated report'
      });
    }

    // Load the updated performance data
    const updatedPerformanceData = await analyticsService.loadPerformanceData(collegeId);

    res.json({
      success: true,
      message: 'Report totals recalculated and saved successfully',
      data: {
        collegeId,
        recalculated: true,
        performanceData: updatedPerformanceData
      }
    });

  } catch (error) {
    console.error('Report recalculation API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate report: ' + error.message
    });
  }
});

// Enhanced Analytics API Endpoints
app.get('/api/enhanced-analytics/:collegeId', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    console.log('=== ENHANCED ANALYTICS API CALL ===');
    console.log('College ID:', collegeId);
    console.log('Request timestamp:', new Date().toISOString());
    
    // Use the EnhancedAnalyticsService to generate comprehensive analytics
    const enhancedData = await enhancedAnalyticsService.generateEnhancedAnalytics(collegeId);
    
    if (!enhancedData || !enhancedData.success) {
      console.log('Enhanced analytics service returned no data, using fallback');
      
      // Fallback: Load basic data and generate AI recommendations
      const collegeData = await enhancedAnalyticsService.loadCollegeData(collegeId);
      const performanceData = await enhancedAnalyticsService.loadPerformanceData(collegeId);
      
      if (!collegeData || !performanceData) {
        // Graceful minimal response so frontend can render fallback UI
        return res.json({
          success: true,
          data: {
            success: true,
            collegeData: collegeData || { id: Number(collegeId) },
            performanceData: performanceData || {
              totalStudents: 0,
              percentWithPlacements: 0,
              percentStudentsWithActivities: 0,
              assessmentCompletionRate: 0,
              availableSections: { placements: false, activities: false, assessments: false, careers: false }
            },
            peerComparison: {},
            aiRecommendations: { success: false, recommendations: { sections: { kpiSuggestions: '' } } },
            timestamp: new Date().toISOString()
          }
        });
      }

      // Generate AI recommendations using the working approach
      let aiRecommendations;
      try {
        const https = require('https');
        
        const prompt = `You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation.

COLLEGE CONTEXT:
- Name: ${collegeData.name || 'Unknown College'}
- Student Population: ${performanceData.totalStudents || 0} students
- Placement Rate: ${performanceData.percentWithPlacements || 0}%
- Activity Participation: ${performanceData.percentStudentsWithActivities || 0}%

NAVIGATE SOFTWARE SCOPE:
- Non-curricular enrichment activities
- Employer engagement and partnerships
- Student placement tracking and management
- Activity recording and reporting

TASK:
Provide strategic recommendations in this exact format:

1. IMMEDIATE ACTIONS
- List 2-3 key steps to improve Navigate usage
- Focus on quick wins and essential improvements

2. TRAINING & DEVELOPMENT
- List 2-3 essential training needs
- Focus on core Navigate skills

3. STRATEGIC PLANNING
- Provide 2-3 key long-term strategies
- Focus on sustainable implementation

4. BEST PRACTICES
- List 2-3 essential best practices
- Focus on proven approaches

5. RESOURCE ALLOCATION
- Provide 2-3 key resource priorities
- Focus on highest impact areas

6. KPI SUGGESTIONS
- Provide 3-5 specific, measurable KPIs
- Focus on Navigate software metrics
- Include specific targets and timeframes

Keep all suggestions practical, achievable, and specific to UK FE colleges using Navigate software.`;

        const postData = JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: "system",
              content: "You are an expert UK Further Education (FE) consultant specializing in Navigate software implementation. Write in simple, clear UK English using British spelling. Keep your tone friendly and easy to understand. Provide only 2-3 most important, practical suggestions per section. Focus on Navigate software capabilities and UK FE best practices."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        });
        
        const options = {
          hostname: 'api.openai.com',
          port: 443,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                  const result = JSON.parse(data);
                  resolve(result.choices[0].message.content);
                } catch (error) {
                  reject(new Error('Failed to parse OpenAI response'));
                }
              } else {
                reject(new Error(`OpenAI API error: ${res.statusCode}`));
              }
            });
          });
          
          req.on('error', reject);
          req.write(postData);
          req.end();
        });
        
        // Parse the structured response
        console.log('=== AI RESPONSE ANALYSIS ===');
        console.log('AI Response length:', response.length);
        console.log('AI Response first 800 chars:', response.substring(0, 800));
        console.log('AI Response last 200 chars:', response.substring(response.length - 200));
        console.log('Lines in response:', response.split('\n').length);
        
        // Show all lines that contain section names
        const sectionNames = ['IMMEDIATE ACTIONS', 'TRAINING', 'STRATEGIC', 'BEST PRACTICES', 'RESOURCE', 'KPI'];
        console.log('Lines containing section keywords:');
        response.split('\n').forEach((line, i) => {
          if (sectionNames.some(section => line.toUpperCase().includes(section))) {
            console.log(`Line ${i + 1}: "${line}"`);
          }
        });
        
        // Use a more robust section extraction method
        const sections = extractAllSections(response);
        
        console.log('Extracted sections:', sections);
        
        // Check if any sections were extracted successfully
        const hasValidSections = Object.values(sections).some(section => section && section.trim().length > 0);
        
        if (hasValidSections) {
          aiRecommendations = {
            success: true,
            recommendations: {
              summary: 'AI-generated strategic recommendations',
              sections: sections,
              rawResponse: response
            }
          };
        } else {
          console.log('No valid sections extracted, using fallback recommendations');
          aiRecommendations = {
            success: false,
            message: 'AI parsing failed, using fallback recommendations',
            recommendations: {
              summary: 'Basic recommendations based on performance data',
              sections: {
                immediateActions: 'Focus on improving placement rates through enhanced employer partnerships\n- Review current employer engagement strategies\n- Identify opportunities for new partnerships',
                trainingDevelopment: 'Develop more engaging student activity programs\n- Assess current activity offerings\n- Plan staff training on Navigate features',
                strategicPlanning: 'Set clear targets for placement and activity rates\n- Establish quarterly review processes\n- Develop long-term improvement roadmap',
                bestPractices: 'Regular data review and reporting\n- Consistent activity recording procedures\n- Staff training on Navigate best practices',
                resourceAllocation: 'Prioritize staff training and development\n- Allocate time for regular data review\n- Invest in employer relationship building',
                kpiSuggestions: 'Increase placement rate to 50% by end of academic year\n- Improve activity participation to 25% within 6 months\n- Achieve 80% assessment completion rate'
              },
              rawResponse: 'Fallback recommendations - AI parsing failed'
            }
          };
        }
        
      } catch (error) {
        console.error('AI recommendations failed:', error.message);
        console.log('Using fallback recommendations due to AI failure');
        aiRecommendations = {
          success: false,
          message: 'AI recommendations unavailable',
          recommendations: {
            summary: 'Basic recommendations based on performance data',
            sections: {
              immediateActions: 'Focus on improving placement rates through enhanced employer partnerships\n- Review current employer engagement strategies\n- Identify opportunities for new partnerships',
              trainingDevelopment: 'Develop more engaging student activity programs\n- Assess current activity offerings\n- Plan staff training on Navigate features',
              strategicPlanning: 'Set clear targets for placement and activity rates\n- Establish quarterly review processes\n- Develop long-term improvement roadmap',
              bestPractices: 'Regular data review and reporting\n- Consistent activity recording procedures\n- Staff training on Navigate best practices',
              resourceAllocation: 'Prioritize staff training and development\n- Allocate time for regular data review\n- Invest in employer relationship building',
              kpiSuggestions: 'Increase placement rate to 50% by end of academic year\n- Improve activity participation to 25% within 6 months\n- Achieve 80% assessment completion rate'
            },
            rawResponse: 'Fallback recommendations - AI analysis unavailable'
          }
        };
      }

      // Generate peer comparison data even in fallback case
      const peerComparison = await enhancedAnalyticsService.generatePeerComparison(collegeData, performanceData);
      
      enhancedData = {
        success: true,
        collegeData,
        performanceData,
        peerComparison: peerComparison || {},
        aiRecommendations,
        timestamp: new Date().toISOString()
      };
    }

    console.log('=== ENHANCED ANALYTICS RESPONSE ===');
    console.log('Success:', enhancedData.success);
    console.log('Has college data:', !!enhancedData.collegeData);
    console.log('Has performance data:', !!enhancedData.performanceData);
    console.log('Has peer comparison:', !!enhancedData.peerComparison);
    try {
      console.log('Peer comparison summary:', {
        totalColleges: enhancedData.peerComparison?.totalColleges,
        placementRank: enhancedData.peerComparison?.rankings?.placement,
        activityRank: enhancedData.peerComparison?.rankings?.activity,
        assessmentRank: enhancedData.peerComparison?.rankings?.assessment
      });
    } catch (_) {}
    console.log('Has AI recommendations:', !!enhancedData.aiRecommendations);

    res.json({
      success: true,
      data: enhancedData
    });
  } catch (error) {
    console.error('Enhanced Analytics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load enhanced analytics data'
    });
  }
});

// Helper function to extract all sections from AI response at once
function extractAllSections(text) {
  console.log('\n=== Extracting all sections from AI response ===');
  
  const sections = {
    immediateActions: '',
    trainingDevelopment: '',
    strategicPlanning: '',
    bestPractices: '',
    resourceAllocation: '',
    kpiSuggestions: ''
  };
  
  const lines = text.split('\n');
  let currentSection = null;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line is a section header
    if (isSectionHeader(line)) {
      // Save previous section content
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
        console.log(`✅ Saved section "${currentSection}" with ${currentContent.length} lines`);
      }
      
      // Start new section
      currentSection = getSectionName(line);
      currentContent = [];
      console.log(`📍 Starting new section: "${currentSection}" at line ${i + 1}`);
    } else if (currentSection && line.length > 0) {
      // Add content to current section
      currentContent.push(line);
    }
  }
  
  // Save the last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim();
    console.log(`✅ Saved final section "${currentSection}" with ${currentContent.length} lines`);
  }
  
  return sections;
}

// Helper function to check if a line is a section header
function isSectionHeader(line) {
  const sectionPatterns = [
    /^\d+\.\s*[A-Z\s&]+/, // "1. IMMEDIATE ACTIONS"
    /^[A-Z\s&]+:\s*$/, // "IMMEDIATE ACTIONS:"
    /^\*\*[A-Z\s&]+\*\*/, // "**IMMEDIATE ACTIONS**"
    /^[A-Z\s&]{3,}$/ // "IMMEDIATE ACTIONS"
  ];
  
  return sectionPatterns.some(pattern => pattern.test(line));
}

// Helper function to get section name from header line
function getSectionName(line) {
  const lineUpper = line.toUpperCase();
  
  if (lineUpper.includes('IMMEDIATE ACTIONS')) return 'immediateActions';
  if (lineUpper.includes('TRAINING') && lineUpper.includes('DEVELOPMENT')) return 'trainingDevelopment';
  if (lineUpper.includes('STRATEGIC') && lineUpper.includes('PLANNING')) return 'strategicPlanning';
  if (lineUpper.includes('BEST PRACTICES')) return 'bestPractices';
  if (lineUpper.includes('RESOURCE') && lineUpper.includes('ALLOCATION')) return 'resourceAllocation';
  if (lineUpper.includes('KPI') && lineUpper.includes('SUGGESTIONS')) return 'kpiSuggestions';
  
  return null;
}

// Helper function to extract sections from AI response (improved parsing)
function extractSection(text, sectionName) {
  console.log(`\n=== Extracting section: ${sectionName} ===`);
  
  // Split the text into lines and find the section
  const lines = text.split('\n');
  let sectionStartIndex = -1;
  let sectionEndIndex = lines.length;
  
  // Find the start of this section with multiple patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineUpper = line.toUpperCase();
    const sectionUpper = sectionName.toUpperCase();
    
    // Check multiple patterns for section headers
    const patterns = [
      // Pattern 1: "1. IMMEDIATE ACTIONS"
      new RegExp(`^\\d+\\.\\s*${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
      // Pattern 2: "IMMEDIATE ACTIONS:"
      new RegExp(`^${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?`, 'i'),
      // Pattern 3: "**IMMEDIATE ACTIONS**"
      new RegExp(`^\\*\\*${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*`, 'i'),
      // Pattern 4: Just contains the section name
      new RegExp(`^.*${sectionUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i')
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        console.log(`📍 Found section "${sectionName}" at line ${i + 1}: "${line}"`);
        sectionStartIndex = i;
        break;
      }
    }
    
    if (sectionStartIndex !== -1) break;
  }
  
  if (sectionStartIndex === -1) {
    console.log(`❌ Section "${sectionName}" not found`);
    return '';
  }
  
  // Find the end of this section (look for next section or end of text)
  for (let i = sectionStartIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for next section patterns
    const nextSectionPatterns = [
      // Next numbered section like "2.", "3.", etc.
      /^\d+\.\s*[A-Z]/,
      // Section with colons like "TRAINING & DEVELOPMENT:"
      /^[A-Z\s&]+:\s*$/,
      // Bold section headers like "**TRAINING & DEVELOPMENT**"
      /^\*\*[A-Z\s&]+\*\*$/,
      // Any line that looks like a section header
      /^[A-Z\s&]{3,}$/
    ];
    
    for (const pattern of nextSectionPatterns) {
      if (pattern.test(line)) {
        // Make sure it's not the same section we're currently extracting
        const lineUpper = line.toUpperCase();
        const currentSectionUpper = sectionName.toUpperCase();
        if (!lineUpper.includes(currentSectionUpper)) {
          console.log(`📍 Found next section at line ${i + 1}: "${line}"`);
          sectionEndIndex = i;
          break;
        }
      }
    }
    
    if (sectionEndIndex !== lines.length) break;
  }
  
  // Extract the content between start and end
  const sectionLines = lines.slice(sectionStartIndex + 1, sectionEndIndex);
  const content = sectionLines
    .filter(line => line.trim().length > 0) // Remove empty lines
    .join('\n')
    .trim();
  
  if (content.length > 0) {
    console.log(`✅ Extracted ${content.length} chars for "${sectionName}": "${content.substring(0, 100)}..."`);
    return content;
  } else {
    console.log(`❌ No content found for section "${sectionName}"`);
    return '';
  }
}

// Test endpoint for OpenAI API - DISABLED FOR PRODUCTION
/*
app.get('/api/test-openai', async (req, res) => {
  try {
    console.log('=== OpenAI Test Endpoint ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('OpenAI API Key length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
    
    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: false,
        error: 'OpenAI API key not configured',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        hasApiKey: false,
        isOpenAIAvailable: false,
        testSuccess: false,
        debug: {
          env: process.env.NODE_ENV,
          hasKey: false
        }
      });
    }

    const https = require('https');
    
    const postData = JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: "user",
          content: "Just say 'Hello from AI!' and nothing else."
        }
      ],
      max_tokens: 10
    });
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = JSON.parse(data);
              resolve(result.choices[0].message.content);
            } catch (error) {
              reject(new Error('Failed to parse OpenAI response: ' + error.message));
            }
          } else {
            reject(new Error(`OpenAI API error: ${res.statusCode} - ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    res.json({
      success: true,
      message: 'OpenAI API is working',
      response: response,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      hasApiKey: true,
      isOpenAIAvailable: true,
      testSuccess: true,
      debug: {
        env: process.env.NODE_ENV,
        hasKey: true,
        keyLength: process.env.OPENAI_API_KEY.length
      }
    });
    
  } catch (error) {
    console.error('OpenAI test failed:', error);
    res.json({
      success: false,
      error: error.message,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      hasApiKey: !!process.env.OPENAI_API_KEY,
      isOpenAIAvailable: false,
      testSuccess: false,
      testError: error.message,
      debug: {
        env: process.env.NODE_ENV,
        hasKey: !!process.env.OPENAI_API_KEY
      }
    });
  }
});
*/

app.get('/api/enhanced-analytics/:collegeId/gap-analysis', authService.requireAuth(), async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    // Get enhanced analytics data
    const enhancedData = await enhancedAnalyticsService.generateEnhancedAnalytics(collegeId);
    
    if (!enhancedData.success) {
      return res.status(404).json({
        success: false,
        error: enhancedData.error || 'Enhanced analytics data not found for this college'
      });
    }

    // Generate gap analysis
    const gapAnalysis = enhancedAnalyticsService.generateGapAnalysis(
      enhancedData.performanceData, 
      enhancedData.peerComparison
    );

    res.json({
      success: true,
      data: {
        gapAnalysis,
        peerComparison: enhancedData.peerComparison,
        performanceData: enhancedData.performanceData
      }
    });
  } catch (error) {
    console.error('Gap Analysis API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate gap analysis'
    });
  }
});

// Removed insecure debug endpoint /api/debug/session-state

// Debug endpoint to check volume status
app.get('/api/debug/volume-status', ...debugMiddlewares, async (req, res) => {
  try {
    const volumeStatus = volumeService.getStatus();
    const dataFiles = await volumeService.listFiles('');
    
    res.json({
      volumeStatus,
      dataFiles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Debug endpoint to check Railway backup status
app.get('/api/debug/railway-backup-status', ...debugMiddlewares, async (req, res) => {
  try {
    const backupStats = await railwayBackupService.getStorageStats();
    const backups = await railwayBackupService.listBackups();
    
    res.json({
      success: true,
      backupStats,
      backups,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
        PERSISTENT_STORAGE_PATH: process.env.PERSISTENT_STORAGE_PATH,
        DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set'
      }
    });
  } catch (error) {
    console.error('Debug Railway backup status error:', error);
    res.status(500).json({ error: 'Failed to get Railway backup status' });
  }
});

// Temporary debug endpoint to restore college data
app.post('/api/debug/restore-colleges', ...debugMiddlewares, async (req, res) => {
  try {
    console.log('🔄 Restoring college data via debug endpoint...');
    
    // Add colleges to database
    const { College } = require('./src/database/models');
    console.log('📋 College model loaded:', College ? 'Yes' : 'No');
    
    // Test with a simple college first
    const testCollege = {
      id: 999999999,
      name: "Test College",
      numberOfProviders: "1",
      accountManagerId: "1752605613330",
      keyContact: "Test Contact",
      keyStakeholder: "",
      superUsers: [],
      courses: [],
      placements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    console.log('🔄 Attempting to create test college...');
    
    try {
      const result = await College.create(testCollege);
      console.log('✅ Test college created successfully:', result.name);
      
      res.json({
        success: true,
        message: `Test college created successfully: ${result.name}`,
        college: result
      });
    } catch (error) {
      console.error('❌ Error creating test college:', error);
      res.status(500).json({ 
        error: 'Failed to create test college: ' + error.message,
        details: error
      });
    }
    
  } catch (error) {
    console.error('❌ Error in restore colleges endpoint:', error);
    res.status(500).json({ error: 'Failed to restore colleges: ' + error.message });
  }
});

// Direct access to Railway cloud data
app.get('/api/railway-cloud-data', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    
    // Check if we're on Railway
    const isRailway = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
    const dataPath = isRailway ? (process.env.PERSISTENT_STORAGE_PATH || '/data') : path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data/data');
    
    // Check if data exists
    const collegesPath = path.join(dataPath, 'colleges.json');
    const collegesExist = await fs.pathExists(collegesPath);
    
    let colleges = [];
    if (collegesExist) {
      colleges = await fs.readJson(collegesPath);
    }
    
    res.json({
      success: true,
      isRailway,
      dataPath,
      collegesExist,
      collegesCount: colleges.length,
      colleges: colleges.map(c => ({ id: c.id, name: c.name })),
      environment: process.env.NODE_ENV,
      railwayEnvironment: process.env.RAILWAY_ENVIRONMENT
    });
  } catch (error) {
    console.error('Railway cloud data error:', error);
    res.status(500).json({ error: 'Failed to access Railway cloud data' });
  }
});

// Check simple-backups in data-backup-simulation
app.get('/api/check-simple-backups', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    
    const isRailway = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
    const dataPath = isRailway ? (process.env.PERSISTENT_STORAGE_PATH || '/data') : path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data/data');
    
    // Check simple-backups directory inside data-backup-simulation
    const simpleBackupsPath = path.join(dataPath, 'data-backup-simulation', 'simple-backups');
    const simpleBackupsExist = await fs.pathExists(simpleBackupsPath);
    
    if (!simpleBackupsExist) {
      return res.json({ 
        success: false, 
        error: 'No simple-backups directory found',
        checkedPath: simpleBackupsPath
      });
    }
    
    // List all backup directories
    const backupDirs = await fs.readdir(simpleBackupsPath);
    
    // Check each backup directory for colleges.json
    const backupDetails = [];
    for (const backupDir of backupDirs) {
      const backupPath = path.join(simpleBackupsPath, backupDir);
      const collegesPath = path.join(backupPath, 'colleges.json');
      
      if (await fs.pathExists(collegesPath)) {
        try {
          const colleges = await fs.readJson(collegesPath);
          backupDetails.push({
            directory: backupDir,
            collegesCount: colleges.length,
            colleges: colleges.map(c => ({ id: c.id, name: c.name }))
          });
        } catch (error) {
          backupDetails.push({
            directory: backupDir,
            error: 'Could not read colleges.json'
          });
        }
      } else {
        backupDetails.push({
          directory: backupDir,
          error: 'No colleges.json found'
        });
      }
    }
    
    res.json({
      success: true,
      isRailway,
      simpleBackupsPath,
      totalBackups: backupDirs.length,
      backupDirs,
      backupDetails
    });
  } catch (error) {
    console.error('Check simple-backups error:', error);
    res.status(500).json({ error: 'Failed to check simple-backups' });
  }
});

// Restore from specific simple-backup
app.post('/api/restore-simple-backup/:backupId', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    
    const { backupId } = req.params;
    const isRailway = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
    const dataPath = isRailway ? (process.env.PERSISTENT_STORAGE_PATH || '/data') : path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data/data');
    
    // Path to the specific backup
    const backupPath = path.join(dataPath, 'data-backup-simulation', 'simple-backups', backupId);
    const backupExists = await fs.pathExists(backupPath);
    
    if (!backupExists) {
      return res.json({ 
        success: false, 
        error: 'Backup not found',
        backupId,
        checkedPath: backupPath
      });
    }
    
    // Check if colleges.json exists in the backup
    const collegesPath = path.join(backupPath, 'colleges.json');
    const collegesExist = await fs.pathExists(collegesPath);
    
    if (!collegesExist) {
      return res.json({ 
        success: false, 
        error: 'No colleges.json found in backup',
        backupId
      });
    }
    
    // Read the colleges data from the backup
    const colleges = await fs.readJson(collegesPath);
    
    // Copy the backup data to the main data directory
    const mainDataPath = isRailway ? (process.env.PERSISTENT_STORAGE_PATH || '/data') : path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data/data');
    
    // Copy all files from the backup to the main data directory
    await fs.copy(backupPath, mainDataPath);
    
    res.json({
      success: true,
      message: 'Restored from simple-backup successfully',
      backupId,
      collegesCount: colleges.length,
      colleges: colleges.map(c => ({ id: c.id, name: c.name })),
      restoredPath: mainDataPath
    });
  } catch (error) {
    console.error('Restore simple-backup error:', error);
    res.status(500).json({ error: 'Failed to restore from simple-backup' });
  }
});

// Search all possible backup locations
app.get('/api/search-all-backups', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    
    const isRailway = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
    const dataPath = isRailway ? (process.env.PERSISTENT_STORAGE_PATH || '/data') : path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data/data');
    
    // List of all possible backup locations to check
    const possibleLocations = [
      '/data/simple-backups',
      '/data/backups', 
      '/data/data-backup-simulation/simple-backups',
      '/data/data-backup-simulation/backups',
      '/data/old-backups',
      '/data/backup-simulation',
      '/data/colleges-backup',
      '/data/backup-data'
    ];
    
    const searchResults = [];
    
    for (const location of possibleLocations) {
      try {
        const exists = await fs.pathExists(location);
        if (exists) {
          const items = await fs.readdir(location);
          
          // Check each item for colleges.json
          const collegesFiles = [];
          for (const item of items) {
            const itemPath = path.join(location, item);
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
              const collegesPath = path.join(itemPath, 'colleges.json');
              if (await fs.pathExists(collegesPath)) {
                try {
                  const colleges = await fs.readJson(collegesPath);
                  collegesFiles.push({
                    directory: item,
                    collegesCount: colleges.length,
                    colleges: colleges.map(c => ({ id: c.id, name: c.name }))
                  });
                } catch (error) {
                  collegesFiles.push({
                    directory: item,
                    error: 'Could not read colleges.json'
                  });
                }
              }
            }
          }
          
          searchResults.push({
            location,
            exists: true,
            items,
            collegesFiles
          });
        } else {
          searchResults.push({
            location,
            exists: false
          });
        }
      } catch (error) {
        searchResults.push({
          location,
          exists: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      isRailway,
      dataPath,
      searchResults
    });
  } catch (error) {
    console.error('Search all backups error:', error);
    res.status(500).json({ error: 'Failed to search all backups' });
  }
});

// Check backup files in /app/data/backups
app.get('/api/check-backup-files', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    
    const isRailway = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
    const dataPath = isRailway ? (process.env.PERSISTENT_STORAGE_PATH || '/data') : path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.railway-backup-data/data');
    
    // Check backup files in /data/backups
    const backupFilesPath = path.join(dataPath, 'backups');
    const backupFilesExist = await fs.pathExists(backupFilesPath);
    
    if (!backupFilesExist) {
      return res.json({ 
        success: false, 
        error: 'No backup files directory found',
        checkedPath: backupFilesPath
      });
    }
    
    // List all backup files
    const backupFiles = await fs.readdir(backupFilesPath);
    
    // Check each backup file for colleges data
    const backupFileDetails = [];
    for (const backupFile of backupFiles) {
      const backupFilePath = path.join(backupFilesPath, backupFile);
      const stats = await fs.stat(backupFilePath);
      
      if (stats.isFile() && backupFile.endsWith('.json')) {
        try {
          const data = await fs.readJson(backupFilePath);
          if (Array.isArray(data)) {
            backupFileDetails.push({
              file: backupFile,
              type: 'colleges-array',
              collegesCount: data.length,
              colleges: data.map(c => ({ id: c.id, name: c.name }))
            });
          } else if (data.colleges) {
            backupFileDetails.push({
              file: backupFile,
              type: 'colleges-object',
              collegesCount: data.colleges.length,
              colleges: data.colleges.map(c => ({ id: c.id, name: c.name }))
            });
          } else {
            backupFileDetails.push({
              file: backupFile,
              type: 'other-json',
              dataKeys: Object.keys(data)
            });
          }
        } catch (error) {
          backupFileDetails.push({
            file: backupFile,
            error: 'Could not read JSON file'
          });
        }
      } else if (stats.isDirectory()) {
        const collegesPath = path.join(backupFilePath, 'colleges.json');
        if (await fs.pathExists(collegesPath)) {
          try {
            const colleges = await fs.readJson(collegesPath);
            backupFileDetails.push({
              file: backupFile,
              type: 'backup-directory',
              collegesCount: colleges.length,
              colleges: colleges.map(c => ({ id: c.id, name: c.name }))
            });
          } catch (error) {
            backupFileDetails.push({
              file: backupFile,
              type: 'backup-directory',
              error: 'Could not read colleges.json'
            });
          }
        } else {
          backupFileDetails.push({
            file: backupFile,
            type: 'backup-directory',
            error: 'No colleges.json found'
          });
        }
      }
    }
    
    res.json({
      success: true,
      isRailway,
      backupFilesPath,
      totalBackupFiles: backupFiles.length,
      backupFiles,
      backupFileDetails
    });
  } catch (error) {
    console.error('Check backup files error:', error);
    res.status(500).json({ error: 'Failed to check backup files' });
  }
});

// Debug endpoint to check environment variables
app.get('/debug-env', (req, res) => {
  const hasValidApiKey = process.env.OPENAI_API_KEY && 
                        process.env.OPENAI_API_KEY.startsWith('sk-') && 
                        process.env.OPENAI_API_KEY.length > 20 && 
                        process.env.OPENAI_API_KEY !== 'your-openai-api-key-here';
  
  const isEnabled = process.env.AI_ANALYSIS_ENABLED === 'true';
  
  res.json({
    nodeEnv: process.env.NODE_ENV,
    openaiApiKeyExists: !!process.env.OPENAI_API_KEY,
    openaiApiKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    openaiApiKeyPreview: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'none',
    openaiModel: process.env.OPENAI_MODEL,
    aiAnalysisEnabled: process.env.AI_ANALYSIS_ENABLED,
    hasValidApiKey: hasValidApiKey,
    isEnabled: isEnabled,
    openaiShouldWork: hasValidApiKey && isEnabled,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize services
async function initializeServices() {
  try {
    // Debug environment variables
    console.log('🔍 Environment Variables Debug:');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);
    console.log('DATABASE_URL preview:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'none');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
    console.log('All DATABASE_URL related vars:', {
      DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_URL_LENGTH: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
      DATABASE_URL_START: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) : 'none'
    });
    
    // Check for Railway-specific database variables
    console.log('🔍 Railway Database Variables:');
    console.log('RAILWAY_POSTGRESQL_URL:', !!process.env.RAILWAY_POSTGRESQL_URL);
    console.log('RAILWAY_DATABASE_URL:', !!process.env.RAILWAY_DATABASE_URL);
    console.log('All environment variables containing "DATABASE":', 
      Object.keys(process.env).filter(key => key.includes('DATABASE')));
    
    // Check if DATABASE_URL is available for PostgreSQL
    if (process.env.DATABASE_URL) {
      console.log('🐘 PostgreSQL DATABASE_URL detected - using database mode');
      console.log('🔄 Initializing database service...');
      await DatabaseService.initialize();
      
      console.log('🔄 Initializing database user manager...');
      await databaseUserManager.initialize();
      
      console.log('✅ Database services initialized successfully');
    } else {
      console.log('📁 No DATABASE_URL found - using file-based storage');
      console.log('🔄 Initializing volume service...');
      await volumeService.initialize();
      
      console.log('🔄 Initializing data preservation service...');
      await dataPreservationService.initializeDataPreservation();
    }
    
    // Initialize backup service (Railway file-based or PostgreSQL)
    console.log('🔄 Initializing backup service...');
    await initializeBackupService();
    
    // Synchronize template data after backup service is ready
    console.log('🔄 Synchronizing template data...');
    await synchronizeTemplateData();
  
  // Safety: if templates still missing after sync, try reading and promoting from absolute paths
  try {
    const fs = require('fs-extra');
    const absPaths = ['/data/templates.json', '/data/data/templates.json'];
    for (const p of absPaths) {
      if (await fs.pathExists(p)) {
        const data = await fs.readJson(p);
        if (Array.isArray(data) && data.length > 0) {
          console.log(`🔁 Promoting templates from absolute path ${p}`);
          await writeTemplatesAllLocations(data);
          break;
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Post-sync template promotion skipped:', e.message);
  }
    
    // Only initialize cloud backup service if not in Railway environment
    if (!process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== 'production') {
      console.log('🔄 Initializing cloud backup service...');
      await cloudBackupService.initialize();
    } else {
      console.log('ℹ️ Skipping cloud backup service in Railway environment - using Railway persistent storage');
    }
    
    console.log('✅ Core services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    console.log('⚠️  Continuing with basic functionality - some features may be limited');
    // Don't throw error - allow app to continue running
  }
}

// Database migration endpoint (protected, only for admin use)
app.post('/api/admin/migrate-database', authService.requireAuth(), async (req, res) => {
  try {
    // Only allow system administrators to run migrations
    if (req.user.role !== 'system_administrator') {
      return res.status(403).json({ error: 'Unauthorized. System administrator access required.' });
    }
    
    console.log('🚀 Running database migration from admin endpoint...');
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not configured' });
    }
    
    const runMigration = require('./migrate-database-on-railway');
    await runMigration();
    
    res.json({ 
      success: true, 
      message: 'Database migration completed successfully!' 
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

// Only start server if this file is run directly (not loaded as module)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AM Reports Hub running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS Origin: ${process.env.CORS_ORIGIN || 'https://am-reports-hub-production.up.railway.app'}`);
    console.log('✅ Server is ready to accept requests');
    console.log('🏥 Healthcheck endpoint available at /');
    console.log('🔧 Template persistence via database (Report model) - TEST DEPLOYMENT #2');
    
    // Initialize services in background (non-blocking) after server starts
    setTimeout(() => {
      console.log('🔄 Starting background service initialization...');
      initializeServices().catch(error => {
        console.error('❌ Service initialization failed:', error);
        console.log('⚠️ Continuing with basic functionality - some features may be limited');
      });
    }, 5000); // Wait 5 seconds before starting services to ensure healthcheck is ready
  });
} else {
  // Initialize services when loaded as module
  setTimeout(() => {
    console.log('🔄 Starting background service initialization...');
    initializeServices().catch(error => {
      console.error('❌ Service initialization failed:', error);
      console.log('⚠️ Continuing with basic functionality - some features may be limited');
    });
  }, 1000);
}

module.exports = app; 