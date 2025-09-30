const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from public so /index.html, /login etc. work immediately
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

// Minimal healthcheck endpoint - responds immediately
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Fallback: get current user details
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.cookies?.token ||
                  req.query.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const AuthService = require('./src/services/AuthService');
    const authService = new AuthService();
    const validation = await authService.validateSession(token);
    if (!validation.success) return res.status(401).json({ error: 'Authentication required' });
    const user = await authService.getUserById(validation.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const sanitized = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      accountManagerId: user.accountManagerId
    };
    return res.json({ success: true, user: sanitized });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

// Fallback auth routes so login page can work even if full app hasn't loaded yet
// Keep these extremely lightweight and dependency-free
app.get('/auth/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.cookies?.token ||
                  req.query.token;
    if (!token) return res.json({ authenticated: false });
    const AuthService = require('./src/services/AuthService');
    const authService = new AuthService();
    const validation = await authService.validateSession(token);
    if (!validation.success) return res.json({ authenticated: false });
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
  } catch (_) {
    return res.json({ authenticated: false });
  }
});

app.get('/api/auth/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.cookies?.token ||
                  req.query.token;
    if (!token) return res.json({ authenticated: false });
    const AuthService = require('./src/services/AuthService');
    const authService = new AuthService();
    const validation = await authService.validateSession(token);
    if (!validation.success) return res.json({ authenticated: false });
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
  } catch (_) {
    return res.json({ authenticated: false });
  }
});

// Fallback login with lazy require to avoid startup failures
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    let AuthService;
    try {
      AuthService = require('./src/services/AuthService');
    } catch (e) {
      console.error('AuthService load error:', e?.message || e);
      return res.status(503).json({ error: 'Auth service initializing, please retry in a moment' });
    }
    const authService = new AuthService();
    const result = await authService.authenticateUser(
      username,
      password,
      req.ip || req.connection?.remoteAddress,
      req.headers['user-agent']
    );
    if (!result.success) {
      return res.status(401).json({ error: result.message || 'Invalid credentials' });
    }
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.json({ success: true, user: result.user });
  } catch (e) {
    console.error('Fallback login error:', e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Quiet favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Load and mount the full application BEFORE starting server
console.log('📦 Loading full AM Reports Hub application...');
try {
  const fullApp = require('./app.js');
  app.use(fullApp);
  console.log('✅ Full application routes mounted successfully');
} catch (error) {
  console.error('❌ Error loading full application:', error);
  console.error('Stack trace:', error.stack);
  console.log('⚠️ Continuing with minimal server functionality');
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('🏥 Healthcheck endpoint ready at /');
  console.log('📡 API routes available at /api/*');
  
  // Initialize services after server is listening (non-blocking)
  setImmediate(async () => {
    console.log('🔄 Starting background service initialization...');
    try {
      const DatabaseService = require('./src/services/DatabaseService');
      const volumeService = require('./src/services/VolumeService');
      const dataPreservationService = require('./src/services/DataPreservationService');
      
      if (process.env.DATABASE_URL && process.env.SKIP_MIGRATIONS !== '1') {
        console.log('🐘 PostgreSQL detected - initializing database services...');
        // Use setImmediate to yield control back to event loop frequently
        await DatabaseService.initialize();
      } else if (process.env.DATABASE_URL && process.env.SKIP_MIGRATIONS === '1') {
        console.log('⏭️ Skipping database migrations (SKIP_MIGRATIONS=1)');
      } else {
        console.log('📁 File-based storage - initializing volume service...');
        await volumeService.initialize();
        await dataPreservationService.initializeDataPreservation();
      }
      console.log('✅ Background services initialized');
    } catch (err) {
      console.error('⚠️ Service initialization failed (non-critical):', err.message);
      console.error('Stack:', err.stack);
    }
  });
});

module.exports = app;
