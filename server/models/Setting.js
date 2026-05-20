const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  bio:       { type: String, default: '' },
  tagline:   { type: String, default: '' },
  aboutText: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
