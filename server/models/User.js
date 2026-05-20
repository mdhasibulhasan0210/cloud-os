const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:     { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  status:   { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
  profilePicture: { type: String, default: '/assets/images/default-avatar.png' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
