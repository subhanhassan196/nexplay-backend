import { cloudinary, isCloudinaryEnabled } from "@/config/cloudinary";
import { ApiError } from "@/utils/ApiError";

export type UploadFolder = "avatars" | "banners";

/**
 * Streams an in-memory image buffer (from Multer's memoryStorage) to
 * Cloudinary and returns the resulting secure URL. Applies sensible
 * transformations per folder (square crop for avatars, wide crop for
 * banners) so every stored image is already optimized — no separate
 * image-processing step needed.
 */
export const uploadService = {
  async uploadImage(buffer: Buffer, folder: UploadFolder, publicId: string): Promise<string> {
    if (!isCloudinaryEnabled) {
      throw new ApiError(
        503,
        "Image upload is not configured on this server yet. Set CLOUDINARY_* environment variables to enable it."
      );
    }

    const transformation =
      folder === "avatars"
        ? [{ width: 512, height: 512, crop: "fill", gravity: "face" }, { quality: "auto", fetch_format: "auto" }]
        : [{ width: 1600, height: 500, crop: "fill" }, { quality: "auto", fetch_format: "auto" }];

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `nexplay/${folder}`,
          public_id: publicId,
          overwrite: true,
          transformation,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
          resolve(result.secure_url);
        }
      );
      stream.end(buffer);
    });
  },
};
