const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  gpa:         { type: Number, required: true },
  description: { type: String, default: '' },
  fileUrl:     { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
