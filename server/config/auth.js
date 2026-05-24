require('dotenv').config();

// Validate JWT_SECRET exists
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Please set it in your .env file.');
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: '7d',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
};
