const B2 = require('backblaze-b2');
const multer = require('multer');
const path = require('path');

// Backblaze B2 native client
const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY
});

let b2Authorized = false;
let authExpiry = 0;

async function ensureAuthorized() {
  if (b2Authorized && Date.now() < authExpiry) return;
  try {
    await b2.authorize();
    b2Authorized = true;
    authExpiry = Date.now() + 23 * 60 * 60 * 1000;
  } catch (err) {
    b2Authorized = false;
    console.error('B2 auth failed:', err.response?.data || err.message);
    throw new Error('B2 authorization failed: ' + (err.response?.data?.message || err.message));
  }
}

/**
 * Upload a file buffer to Backblaze B2
 */
async function uploadToB2(buffer, originalname, mimetype) {
  await ensureAuthorized();

  const ext = path.extname(originalname);
  const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `uploads/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;

  // Get upload URL
  const { data: uploadUrlData } = await b2.getUploadUrl({
    bucketId: process.env.B2_BUCKET_ID
  });

  // Upload file
  const { data: fileData } = await b2.uploadFile({
    uploadUrl: uploadUrlData.uploadUrl,
    uploadAuthToken: uploadUrlData.authorizationToken,
    fileName: key,
    data: buffer,
    mime: mimetype,
    contentLength: buffer.length
  });

  // Construct download URL
  const downloadUrl = `${b2.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${key}`;

  return {
    key,
    fileId: fileData.fileId,
    url: downloadUrl
  };
}

/**
 * Generate a signed download URL for private file access (valid 1 hour)
 */
async function getSignedFileUrl(key, expiresIn = 3600) {
  await ensureAuthorized();

  const { data } = await b2.getDownloadAuthorization({
    bucketId: process.env.B2_BUCKET_ID,
    fileNamePrefix: key,
    validDurationInSeconds: expiresIn
  });

  return `${b2.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${key}?Authorization=${data.authorizationToken}`;
}

/**
 * Delete a file from B2
 */
async function deleteFromB2(key, fileId) {
  try {
    await ensureAuthorized();
    if (fileId) {
      await b2.deleteFileVersion({ fileId, fileName: key });
    } else {
      // Find file versions and delete
      const { data } = await b2.listFileVersions({
        bucketId: process.env.B2_BUCKET_ID,
        startFileName: key,
        maxFileCount: 1
      });
      if (data.files && data.files.length > 0) {
        const f = data.files[0];
        await b2.deleteFileVersion({ fileId: f.fileId, fileName: f.fileName });
      }
    }
  } catch (e) {
    console.error('B2 delete error:', e.message);
  }
}

// File filters
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

// Multer with memory storage — files uploaded to B2 in controller
exports.uploadFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
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
