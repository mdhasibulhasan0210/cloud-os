const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // null for contact form messages
  to:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:          { type: String, required: true },
  attachment:    { type: String, default: null },
  read:          { type: Boolean, default: false },
  isContactForm: { type: Boolean, default: false }, // true if from contact form
  contactName:   { type: String, default: null }, // name from contact form
  contactEmail:  { type: String, default: null } // email from contact form
}, { timestamps: true });

messageSchema.index({ from: 1 });
messageSchema.index({ to: 1 });
messageSchema.index({ isContactForm: 1 });

module.exports = mongoose.model('Message', messageSchema);
