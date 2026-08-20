import type { Request, Response } from "express";
import { messengerService } from "@/services/messenger.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { listQuerySchema } from "@/utils/apiFeatures";
import { mediaService } from "@/services/media.service";
import { attachmentService } from "@/services/attachment.service";
import { accountSecurityService } from "@/services/accountSecurity.service";
import { ValidationError } from "@/errors";

export const messengerController = {
  /**
   * Claims a conversation via an agent's public support link, so a
   * customer arriving through that link lands in that agent's queue.
   */
  claimAgentLink: asyncHandler(async (req: Request, res: Response) => {
    const result = await accountSecurityService.claimViaLink(req.params.slug, req.user!.id);
    return ApiResponse.success(res, 200, "Connected to agent.", result);
  }),

  bootstrap: asyncHandler(async (_req: Request, res: Response) => {
    const data = await messengerService.getBootstrap();
    return ApiResponse.success(res, 200, "Messenger ready.", data);
  }),

  myConversation: asyncHandler(async (req: Request, res: Response) => {
    const data = await messengerService.getMyConversation(req.user!.id);
    return ApiResponse.success(res, 200, "Conversation retrieved.", data);
  }),

  myMessages: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const data = await messengerService.getMyMessages(req.user!.id, query);
    return ApiResponse.success(res, 200, "Messages retrieved.", data);
  }),

  // Uploads a chat image and returns its URL — the client then includes
  // that URL in attachmentUrls when sending the message.
  /**
   * Uploads a chat file (image, document or voice note) and returns its
   * metadata. The client then includes that metadata when sending the
   * message, so an abandoned upload never creates a message row.
   */
  uploadFile: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new ValidationError("No file uploaded.");
    const duration = req.body.durationSeconds ? Number(req.body.durationSeconds) : undefined;
    const attachment = await attachmentService.upload(req.file, { durationSeconds: duration });
    return ApiResponse.success(res, 201, "File uploaded.", { attachment });
  }),

  uploadAttachment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new ValidationError("No file uploaded.");
    const asset = await mediaService.upload(req.file.buffer, {
      filename: req.file.originalname,
      folder: "chat",
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedById: req.user!.id,
    });
    return ApiResponse.success(res, 201, "Attachment uploaded.", { url: asset.url, asset });
  }),

  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const { content, attachmentUrls, replyToId, gameContext, attachments } = req.body;
    const message = await messengerService.sendMessage(
      req.user!.id,
      content,
      attachmentUrls,
      replyToId,
      gameContext,
      attachments
    );
    return ApiResponse.success(res, 201, "Message sent.", { message });
  }),

  editMessage: asyncHandler(async (req: Request, res: Response) => {
    const message = await messengerService.editMyMessage(req.user!.id, req.params.messageId, req.body.content);
    return ApiResponse.success(res, 200, "Message updated.", { message });
  }),

  deleteMessage: asyncHandler(async (req: Request, res: Response) => {
    const message = await messengerService.deleteMyMessage(req.user!.id, req.params.messageId);
    return ApiResponse.success(res, 200, "Message deleted.", { message });
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const data = await messengerService.markRead(req.user!.id);
    return ApiResponse.success(res, 200, "Marked as read.", data);
  }),

  react: asyncHandler(async (req: Request, res: Response) => {
    const { emoji, add } = req.body;
    const message = await messengerService.toggleReaction(req.user!.id, req.params.messageId, emoji, add);
    return ApiResponse.success(res, 200, "Reaction updated.", { message });
  }),
};
