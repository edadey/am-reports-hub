const http = require('http');

function testHealthcheck() {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || 'localhost';
  
  console.log(`🔍 Testing healthcheck endpoint at http://${host}:${port}/health`);
  
  const options = {
    hostname: host,
    port: port,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ Healthcheck Response:', response);
        
        if (res.statusCode === 200 && response.status === 'healthy') {
          console.log('🎉 Healthcheck PASSED!');
          process.exit(0);
        } else {
          console.log('❌ Healthcheck FAILED - Invalid response');
          process.exit(1);
        }
      } catch (error) {
        console.log('❌ Healthcheck FAILED - Invalid JSON response');
        console.log('Raw response:', data);
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Healthcheck FAILED - Connection error:', error.message);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.error('❌ Healthcheck FAILED - Timeout');
    req.destroy();
    process.exit(1);
  });

  req.end();
}

// Wait a bit for the server to start
setTimeout(testHealthcheck, 3000);
