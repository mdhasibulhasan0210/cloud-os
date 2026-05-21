const bcrypt = require('bcrypt');
const User    = require('../models/User');
const Setting = require('../models/Setting');
const logger  = require('./logger');

async function initializeAdmin() {
  try {
    // Create/update owner account
    const ownerEmail = 'mdhasibulhasan0210@gmail.com';
    const ownerPassword = 'EverySoulWillTasteDeath,Surah-Al-Anbiya_Verse35';

    let owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      const passwordHash = await bcrypt.hash(ownerPassword, 10);
      await User.create({
        username: 'MD.Hasibul Hasan',
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
