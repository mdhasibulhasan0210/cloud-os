const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:     { type: String, required: true },
  type:        { type: String, enum: ['approval','share','message','broadcast','system'], default: 'system' },
  read:        { type: Boolean, default: false },
  fileId:      { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
  messageId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  broadcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast' }
}, { timestamps: true });

notificationSchema.index({ userId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
