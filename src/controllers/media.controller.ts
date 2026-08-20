import type { Request, Response } from "express";
import { mediaService } from "@/services/media.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { listQuerySchema } from "@/utils/apiFeatures";
import { ValidationError } from "@/errors";

export const mediaController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new ValidationError("No file uploaded.");
    const asset = await mediaService.upload(req.file.buffer, {
      filename: req.file.originalname,
      folder: typeof req.body.folder === "string" ? req.body.folder : "general",
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedById: req.user?.id,
    });
    return ApiResponse.success(res, 201, "Uploaded.", { asset });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const folder = typeof req.query.folder === "string" ? req.query.folder : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const { items, folders, pagination } = await mediaService.list(query, { folder, search });
    return ApiResponse.success(res, 200, "Media library.", { items, folders, pagination });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const asset = await mediaService.update(req.params.id, req.body);
    return ApiResponse.success(res, 200, "Updated.", { asset });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await mediaService.remove(req.params.id);
    return ApiResponse.success(res, 200, "Deleted.", {});
  }),
};
