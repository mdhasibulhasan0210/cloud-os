const bcrypt = require('bcrypt');
const User    = require('../models/User');
const Setting = require('../models/Setting');
const logger  = require('./logger');

async function initializeAdmin() {
  try {
    // Get owner credentials from environment variables
    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerPassword = process.env.OWNER_PASSWORD;
    const ownerUsername = process.env.OWNER_USERNAME || 'System Owner';

    // Validate owner credentials exist
    if (!ownerEmail || !ownerPassword) {
      logger.warn('OWNER_EMAIL and OWNER_PASSWORD not set in environment. Skipping owner account creation.');
      return;
    }

    let owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      const passwordHash = await bcrypt.hash(ownerPassword, 10);
      await User.create({
        username: ownerUsername,
        email: ownerEmail,
        passwordHash,
        role: 'owner',
        status: 'approved',
        profilePicture: '/assets/images/profile.png'
      });
      logger.info('Owner account created → ' + ownerEmail);
    } else if (owner.role !== 'owner') {
      // Upgrade existing admin to owner
      await User.findByIdAndUpdate(owner._id, { role: 'owner', status: 'approved' });
      logger.info('Account upgraded to owner → ' + ownerEmail);
    } else {
      logger.info('Owner account already exists: ' + ownerEmail);
    }

    // Ensure there's at least one admin (separate from owner)
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      logger.info('No separate admin found — owner has full admin access');
    }

    // Seed default settings
    const settings = await Setting.findOne({ key: 'site' });
    if (!settings) {
      await Setting.create({
        key: 'site',
        bio: 'Personal cloud & digital archive owner.',
        tagline: 'Personal Cloud OS - Store, Organize, Share',
        aboutText: 'Building a private digital workspace for organizing knowledge, academic resources, and personal files.'
      });
      logger.info('Default site settings created');
    }
  } catch (error) {
    logger.error('Error initializing admin:', error);
  }
}

module.exports = initializeAdmin;
