const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const path = require('path');

// Backblaze B2 S3-compatible client
const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY
  }
});

const BUCKET = process.env.B2_BUCKET_NAME;

/**
 * Upload a file buffer to Backblaze B2
 */
async function uploadToB2(buffer, originalname, mimetype) {
  const ext = path.extname(originalname);
  const key = `uploads/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    ContentDisposition: `inline; filename="${originalname}"`
  }));

  return {
    key,
    url: `${process.env.B2_ENDPOINT}/${BUCKET}/${key}`
  };
}

/**
 * Generate a signed URL for private file access (valid 1 hour)
 */
async function getSignedFileUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete a file from B2
 */
async function deleteFromB2(key) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (e) {
    console.error('B2 delete error:', e.message);
  }
}

/**
 * Multer memory storage — files stored in memory then uploaded to B2
 */
const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Invalid file type'), false);
};

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only images allowed'), false);
};

// Use memory storage — we upload to B2 manually in the controller
exports.uploadFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB — B2 has no per-file limit on free tier
});

exports.uploadProfile = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

exports.uploadBroadcast = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }
});

exports.uploadToB2 = uploadToB2;
exports.getSignedFileUrl = getSignedFileUrl;
exports.deleteFromB2 = deleteFromB2;
exports.s3 = s3;
