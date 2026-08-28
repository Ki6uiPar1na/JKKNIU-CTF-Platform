import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const enabled = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (enabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export const isCloudinaryEnabled = () => enabled;

async function uploadToCloudinary(filePath, folder, resourceType) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: resourceType,
    public_id: path.parse(filePath).name,
  });
  return result.secure_url;
}

async function deleteFromCloudinary(secureUrl) {
  try {
    const parsed = new URL(secureUrl);
    if (!parsed.hostname.endsWith('cloudinary.com')) return true;
    const uploadMarker = parsed.pathname.indexOf('/upload/');
    if (uploadMarker === -1) return true;
    const resourceType = parsed.pathname.includes('/raw/') ? 'raw' : 'image';
    let publicId = parsed.pathname.slice(uploadMarker + '/upload/'.length);
    publicId = publicId.replace(/^v\d+\//, '').replace(/\.\w+$/, '');
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result && result.result === 'ok';
  } catch {
    return false;
  }
}

// Stores a multer temp file: to Cloudinary when configured, else keeps local file.
export async function storeFile(reqFile, folder, resourceType = 'auto') {
  const localUrl = `/uploads/${folder}/${reqFile.filename}`;
  if (!enabled) return localUrl;
  try {
    const url = await uploadToCloudinary(reqFile.path, folder, resourceType);
    fs.unlink(reqFile.path, () => {});
    return url;
  } catch (err) {
    console.error(`Cloudinary upload failed (using local storage): ${err.message}`);
    return localUrl;
  }
}

// Removes a stored file. Accepts Cloudinary URLs or legacy /uploads/ paths.
export async function deleteStoredFile(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return false;
  if (fileUrl.startsWith('http')) return deleteFromCloudinary(fileUrl);
  if (fileUrl.startsWith('/uploads/challenges/') || fileUrl.startsWith('/uploads/banners/') || fileUrl.startsWith('/uploads/logos/')) {
    const filePath = path.join(__dirname, '..', 'uploads', fileUrl.split('/')[2], path.basename(fileUrl));
    fs.unlink(filePath, () => {});
    return true;
  }
  return false;
}