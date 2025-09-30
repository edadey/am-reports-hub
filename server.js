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

// Fallback auth routes so login page can work even if app.js hasn't loaded yet
try {
  const AuthService = require('./src/services/AuthService');
  const authService = new AuthService();

  // Lightweight status check (no 401s)
  const statusHandler = async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') ||
                    req.cookies?.token ||
                    req.query.token;
      if (!token) return res.json({ authenticated: false });
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
  };

  app.get('/auth/status', statusHandler);
  app.get('/api/auth/status', statusHandler);

  // Fallback login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      const result = await authService.authenticateUser(
        username,
        password,
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent']
      );
      if (!result.success) {
        return res.status(401).json({ error: result.message || 'Invalid credentials' });
      }
      // Set HTTP-only cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
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
} catch (e) {
  console.error('Fallback auth routes disabled:', e?.message || e);
}

// Start server immediately
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('🏥 Healthcheck endpoint ready at /');
  console.log('🔄 Loading full application...');
  
  // Load the full application after server is ready
  setTimeout(() => {
    try {
      console.log('📦 Loading full AM Reports Hub application...');
      
      // Load the full app and mount its routes
      const fullApp = require('./app.js');
      app.use(fullApp);
      console.log('✅ Full application mounted successfully');
      
    } catch (error) {
      console.error('❌ Error loading full application:', error.message);
      console.log('⚠️ Continuing with minimal server functionality');
      
      // Add basic routes for common pages as a fallback
      app.get('/login', (req, res) => {
        res.send(`
          <html>
            <head><title>AM Reports Hub - Login</title></head>
            <body>
              <h1>AM Reports Hub</h1>
              <p>Application is starting up...</p>
              <p>Please wait a moment and refresh the page.</p>
            </body>
          </html>
        `);
      });
      
      app.get('/college-dashboard', (req, res) => {
        res.send(`
          <html>
            <head><title>AM Reports Hub - Dashboard</title></head>
            <body>
              <h1>College Dashboard</h1>
              <p>Application is starting up...</p>
              <p>Please wait a moment and refresh the page.</p>
            </body>
          </html>
        `);
      });
      
      app.get('/admin-dashboard', (req, res) => {
        res.send(`
          <html>
            <head><title>AM Reports Hub - Admin</title></head>
            <body>
              <h1>Admin Dashboard</h1>
              <p>Application is starting up...</p>
              <p>Please wait a moment and refresh the page.</p>
            </body>
          </html>
        `);
      });
    }
  }, 2000); // Wait 2 seconds to ensure healthcheck is stable
});

module.exports = app;
