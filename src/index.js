const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import services
const UserManager = require('./services/UserManager');
const AIAnalyzer = require('./services/AIAnalyzer');
const ReportScheduler = require('./services/ReportScheduler');
const DataImporter = require('./services/DataImporter');
const AuthService = require('./services/AuthService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const userManager = new UserManager();
const aiAnalyzer = new AIAnalyzer();
const reportScheduler = new ReportScheduler();
const dataImporter = new DataImporter();
const authService = new AuthService();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

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
app.get('/', authService.requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Lightweight auth status check for login page
app.get('/api/auth/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.cookies?.token ||
                  req.query.token;

    if (!token) {
      return res.json({ authenticated: false });
    }

    const validation = await authService.validateSession(token);
    if (!validation.success) {
      return res.json({ authenticated: false });
    }

    // Sanitize user payload
    const user = await authService.getUserById(validation.user.userId);
    if (!user) return res.json({ authenticated: false });
    const sanitized = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      accountManagerId: user.accountManagerId
    };
    return res.json({ authenticated: true, user: sanitized });
  } catch (err) {
    // Never error for status check; just report unauthenticated
    return res.json({ authenticated: false });
  }
});

app.get('/college-dashboard', authService.requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, '../public/college-dashboard.html'));
});

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await authService.authenticateUser(username, password);
    
    if (result.success) {
      // Set HTTP-only cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
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

app.get('/api/auth/me', authService.requireAuth(), async (req, res) => {
  try {
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
    res.json({ users: sanitizedUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authService.requireAuth(), authService.requireRole('admin'), async (req, res) => {
  try {
    const result = await authService.createUser(req.body);
    if (result.success) {
      res.json({ success: true, user: result.user });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', authService.requireAuth(), authService.requireRole('admin'), async (req, res) => {
  try {
    const result = await authService.updateUser(parseInt(req.params.id), req.body);
    if (result.success) {
      res.json({ success: true, user: result.user });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authService.requireAuth(), authService.requireRole('admin'), async (req, res) => {
  try {
    const result = await authService.deleteUser(parseInt(req.params.id));
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Account Manager Management
app.get('/api/account-managers', authService.requireAuth(), async (req, res) => {
  try {
    const accountManagers = await userManager.getAccountManagers();
    res.json({ accountManagers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/account-managers', authService.requireAuth(), authService.requireRole(['admin', 'account_manager']), async (req, res) => {
  try {
    const result = await userManager.addAccountManager(req.body);
    
    if (result.success) {
      res.status(201).json({ success: true, manager: result.manager });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Add account manager error:', error);
    res.status(500).json({ error: 'Failed to add account manager' });
  }
});

app.put('/api/account-managers/:id', async (req, res) => {
  try {
    const accountManager = await userManager.updateAccountManager(parseInt(req.params.id), req.body);
    res.json({ success: true, accountManager });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/account-managers/:id', async (req, res) => {
  try {
    await userManager.deleteAccountManager(parseInt(req.params.id));
    res.json({ success: true, message: 'Account manager deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/account-managers/:id/stats', async (req, res) => {
  try {
    const stats = await userManager.getAccountManagerStats(parseInt(req.params.id));
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// College Management
app.get('/api/colleges', authService.requireAuth(), async (req, res) => {
  try {
    const { accountManagerId } = req.query;
    let colleges;
    
    // If user is account manager, only show their colleges
    if (req.user.role === 'account_manager' && req.user.accountManagerId) {
      colleges = await userManager.getCollegesByAccountManager(req.user.accountManagerId);
    } else if (accountManagerId) {
      colleges = await userManager.getCollegesByAccountManager(parseInt(accountManagerId));
    } else {
      colleges = await userManager.getColleges();
    }
    
    res.json({ colleges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/colleges', async (req, res) => {
  try {
    const college = await userManager.addCollege(req.body);
    res.json({ success: true, college });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/colleges/:id', async (req, res) => {
  try {
    const college = await userManager.updateCollege(parseInt(req.params.id), req.body);
    res.json({ success: true, college });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/colleges/:id', async (req, res) => {
  try {
    await userManager.deleteCollege(parseInt(req.params.id));
    res.json({ success: true, message: 'College deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/colleges/:id/assign-account-manager', async (req, res) => {
  try {
    const { accountManagerId } = req.body;
    const college = await userManager.assignCollegeToAccountManager(parseInt(req.params.id), accountManagerId);
    res.json({ success: true, college });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// College Overview
app.get('/api/colleges/:id/overview', async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id);
    const college = await userManager.getCollege(collegeId);
    
    if (!college) {
      return res.status(404).json({ error: 'College not found' });
    }
    
    // Get college overview data (this would come from CollegeOverviewService)
    const overview = {
      ...college,
      metrics: {
        totalStudents: college.totalStudents || 0,
        placements: college.placements || 0,
        activities: college.activities || 0,
        engagementHours: college.engagementHours || 0
      },
      swot: {
        strengths: college.strengths || ['Strong student engagement with the platform', 'Effective integration with existing systems'],
        weaknesses: college.weaknesses || ['Limited adoption by some departments', 'Need for additional training resources'],
        opportunities: college.opportunities || ['Expand to additional departments', 'Implement advanced analytics features'],
        threats: college.threats || ['Competition from other platforms', 'Budget constraints affecting expansion']
      },
      insights: college.insights || [],
      notes: college.notes || []
    };
    
    res.json({ success: true, overview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/colleges/:id/overview', async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id);
    const updates = req.body;
    
    const updatedCollege = await userManager.updateCollege(collegeId, updates);
    res.json({ success: true, college: updatedCollege });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const { currentData, previousData, changes, timeFrame } = req.body;
    const analysis = await aiAnalyzer.generateAnalysis(currentData, previousData, changes, timeFrame);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload and processing
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Parse optional manual assignment payloads from FormData
    const useManual = String(req.body.useManualAssignment || '').toLowerCase() === 'true';
    let headerAssignments = {};
    let fileSelections = {};
    try {
      if (req.body.headerAssignments) headerAssignments = JSON.parse(req.body.headerAssignments);
    } catch (e) { console.warn('Failed to parse headerAssignments JSON:', e?.message || e); }
    try {
      if (req.body.fileTypes) fileSelections = JSON.parse(req.body.fileTypes);
    } catch (e) { console.warn('Failed to parse fileTypes JSON:', e?.message || e); }

    const uploadedFiles = req.files.map((file, idx) => {
      const sel = (fileSelections && typeof fileSelections === 'object') ? fileSelections[idx] : null;
      return {
        filename: file.filename,
        path: file.path,
        originalName: file.originalname,
        userSelectedType: sel && sel.type ? String(sel.type).toLowerCase() : undefined,
        userSelectedColor: sel && sel.color ? sel.color : undefined
      };
    });

    // Process files using DataImporter
    const processedData = useManual
      ? await dataImporter.processFilesWithManualAssignment(uploadedFiles, headerAssignments)
      : await dataImporter.processFiles(uploadedFiles);
    
    // Add debug info for the first file
    if (uploadedFiles.length > 0) {
      console.log('Processing file:', uploadedFiles[0].originalName);
      console.log('Processed data structure:', {
        departments: processedData.departments,
        sampleMetrics: processedData.metrics[processedData.departments[0]] || {}
      });
    }
    
    res.json({
      success: true,
      message: 'Files processed successfully',
      data: processedData,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Report generation
app.post('/api/generate-report', async (req, res) => {
  try {
    const { reportName, data, previousReportPath, collegeId } = req.body;
    
    // Generate analysis if we have previous data
    let analysis = null;
    if (previousReportPath) {
      const changes = calculateChanges(data, previousReportPath);
      analysis = await aiAnalyzer.generateAnalysis(data, null, changes, 'weekly');
    }
    
    // Update college's last report date and store current report as previous
    if (collegeId) {
      await userManager.updateCollege(collegeId, {
        lastReportDate: new Date().toISOString()
      });
      
      // Store current report data for future comparison
      await storeCurrentReportAsPrevious(parseInt(collegeId), data);
    }
    
    res.json({
      success: true,
      message: 'Report generated successfully',
      analysis
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Template management
app.post('/api/save-template', async (req, res) => {
  try {
    const { name, description, headers, tableData, columnCount, rowCount } = req.body;
    const templates = await getTemplates();
    
    // Check for duplicate template names
    const existingTemplate = templates.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existingTemplate) {
      return res.status(400).json({ 
        error: `Template with name "${name}" already exists. Please choose a different name.` 
      });
    }
    
    const template = {
      id: Date.now().toString(), // Simple ID generation
      name,
      description,
      headers,
      tableData, // Save the actual table data
      columnCount,
      rowCount,
      createdAt: new Date().toISOString()
    };
    
    templates.push(template);
    await fs.writeJson('data/templates.json', templates, { spaces: 2 });
    
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/templates', async (req, res) => {
  try {
    const templates = await getTemplates();
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const templateId = req.params.id;
    const templates = await getTemplates();
    const filteredTemplates = templates.filter(t => t.id !== templateId);
    
    if (filteredTemplates.length === templates.length) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await fs.writeJson('data/templates.json', filteredTemplates, { spaces: 2 });
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function getTemplates() {
  try {
    return await fs.readJson('data/templates.json');
  } catch (error) {
    return [];
  }
}

function calculateChanges(currentData, previousReportPath) {
  // Placeholder for change calculation
  // This would compare current data with previous report
  return {};
}

async function getPreviousReportData(collegeId, templateKey) {
  try {
    // Try root-level cache first (newer)
    let entry = null;
    try {
      const map = await fs.readJson('previous-reports.json').catch(() => ({}));
      entry = map && map[collegeId] ? map[collegeId] : null;
    } catch (_) {}

    // Fallback to legacy data path
    if (!entry) {
      try {
        const legacy = await fs.readJson('data/previous-reports.json').catch(() => ({}));
        entry = legacy && legacy[collegeId] ? legacy[collegeId] : null;
      } catch (_) {}
    }

    if (!entry) return null;

    // If entry is keyed by template, honor templateKey
    if (typeof entry === 'object' && !Array.isArray(entry)) {
      if (templateKey && entry[templateKey]) return entry[templateKey];
      const anyKey = Object.keys(entry)[0];
      return anyKey ? entry[anyKey] : null;
    }
    // Very old format already a data blob
    return entry;
  } catch (error) {
    console.error('Error reading previous report data:', error);
    return null;
  }
}

async function storeCurrentReportAsPrevious(collegeId, reportData) {
  try {
    const previousReportsPath = 'data/previous-reports.json';
    const previousReports = await fs.readJson(previousReportsPath).catch(() => ({}));
    
    previousReports[collegeId] = {
      data: reportData,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeJson(previousReportsPath, previousReports, { spaces: 2 });
  } catch (error) {
    console.error('Error storing previous report data:', error);
    throw error;
  }
}

async function getCollegeReports(collegeId) {
  try {
    const reportsPath = `data/reports/${collegeId}.json`;
    const reports = await fs.readJson(reportsPath).catch(() => []);
    return reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by date descending
  } catch (error) {
    console.error('Error reading college reports:', error);
    return [];
  }
}

async function saveCollegeReport(collegeId, reportData, reportName, summary) {
  try {
    const reportsPath = `data/reports/${collegeId}.json`;
    const reports = await fs.readJson(reportsPath).catch(() => []);
    
    const report = {
      id: Date.now().toString(),
      name: reportName || `Report ${new Date().toLocaleDateString()}`,
      summary: summary || 'No summary provided',
      data: reportData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    reports.unshift(report); // Add to beginning of array
    await fs.writeJson(reportsPath, reports, { spaces: 2 });
    
    return report;
  } catch (error) {
    console.error('Error saving college report:', error);
    throw error;
  }
}

async function getCollegeReport(collegeId, reportId) {
  try {
    const reportsPath = `data/reports/${collegeId}.json`;
    const reports = await fs.readJson(reportsPath).catch(() => []);
    return reports.find(report => report.id === reportId) || null;
  } catch (error) {
    console.error('Error reading college report:', error);
    return null;
  }
}

async function deleteCollegeReport(collegeId, reportId) {
  try {
    const reportsPath = `data/reports/${collegeId}.json`;
    const reports = await fs.readJson(reportsPath).catch(() => []);
    const filteredReports = reports.filter(report => report.id !== reportId);
    await fs.writeJson(reportsPath, filteredReports, { spaces: 2 });
  } catch (error) {
    console.error('Error deleting college report:', error);
    throw error;
  }
}

// Download reports
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../reports', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
});



// Get previous report data for change tracking
app.get('/api/previous-report/:collegeId', async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { templateKey } = req.query || {};
    const previousData = await getPreviousReportData(parseInt(collegeId), templateKey);
    // For compatibility with older front-end code paths, include a normalized 'data' field
    // If the stored object already has a 'data' property, surface that. Otherwise return the object itself.
    const data = previousData && previousData.data ? previousData.data : previousData || null;
    res.json({ success: true, previousData, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store current report as previous for next comparison
app.post('/api/store-report', async (req, res) => {
  try {
    const { collegeId, reportData } = req.body;
    await storeCurrentReportAsPrevious(parseInt(collegeId), reportData);
    res.json({ success: true, message: 'Report stored for future comparison' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all reports for a specific college
app.get('/api/colleges/:collegeId/reports', async (req, res) => {
  try {
    const { collegeId } = req.params;
    const reports = await getCollegeReports(parseInt(collegeId));
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a new report for a specific college
app.post('/api/colleges/:collegeId/reports', async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { reportData, reportName, summary } = req.body;
    const report = await saveCollegeReport(parseInt(collegeId), reportData, reportName, summary);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific report for a college
app.get('/api/colleges/:collegeId/reports/:reportId', async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    const report = await getCollegeReport(parseInt(collegeId), reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a report for a college
app.delete('/api/colleges/:collegeId/reports/:reportId', async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    await deleteCollegeReport(parseInt(collegeId), reportId);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single college by ID
app.get('/api/colleges/:collegeId', async (req, res) => {
  try {
    const { collegeId } = req.params;
    const colleges = await userManager.getColleges();
    const college = colleges.find(c => c.id === parseInt(collegeId));
    if (!college) {
      return res.status(404).json({ error: 'College not found' });
    }
    res.json({ success: true, college });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single account manager by ID
app.get('/api/account-managers/:accountManagerId', async (req, res) => {
  try {
    const { accountManagerId } = req.params;
    const accountManagers = await userManager.getAccountManagers();
    const accountManager = accountManagers.find(am => am.id === parseInt(accountManagerId));
    if (!accountManager) {
      return res.status(404).json({ error: 'Account manager not found' });
    }
    res.json({ success: true, accountManager });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export report as Excel with formatting
app.get('/api/colleges/:collegeId/reports/:reportId/excel', async (req, res) => {
  try {
    const { collegeId, reportId } = req.params;
    const report = await getCollegeReport(parseInt(collegeId), reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Load previous report data scoped to the same template (if available)
    const templateKey = report.templateKey || report.data?.meta?.templateKey || null;
    const previousData = await getPreviousReportData(parseInt(collegeId), templateKey);
    
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
    
    // Function to determine column section and color (aligned with dashboard/app.js)
    function getColumnSection(header) {
      const headerLower = String(header || '').toLowerCase();
      const COLORS = {
        placements: 'FFDBEAFE',
        assessments: 'FFCCFBF1',
        careers: 'FFFED7AA',
        activities: 'FFFEF3C7',
        enrichment: 'FFDCFCE7',
        employment: 'FFF3E8FF',
        'employer-activity': 'FFFEE2E2',
        'enrichment-activity': 'FFE0F7FA',
        targets: 'FFFCE7F3',
        login: 'FFE0E7FF',
        default: 'FFF3F4F6'
      };
      const pick = (section) => ({ section, color: COLORS[section] || COLORS.default });
      if (headerLower === 'department') return { section: 'Department', color: 'FFFEF3C7' };
      if (headerLower.includes('(employer activity)')) return pick('employer-activity');
      if (headerLower.includes('(enrichment activity)')) return pick('enrichment-activity');
      if (headerLower.includes('(enrichment)')) return pick('enrichment');
      if (headerLower.includes('(employer)') || headerLower.includes('(employment)')) return pick('employment');
      if (headerLower.includes('(placements)')) return pick('placements');
      if (headerLower.includes('(careers)')) return pick('careers');
      if (headerLower.includes('(assessments)')) return pick('assessments');
      if (headerLower.includes('(targets)')) return pick('targets');
      if (headerLower.includes('(login)')) return pick('login');
      if (headerLower.includes('placement') || headerLower.includes('placed') || headerLower.includes('hours scheduled') || headerLower.includes('scheduled to date')) return pick('placements');
      if (headerLower.includes('enrichment')) return pick('enrichment');
      if (headerLower.includes('employer') && (headerLower.includes('engagement') || headerLower.includes('activity'))) return pick('employment');
      if (headerLower.includes('career') || headerLower.includes('job profile') || headerLower.includes('quiz')) return pick('careers');
      if (headerLower.includes('assessment') || headerLower.includes('average score') || headerLower.includes('students without')) return pick('assessments');
      if (headerLower.includes('activity') || (headerLower.includes('hours') && !headerLower.includes('scheduled'))) return pick('activities');
      if (headerLower.includes('login') || headerLower.includes('access')) return pick('login');
      return pick('default');
    }
    
          // Add headers with section-based formatting
      const headerRow = worksheet.getRow(dataStartRow);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FF000000' } }; // Black text for light backgrounds
        
        const sectionInfo = getColumnSection(header);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: sectionInfo.color }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    
    // Set column widths
    headers.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = Math.max(header.length + 5, 15);
    });
    

    
    // Prepare previous lookup maps: header index and Department row map
    const prevHeaders = previousData && Array.isArray(previousData.headers) ? previousData.headers : null;
    const prevRows = previousData && Array.isArray(previousData.rows) ? previousData.rows : null;
    const prevHeaderIndex = new Map();
    if (prevHeaders) prevHeaders.forEach((h, i) => prevHeaderIndex.set(String(h || ''), i));
    const prevDeptRowMap = new Map();
    if (prevRows) prevRows.forEach(r => {
      const key = (r && r.length ? String(r[0] || '') : '').trim().toLowerCase();
      if (key) prevDeptRowMap.set(key, r);
    });

    // Helpers for +/- logic
    const isPercentageHeader = (h) => {
      const s = String(h || '').toLowerCase();
      return s.includes('percent') || s.includes('%');
    };
    const parseNumberLike = (val) => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return isFinite(val) ? val : null;
      const str = String(val).trim();
      if (!str) return null;
      if (str.endsWith('%')) { const p = parseFloat(str); return isNaN(p) ? null : p / 100; }
      const n = parseFloat(str); return isNaN(n) ? null : n;
    };
    const isNumericColumn = (colIndex) => {
      if (isPercentageHeader(headers[colIndex])) return true;
      const limit = Math.min(rows.length, 25);
      for (let i = 0; i < limit; i++) {
        const v = parseNumberLike(rows[i]?.[colIndex]);
        if (typeof v === 'number') return true;
      }
      return false;
    };

    // Build complete header structure with change columns positioned correctly
    let completeHeaders = [];
    let changeColumnMap = new Map(); // Maps original column index to change column index
    headers.forEach((header, colIndex) => {
      completeHeaders.push(header);
      if (header !== 'Department' && isNumericColumn(colIndex)) {
        const changeHeader = `${header} +/-`;
        completeHeaders.push(changeHeader);
        changeColumnMap.set(colIndex, completeHeaders.length - 1);
      }
    });
    
    // Clear existing headers and add complete headers
    worksheet.getRow(dataStartRow).values = completeHeaders;
    
    // Re-apply header formatting with section colors
    completeHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(dataStartRow, index + 1);
      cell.font = { bold: true, color: { argb: 'FF000000' } }; // Black text for light backgrounds
      
      // Determine if this is a change column (ends with +/-)
      const isChangeColumn = header.endsWith(' +/-');
      const originalHeader = isChangeColumn ? header.replace(' +/-', '') : header;
      
      const sectionInfo = getColumnSection(originalHeader);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: sectionInfo.color }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Set column width
      worksheet.getColumn(index + 1).width = Math.max(header.length + 5, 15);
    });
    
    // Add data rows with change columns in correct positions
    rows.forEach((row, rowIndex) => {
      const excelRow = worksheet.getRow(dataStartRow + 1 + rowIndex);
      let colIndex = 0;
      
      headers.forEach((header, originalColIndex) => {
        const cell = row[originalColIndex];
        
        // Add the main data cell
        const excelCell = excelRow.getCell(colIndex + 1);
        excelCell.value = cell;
        
        // Format cells based on content
        if (header && (header.toLowerCase().includes('percent') || header.includes('%'))) {
          if (typeof cell === 'number' || !isNaN(parseFloat(cell))) {
            let percentage = parseFloat(cell);
            if (percentage <= 1) {
              percentage = percentage * 100;
            }
            excelCell.value = percentage / 100; // Excel expects decimal
            excelCell.numFmt = '0.0%';
          }
        }
        // Format numbers
        else if (typeof cell === 'number' || (!isNaN(parseFloat(cell)) && cell !== '')) {
          excelCell.value = parseFloat(cell);
          excelCell.numFmt = '#,##0.00';
        }
        // Text formatting
        else {
          excelCell.value = cell;
          excelCell.alignment = { horizontal: 'left' };
        }
        
        colIndex++;
        
        // Add change indicator cell if this column should have one
        if (changeColumnMap.has(originalColIndex)) {
          const changeCell = excelRow.getCell(colIndex + 1);
          const deptKey = String(row[0] || '').trim().toLowerCase();
          const prevRow = deptKey ? prevDeptRowMap.get(deptKey) : null;
          const prevColIdx = prevHeaderIndex.has(header) ? prevHeaderIndex.get(header) : null;
          const currentNum = parseNumberLike(cell);
          const prevNum = (prevRow != null && prevColIdx != null) ? parseNumberLike(prevRow[prevColIdx]) : null;
          let change = null;
          if (currentNum != null && prevNum != null) change = currentNum - prevNum;
          else if (!previousData) change = 0; // match dashboard when no previous for this template

          if (change !== null) {
            changeCell.value = change;
            if (isPercentageHeader(header)) changeCell.numFmt = '+0.00%;-0.00%;0.00%';
            else changeCell.numFmt = '+0.00;-0.00;0.00';
            if (change > 0) {
              changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
              changeCell.font = { color: { argb: 'FF2E7D32' } };
            } else if (change < 0) {
              changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
              changeCell.font = { color: { argb: 'FFC62828' } };
            } else {
              changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
              changeCell.font = { color: { argb: 'FFE65100' } };
            }
          } else {
            changeCell.value = '';
            changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            changeCell.font = { color: { argb: 'FF666666' } };
          }

          colIndex++;
        }
      });
    });
    
    // No row coloring - keeping rows white for clean appearance
    
    // Add borders to data cells only
    for (let rowNum = dataStartRow; rowNum <= dataStartRow + rows.length; rowNum++) {
      const row = worksheet.getRow(rowNum);
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // Add data bars (progressive bars) for percentage columns with solid blue bars
    headers.forEach((header, colIndex) => {
      if (header && (header.toLowerCase().includes('percent') || header.includes('%'))) {
        // Calculate the actual column position in the final structure
        let actualColIndex = colIndex;
        for (let i = 0; i < colIndex; i++) {
          if (headers[i] !== 'Department' && (headers[i].toLowerCase().includes('percent') || headers[i].includes('%') || !isNaN(parseFloat('0')))) {
            actualColIndex++;
          }
        }
        
        const columnLetter = worksheet.getColumn(actualColIndex + 1).letter;
        const dataRange = `${columnLetter}${dataStartRow + 1}:${columnLetter}${dataStartRow + rows.length}`;
        
        // Add solid blue data bars
        worksheet.addConditionalFormatting({
          ref: dataRange,
          rules: [
            {
              type: 'dataBar',
              cfvo: [
                { type: 'min' },
                { type: 'max' }
              ],
              color: {
                argb: 'FF4472C4' // Solid blue color for data bars
              },
              showValue: true,
              minLength: 0,
              maxLength: 100
            }
          ]
        });
      }
    });
    
    // Set response headers
    const filename = `${report.name}_${new Date(report.createdAt).toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`AM Reports Automation Server running on port ${PORT}`);
  console.log(`Visit ${process.env.BASE_URL || 'https://am-reports-hub-production.up.railway.app'} to access the application`);
});
