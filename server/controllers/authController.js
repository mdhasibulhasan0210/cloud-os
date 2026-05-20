const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/db');
const { jwtSecret, jwtExpire, cookieOptions } = require('../config/auth');
const logger = require('../utils/logger');

// Validation schemas
const signupSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, jwtSecret, { expiresIn: jwtExpire });
};

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    // Validate input
    const { error, value } = signupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.details[0].message 
      });
    }

    const { username, email, password } = value;

    // Check if user already exists
    const existingUser = await db.users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with pending status
    const newUser = {
      username,
      email,
      passwordHash,
      role: 'user',
      status: 'pending',
      profilePicture: '/assets/images/default-avatar.png',
      createdAt: new Date()
    };

    const user = await db.users.insert(newUser);

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please wait for admin approval.',
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        status: user.status
      }
    });

  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.details[0].message 
      });
    }

    const { email, password } = value;

    // Find user
    const user = await db.users.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account suspended. Contact administrator.' 
      });
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie('token', token, cookieOptions);

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0)
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await db.users.findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    logger.error('Get me error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
