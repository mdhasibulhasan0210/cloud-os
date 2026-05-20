const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  message:    { type: String, required: true },
  attachment: { type: String, default: null },
  pinned:     { type: Boolean, default: false },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Broadcast', broadcastSchema);
