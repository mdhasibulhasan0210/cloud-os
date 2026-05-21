// Upload middleware — now uses Backblaze B2 for files, Cloudinary for profile pictures
const b2 = require('../utils/b2Storage');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary (profile pictures only)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Profile picture storage — still uses Cloudinary (small images, no size issue)
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cloud-os/profiles',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }, { quality: 'auto' }],
    public_id: (req, file) => `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}`
  }
});

// File uploads — use B2 (memory storage, uploaded in controller)
exports.uploadFile     = b2.uploadFile;
exports.uploadBroadcast = b2.uploadBroadcast;

// Profile pictures — still Cloudinary
exports.uploadProfile = multer({
  storage: profileStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

exports.cloudinary = cloudinary;
