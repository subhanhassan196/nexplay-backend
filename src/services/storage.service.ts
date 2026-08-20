import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { cloudinary, isCloudinaryEnabled } from "@/config/cloudinary";
import { logger } from "@/utils/logger";

/**
 * Storage abstraction.
 *
 * Cloudinary is used when it's configured. When it isn't, files are
 * written to a local `uploads/` directory and served back over a static
 * route instead of failing outright — uploads shouldn't be dead until
 * someone signs up for a third-party account.
 *
 * The trade-off is worth stating: local disk on a platform like Render
 * is ephemeral, so files vanish when the instance restarts. That's fine
 * for development and acceptable for a soft launch, but Cloudinary (or
 * S3) should be configured before this is relied on. The code logs a
 * warning on every local write so this isn't silently forgotten.
 */
const LOCAL_DIR = path.resolve(process.cwd(), "uploads");

/** Public path prefix that `app.ts` serves the local directory from. */
export const LOCAL_UPLOAD_ROUTE = "/uploads";

export type StorageKind = "image" | "raw" | "video";

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
    "text/csv": "csv",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/x-m4a": "m4a",
  };
  return map[mimeType.toLowerCase().split(";")[0].trim()] ?? "bin";
}

async function saveLocally(buffer: Buffer, folder: string, mimeType: string): Promise<string> {
  const dir = path.join(LOCAL_DIR, folder);
  await fs.mkdir(dir, { recursive: true });

  // Filename is generated here — never derived from user input, which is
  // what keeps a crafted name from escaping the uploads directory.
  const name = `${randomUUID()}.${extensionFor(mimeType)}`;
  await fs.writeFile(path.join(dir, name), buffer);

  logger.warn("Stored upload on local disk — configure CLOUDINARY_* for durable storage", { folder });

  const base = (process.env.API_URL ?? "").replace(/\/+$/, "");
  return `${base}${LOCAL_UPLOAD_ROUTE}/${folder}/${name}`;
}

export const storageService = {
  /** True when uploads go to durable third-party storage. */
  get isDurable() {
    return isCloudinaryEnabled;
  },

  /**
   * Stores a file and returns its public URL. Callers don't need to know
   * which backend handled it.
   */
  async store(
    buffer: Buffer,
    opts: { folder: string; mimeType: string; kind: StorageKind }
  ): Promise<string> {
    if (!isCloudinaryEnabled) {
      return saveLocally(buffer, opts.folder, opts.mimeType);
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `nexplay/${opts.folder}`,
          public_id: randomUUID(),
          resource_type: opts.kind,
          overwrite: false,
          ...(opts.kind === "image"
            ? { transformation: [{ quality: "auto", fetch_format: "auto" }] }
            : {}),
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result.secure_url);
        }
      );
      stream.end(buffer);
    });
  },
};
