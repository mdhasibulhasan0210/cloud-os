const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const db = require('../config/db');

// Verify JWT token from cookie
exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized, no token' });

    const decoded = jwt.verify(token, jwtSecret);
    const user = await db.users.findOne({ _id: decoded.id });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      profilePicture: user.profilePicture
    };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

// Owner only
exports.ownerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'owner') return next();
  return res.status(403).json({ success: false, message: 'Owner access required' });
};

// Admin only (owner also passes)
exports.adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'owner')) return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

// Admin or Moderator (owner also passes)
exports.adminOrModerator = (req, res, next) => {
  if (req.user && ['admin', 'moderator', 'owner'].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Admin or Moderator access required' });
};

// Approved users only
exports.approvedOnly = (req, res, next) => {
  if (req.user && (req.user.status === 'approved' || ['admin', 'owner'].includes(req.user.role))) return next();
  return res.status(403).json({ success: false, message: 'Account not yet approved by admin' });
};