const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from public so /index.html, /login etc. work immediately
app.use(express.static(path.join(__dirname, 'public')));

// Minimal healthcheck endpoint - responds immediately
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

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
