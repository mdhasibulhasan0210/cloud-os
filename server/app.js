const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
// Load .env from project root regardless of where node is run from
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development; configure properly in production
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Compression
app.use(compression());

// Trust proxy (required for Railway, Render, and other reverse proxies)
app.set('trust proxy', 1);

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, message: 'Too many requests. Please wait and try again.' });
  }
});

// Static files with cache headers
app.use('/assets', express.static(path.join(__dirname, '../client/public/assets'), { maxAge: '1d' }));
app.use('/css', express.static(path.join(__dirname, '../client/public/css'), { maxAge: '1d' }));
app.use('/js', express.static(path.join(__dirname, '../client/public/js'), { maxAge: '1d' }));

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/assets/images/favicon.png'));
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../client/views'));

// API Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/chapters', require('./routes/chapters'));
app.use('/api/files', require('./routes/files'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/broadcasts', require('./routes/broadcasts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/results', require('./routes/results'));
app.use('/api/subfolders', require('./routes/subfolders'));
app.use('/api/bookmarks', require('./routes/bookmarks'));

// View Routes
const { protect, adminOnly, adminOrModerator } = require('./middleware/auth');
const db = require('./config/db');

// Home page
app.get('/', async (req, res) => {
  try {
    const settings = await db.settings.findOne({ key: 'site' });
    res.render('index', {
      bio: settings?.bio || 'Welcome to my personal cloud operating system.',
      tagline: settings?.tagline || 'Personal Cloud OS - Store, Organize, Share'
    });
  } catch (error) {
    res.render('index', {
      bio: 'Welcome to my personal cloud operating system.',
      tagline: 'Personal Cloud OS - Store, Organize, Share'
    });
  }
});

// About page
app.get('/about', async (req, res) => {
  try {
    const settings = await db.settings.findOne({ key: 'site' });
    res.render('about', {
      aboutText: settings?.aboutText || 'Passionate learner and knowledge organizer.'
    });
  } catch (error) {
    res.render('about', {
      aboutText: 'Passionate learner and knowledge organizer.'
    });
  }
});

// Contact page
app.get('/contact', (req, res) => {
  res.render('contact');
});

// Auth page
app.get('/auth', (req, res) => {
  res.render('auth');
});

// Dashboard (protected)
app.get('/dashboard', protect, (req, res) => {
  if (req.user.status === 'pending' && req.user.role !== 'admin') {
    return res.render('pending');
  }
  res.render('dashboard', { user: req.user });
});

// Admin panel (admin, moderator, and owner)
app.get('/admin', protect, adminOrModerator, (req, res) => {
  res.render('admin', { user: req.user });
});

// Subject explorer
app.get('/explorer', protect, (req, res) => {
  res.render('explorer', { user: req.user });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Error handler
app.use((err, req, res, next) => {
  // Handle multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum file size is 10MB. Please compress your file and try again.'
    });
  }
  // Handle Cloudinary size error
  if (err.message && err.message.includes('File size too large')) {
    return res.status(400).json({
      success: false,
      message: 'File too large for free storage. Maximum is 10MB. Please compress your PDF and try again.'
    });
  }
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error'
  });
});

module.exports = app;
