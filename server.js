const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Minimal healthcheck endpoint
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Start server immediately
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Healthcheck endpoint ready at /');
});

module.exports = app;
