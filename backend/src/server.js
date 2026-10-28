const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Optional: Serve static files for frontend if present
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint (Preserved)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'ApplyTrack backend is running successfully',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);

// Fallback for undefined routes / SPA routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(__dirname, '../public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Endpoint not found' });
    }
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`ApplyTrack backend server running on port ${PORT}`);
});

module.exports = app;
