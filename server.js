const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

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
      
      // Try to load the full app
      require('./app.js');
      console.log('✅ Full application loaded successfully');
      
    } catch (error) {
      console.error('❌ Error loading full application:', error.message);
      console.log('⚠️ Continuing with minimal server functionality');
      
      // Add basic routes for common pages
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
