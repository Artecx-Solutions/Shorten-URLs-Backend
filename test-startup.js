// Simple test to verify the app can start
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🧪 Testing basic Express server...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: PORT,
  NODE_VERSION: process.version
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Test server is working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

server.on('error', (error) => {
  console.error('❌ Test server error:', error);
  process.exit(1);
});

module.exports = app;
