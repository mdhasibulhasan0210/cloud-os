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
    const isDoc = ['application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ].includes(file.mimetype);

    // Use 'raw' for PDFs and docs — bypasses Cloudinary's 10MB image limit
    // Raw files support up to 100MB on free plan
    const resourceType = isImage ? 'image' : 'raw';

    return {
      folder: 'cloud-os/uploads',
      resource_type: resourceType,
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

exports.uploadFile = multer({
  storage: fileStorage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB (Cloudinary raw free plan limit)
});

exports.uploadProfile = multer({
  storage: profileStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

exports.uploadBroadcast = multer({
  storage: fileStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Export cloudinary instance for use in controllers (delete files etc.)
exports.cloudinary = cloudinary;
