const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

// Simple test route
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
    timestamp: new Date().toISOString() 
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});

module.exports = app;
