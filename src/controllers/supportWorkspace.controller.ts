import type { Request, Response } from "express";
import { supportWorkspaceService } from "@/services/supportWorkspace.service";
import { broadcastService } from "@/services/broadcast.service";
import { accountSecurityService } from "@/services/accountSecurity.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import type { FinancialRecordType } from "@prisma/client";

export const supportWorkspaceController = {
  // ── Internal notes ──
  listNotes: asyncHandler(async (req: Request, res: Response) => {
    const notes = await supportWorkspaceService.listNotes(req.params.conversationId);
    return ApiResponse.success(res, 200, "Notes.", { notes });
  }),

  addNote: asyncHandler(async (req: Request, res: Response) => {
    const note = await supportWorkspaceService.addNote(req.params.conversationId, req.user!.id, req.body.content);
    return ApiResponse.success(res, 201, "Note added.", { note });
  }),

  deleteNote: asyncHandler(async (req: Request, res: Response) => {
    await supportWorkspaceService.deleteNote(req.params.noteId, req.user!.id);
    return ApiResponse.success(res, 200, "Note deleted.", {});
  }),

  // ── Tags ──
  listTags: asyncHandler(async (req: Request, res: Response) => {
    const tags = await supportWorkspaceService.listTags(req.query.includeInactive === "true");
    return ApiResponse.success(res, 200, "Tags.", { tags });
  }),

  createTag: asyncHandler(async (req: Request, res: Response) => {
    const tag = await supportWorkspaceService.createTag(req.body);
    return ApiResponse.success(res, 201, "Tag created.", { tag });
  }),

  updateTag: asyncHandler(async (req: Request, res: Response) => {
    const tag = await supportWorkspaceService.updateTag(req.params.id, req.body);
    return ApiResponse.success(res, 200, "Tag updated.", { tag });
  }),

  deleteTag: asyncHandler(async (req: Request, res: Response) => {
    await supportWorkspaceService.deleteTag(req.params.id);
    return ApiResponse.success(res, 200, "Tag deleted.", {});
  }),

  getUserTags: asyncHandler(async (req: Request, res: Response) => {
    const tags = await supportWorkspaceService.getUserTags(req.params.userId);
    return ApiResponse.success(res, 200, "Customer tags.", { tags });
  }),

  toggleUserTag: asyncHandler(async (req: Request, res: Response) => {
    const result = await supportWorkspaceService.toggleUserTag(req.params.userId, req.body.tagId, req.user!.id);
    return ApiResponse.success(res, 200, "Tag updated.", result);
  }),

  // ── Financial records ──
  getFinancials: asyncHandler(async (req: Request, res: Response) => {
    const data = await supportWorkspaceService.getFinancials(req.params.userId);
    return ApiResponse.success(res, 200, "Financial records.", data);
  }),

  addFinancialRecord: asyncHandler(async (req: Request, res: Response) => {
    const record = await supportWorkspaceService.addFinancialRecord(
      req.params.userId,
      {
        type: req.body.type as FinancialRecordType,
        amountMinor: Number(req.body.amountMinor),
        currency: req.body.currency,
        note: req.body.note,
      },
      req.user!.id
    );
    return ApiResponse.success(res, 201, "Record added.", { record });
  }),

  deleteFinancialRecord: asyncHandler(async (req: Request, res: Response) => {
    await supportWorkspaceService.deleteFinancialRecord(req.params.id, req.user!.id);
    return ApiResponse.success(res, 200, "Record deleted.", {});
  }),

  // ── Broadcasts ──
  listBroadcasts: asyncHandler(async (_req: Request, res: Response) => {
    const broadcasts = await broadcastService.list();
    return ApiResponse.success(res, 200, "Broadcasts.", { broadcasts });
  }),

  previewAudience: asyncHandler(async (req: Request, res: Response) => {
    const tagIds = Array.isArray(req.body.tagIds) ? (req.body.tagIds as string[]) : [];
    const data = await broadcastService.previewAudience(tagIds);
    return ApiResponse.success(res, 200, "Audience.", data);
  }),

  createBroadcast: asyncHandler(async (req: Request, res: Response) => {
    const broadcast = await broadcastService.create(req.body);
    return ApiResponse.success(res, 201, "Broadcast created.", { broadcast });
  }),

  updateBroadcast: asyncHandler(async (req: Request, res: Response) => {
    const broadcast = await broadcastService.update(req.params.id, req.body);
    return ApiResponse.success(res, 200, "Broadcast updated.", { broadcast });
  }),

  deleteBroadcast: asyncHandler(async (req: Request, res: Response) => {
    await broadcastService.remove(req.params.id);
    return ApiResponse.success(res, 200, "Broadcast deleted.", {});
  }),

  sendBroadcast: asyncHandler(async (req: Request, res: Response) => {
    const broadcast = await broadcastService.send(req.params.id, req.user!.id);
    return ApiResponse.success(res, 200, "Broadcast sent.", { broadcast });
  }),

  // ── Account security ──
  loginHistory: asyncHandler(async (req: Request, res: Response) => {
    const history = await accountSecurityService.getMyLoginHistory(req.params.userId, 50);
    return ApiResponse.success(res, 200, "Login history.", { history });
  }),

  relatedAccounts: asyncHandler(async (req: Request, res: Response) => {
    const data = await accountSecurityService.findRelatedAccounts(req.params.userId);
    return ApiResponse.success(res, 200, "Related accounts.", data);
  }),

  // ── Agent links ──
  myAgentLink: asyncHandler(async (req: Request, res: Response) => {
    const link = await accountSecurityService.getOrCreateAgentLink(req.user!.id);
    return ApiResponse.success(res, 200, "Your support link.", { link });
  }),

  listAgentLinks: asyncHandler(async (_req: Request, res: Response) => {
    const links = await accountSecurityService.listAgentLinks();
    return ApiResponse.success(res, 200, "Agent links.", { links });
  }),

  setAgentLinkActive: asyncHandler(async (req: Request, res: Response) => {
    const link = await accountSecurityService.setAgentLinkActive(req.params.agentId, Boolean(req.body.isActive));
    return ApiResponse.success(res, 200, "Link updated.", { link });
  }),

  // ── Message audit ──
  listMessageAudits: asyncHandler(async (req: Request, res: Response) => {
    const audits = await supportWorkspaceService.listMessageAudits(req.params.conversationId);
    return ApiResponse.success(res, 200, "Deleted message audit.", { audits });
  }),
};
