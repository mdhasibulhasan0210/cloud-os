const mongoose = require('mongoose');

const subFolderSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true }
}, { timestamps: true });

module.exports = mongoose.model('SubFolder', subFolderSchema);
