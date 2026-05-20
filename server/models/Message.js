const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:       { type: String, required: true },
  attachment: { type: String, default: null },
  read:       { type: Boolean, default: false }
}, { timestamps: true });

messageSchema.index({ from: 1 });
messageSchema.index({ to: 1 });

module.exports = mongoose.model('Message', messageSchema);
