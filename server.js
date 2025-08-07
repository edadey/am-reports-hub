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
      require('./app.js');
      console.log('✅ Full application loaded successfully');
    } catch (error) {
      console.error('❌ Error loading full application:', error.message);
      console.log('⚠️ Continuing with minimal server functionality');
    }
  }, 2000); // Wait 2 seconds to ensure healthcheck is stable
});

module.exports = app;
