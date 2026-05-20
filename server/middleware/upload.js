const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage for general files (PDFs, docs, images)
const fileStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';
    return {
      folder: 'cloud-os/uploads',
      resource_type: 'auto',
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'xls', 'xlsx'],
      // Use 'raw' for non-image files to bypass Cloudinary image size limits
      ...((!isImage && !isPdf) && { resource_type: 'raw' }),
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_')}`,
      ...(isImage && { transformation: [{ quality: 'auto' }] })
    };
  }
});

// Storage for profile pictures
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

// File filter for documents + images
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, and documents allowed.'), false);
  }
};

// File filter for images only
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images allowed.'), false);
  }
};

// Multer instances
exports.uploadFile = multer({
  storage: fileStorage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

exports.uploadProfile = multer({
  storage: profileStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

exports.uploadBroadcast = multer({
  storage: fileStorage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Export cloudinary instance for use in controllers (delete files etc.)
exports.cloudinary = cloudinary;
