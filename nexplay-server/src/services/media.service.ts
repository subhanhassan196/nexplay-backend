import { mediaRepository } from "@/repositories/media.repository";
import { uploadService } from "@/services/upload.service";
import { buildPaginationMeta, type ListQuery } from "@/utils/apiFeatures";
import { NotFoundError } from "@/errors";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Media library service. Wraps the existing image upload service and
 * catalogs every asset in the media_assets table so the admin can
 * browse, search, rename (alt text), and delete from one library.
 */
export const mediaService = {
  async upload(
    buffer: Buffer,
    opts: { filename: string; folder?: string; mimeType?: string; sizeBytes?: number; uploadedById?: string }
  ) {
    const folder = opts.folder || "general";
    const publicId = `${folder}/${randomUUID()}`;
    // Reuse the existing Cloudinary-backed uploader (avatars/banners folders).
    const url = await uploadService.uploadImage(buffer, folder === "avatars" ? "avatars" : "banners", publicId);

    return mediaRepository.create({
      filename: opts.filename,
      url,
      folder,
      mimeType: opts.mimeType,
      sizeBytes: opts.sizeBytes,
      uploadedById: opts.uploadedById,
    });
  },

  async list(query: ListQuery, filters: { folder?: string; search?: string }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.MediaAssetWhereInput = {
      ...(filters.folder ? { folder: filters.folder } : {}),
      ...(filters.search
        ? {
            OR: [
              { filename: { contains: filters.search, mode: "insensitive" } },
              { altText: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, totalItems, folders] = await Promise.all([
      mediaRepository.list({ where, skip, take: query.limit }),
      mediaRepository.count(where),
      mediaRepository.folders(),
    ]);
    return { items, folders, pagination: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }) };
  },

  async update(id: string, data: { filename?: string; altText?: string; folder?: string }) {
    const existing = await mediaRepository.findById(id);
    if (!existing) throw new NotFoundError("Media asset");
    return mediaRepository.update(id, data);
  },

  async remove(id: string) {
    const existing = await mediaRepository.findById(id);
    if (!existing) throw new NotFoundError("Media asset");
    return mediaRepository.delete(id);
  },
};
