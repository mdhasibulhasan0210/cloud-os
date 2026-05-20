const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
