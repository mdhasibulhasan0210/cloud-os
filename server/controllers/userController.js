const bcrypt = require('bcrypt');
const User   = require('../models/User');
const logger = require('../utils/logger');
const { deleteFromCloudinary } = require('../utils/thumbnailGenerator');

// @desc    Get all approved users (exclude self)
exports.getApprovedUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'approved', _id: { $ne: req.user.id } });
    res.json({ success: true, users: users.map(u => ({ id: u._id.toString(), username: u.username, email: u.email, profilePicture: u.profilePicture, role: u.role })) });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// @desc    Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.json({ success: true, users: users.map(u => ({ id: u._id.toString(), username: u.username, email: u.email, role: u.role, status: u.status, profilePicture: u.profilePicture, createdAt: u.createdAt })) });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// @desc    Update own profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (username && username !== user.username) user.username = username;

    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (exists) return res.status(400).json({ success: false, message: 'Email already in use' });
      user.email = email;
    }

    if (newPassword && currentPassword) {
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (req.file) {
      if (user.profilePicture && user.profilePicture.startsWith('http')) {
        await deleteFromCloudinary(user.profilePicture, 'image');
      }
      user.profilePicture = req.file.path;
    }

    await user.save();
    res.json({ success: true, message: 'Profile updated successfully', user: { id: user._id.toString(), username: user.username, email: user.email, profilePicture: user.profilePicture } });
  } catch (e) { logger.error('Update profile error:', e); res.status(500).json({ success: false, message: 'Server error' }); }
};

// @desc    Admin reset a user's password
exports.adminResetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin' && req.user.id !== id) return res.status(403).json({ success: false, message: 'Cannot reset another admin password' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    logger.info(`Password reset for user ${user.email} by admin`);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// @desc    Promote/demote user role
exports.changeRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['user', 'moderator', 'admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
    if (id === req.user.id) return res.status(403).json({ success: false, message: 'You cannot change your own role' });

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'admin') return res.status(403).json({ success: false, message: "Cannot change another admin's role" });
    if (role === 'admin' && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only admin can promote to admin' });

    await User.findByIdAndUpdate(id, { role });
    logger.info(`Role changed: ${target.email} → ${role} by ${req.user.email}`);
    res.json({ success: true, message: `Role updated to ${role}` });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// @desc    Update user (admin/moderator)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, status, role, resetPassword } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.user.role === 'moderator' && (user.role === 'admin' || user.role === 'moderator')) {
      return res.status(403).json({ success: false, message: 'Moderators cannot edit admins or other moderators' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (status) user.status = status;
    if (role && req.user.role === 'admin' && user.role !== 'admin') user.role = role;
    if (resetPassword && req.user.role === 'admin') user.passwordHash = await bcrypt.hash(resetPassword, 10);

    await user.save();
    res.json({ success: true, message: 'User updated successfully', user: { id: user._id.toString(), username: user.username, email: user.email, role: user.role, status: user.status } });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// @desc    Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (user && user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin account' });
    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};
