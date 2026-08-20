import { prisma } from "@/config/db";
import { storageService } from "@/services/storage.service";
import { UPLOAD_LIMITS } from "@/constants/config";
import { ValidationError } from "@/errors";
import { logger } from "@/utils/logger";
import type { AttachmentKind } from "@prisma/client";

/**
 * Chat attachment handling.
 *
 * Three rules hold for every upload here:
 *
 *  1. The type is decided by an allow-list, never by the filename. A
 *     client can claim any extension or MIME type it likes, so the
 *     declared type is checked against a fixed list and anything else is
 *     rejected outright.
 *  2. The stored path is generated server-side from a UUID. The original
 *     filename is kept only as a display label — it never touches the
 *     storage path, which closes off path traversal.
 *  3. Size limits are enforced per kind, both at the multer layer (so
 *     oversized bodies are cut off early) and here as a second check.
 */

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Maps a MIME type to the attachment kind, or rejects it. */
export function classifyAttachment(mimeType: string): AttachmentKind {
  const type = mimeType.toLowerCase().split(";")[0].trim();

  if (UPLOAD_LIMITS.ALLOWED_IMAGE_MIME_TYPES.includes(type)) return "IMAGE";
  if (UPLOAD_LIMITS.ALLOWED_VOICE_MIME_TYPES.includes(type)) return "VOICE";
  if (UPLOAD_LIMITS.ALLOWED_DOCUMENT_MIME_TYPES.includes(type)) return "DOCUMENT";

  throw new ValidationError(
    "That file type isn't supported. You can send images (JPEG, PNG, WebP), documents (PDF, Word, Excel, text) or voice notes."
  );
}

function sizeLimitFor(kind: AttachmentKind): number {
  if (kind === "IMAGE") return UPLOAD_LIMITS.CHAT_IMAGE_MAX_SIZE_BYTES;
  if (kind === "VOICE") return UPLOAD_LIMITS.CHAT_VOICE_MAX_SIZE_BYTES;
  return UPLOAD_LIMITS.CHAT_DOCUMENT_MAX_SIZE_BYTES;
}

/** Strips anything that isn't a plain filename, for display only. */
function safeDisplayName(name: string): string {
  return (
    name
      .replace(/[/\\]/g, "") // no path separators
      .replace(/\.{2,}/g, ".") // no traversal sequences
      .replace(/[^\w.\-() ]/g, "") // keep it boring
      .slice(0, 120) || "attachment"
  );
}

export const attachmentService = {
  /**
   * Validates and stores one chat attachment, returning the metadata the
   * message record needs. Nothing is written to the database here — the
   * caller attaches it to a message so an orphaned upload can't leave a
   * dangling row.
   */
  async upload(file: UploadedFile, opts: { durationSeconds?: number } = {}) {
    const kind = classifyAttachment(file.mimetype);
    const limit = sizeLimitFor(kind);

    if (file.size > limit) {
      const mb = Math.round(limit / (1024 * 1024));
      throw new ValidationError(`That file is too large. The limit for this type is ${mb}MB.`);
    }

    if (kind === "VOICE" && opts.durationSeconds !== undefined) {
      if (opts.durationSeconds > UPLOAD_LIMITS.VOICE_MAX_DURATION_SECONDS) {
        throw new ValidationError(
          `Voice notes are limited to ${UPLOAD_LIMITS.VOICE_MAX_DURATION_SECONDS / 60} minutes.`
        );
      }
    }

    // Storage layer picks Cloudinary or local disk; either way we get
    // back a URL the client can load.
    const url = await storageService.store(file.buffer, {
      folder: `chat/${kind.toLowerCase()}`,
      mimeType: file.mimetype,
      kind: kind === "IMAGE" ? "image" : kind === "VOICE" ? "video" : "raw",
    });

    logger.info("Chat attachment stored", { kind, sizeBytes: file.size, mimeType: file.mimetype });

    return {
      kind,
      url,
      filename: safeDisplayName(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      durationSeconds: kind === "VOICE" ? (opts.durationSeconds ?? null) : null,
    };
  },

  /** Persists attachment rows for a message. */
  createForMessage(
    messageId: string,
    attachments: {
      kind: AttachmentKind;
      url: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number | null;
      width?: number | null;
      height?: number | null;
    }[]
  ) {
    if (attachments.length === 0) return Promise.resolve({ count: 0 });
    return prisma.messageAttachment.createMany({
      data: attachments.map((a) => ({ ...a, messageId })),
    });
  },
};
