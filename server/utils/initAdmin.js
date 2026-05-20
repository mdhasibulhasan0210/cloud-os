const bcrypt = require('bcrypt');
const User    = require('../models/User');
const Setting = require('../models/Setting');
const logger  = require('./logger');

async function initializeAdmin() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });

    if (!adminExists) {
      logger.info('No admin found. Creating default admin account...');
      const passwordHash = await bcrypt.hash(
        'EverySoulWillTasteDeath,Surah-Al-Anbiya_Verse35', 10
      );
      await User.create({
        username: 'MD.Hasibul Hasan',
        email: 'mdhasibulhasan0210@gmail.com',
        passwordHash,
        role: 'admin',
        status: 'approved',
        profilePicture: '/assets/images/profile.png'
      });
      logger.info('Admin created → mdhasibulhasan0210@gmail.com');
    } else {
      if (adminExists.email === 'hasibulhasan0210@admin.com') {
        await User.findByIdAndUpdate(adminExists._id, { email: 'mdhasibulhasan0210@gmail.com' });
        logger.info('Admin email updated');
      } else {
        logger.info('Admin account already exists: ' + adminExists.email);
      }
    }

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
