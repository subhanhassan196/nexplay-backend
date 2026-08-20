import multer from "multer";
import { UPLOAD_LIMITS } from "@/constants/config";
import { ValidationError } from "@/errors";

/**
 * Buffers the file in memory (no disk write) and hands it to
 * `upload.service.ts` for a streamed Cloudinary upload. Rejects
 * disallowed mime types before any bytes reach storage.
 */
function fileFilter(maxSize: number) {
  return (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (!UPLOAD_LIMITS.ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      return cb(new ValidationError(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP.`));
    }
    cb(null, true);
  };
}

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.AVATAR_MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD_LIMITS.AVATAR_MAX_SIZE_BYTES),
}).single("avatar");

export const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.BANNER_MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD_LIMITS.BANNER_MAX_SIZE_BYTES),
}).single("banner");

// Media library uploads — accepts a "file" field, banner-sized limit.
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.BANNER_MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD_LIMITS.BANNER_MAX_SIZE_BYTES),
}).single("file");

// Chat attachments — same strict MIME whitelist, banner-sized limit,
// single file per request under the "attachment" field.
export const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.BANNER_MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD_LIMITS.BANNER_MAX_SIZE_BYTES),
}).single("attachment");
