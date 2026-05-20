const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename:      { type: String },
  originalname:  { type: String, required: true },
  path:          { type: String, required: true },
  mimetype:      { type: String },
  size:          { type: Number },
  category:      { type: String, enum: ['book','note','sheet','pdf','other'], default: 'other' },
  description:   { type: String, default: '' },
  uploadedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  owner:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status:        { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  downloadAllowed: { type: Boolean, default: true },
  sharedWith:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  thumbnailPath: { type: String },
  subjectId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  chapterId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }
}, { timestamps: true });

fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ owner: 1 });
fileSchema.index({ chapterId: 1 });

module.exports = mongoose.model('File', fileSchema);
