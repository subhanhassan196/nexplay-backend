import type { Request, Response } from "express";
import { adminSupportService } from "@/services/adminSupport.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { listQuerySchema } from "@/utils/apiFeatures";
import type { ConversationState } from "@prisma/client";

export const adminSupportController = {
  // ── Conversations ──
  listConversations: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const state = typeof req.query.state === "string" ? (req.query.state as ConversationState) : undefined;
    const assignedAgentId = typeof req.query.assignedAgentId === "string" ? req.query.assignedAgentId : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
    const assignment =
      req.query.assignment === "assigned" || req.query.assignment === "unassigned" ? req.query.assignment : undefined;
    const sort = ["newest", "oldest", "priority", "waiting"].includes(req.query.sort as string)
      ? (req.query.sort as "newest" | "oldest" | "priority" | "waiting")
      : undefined;

    const { items, pagination } = await adminSupportService.listConversations(query, {
      state,
      assignedAgentId,
      search,
      priority,
      assignment,
      sort,
    });
    return ApiResponse.paginated(res, "Conversations retrieved.", items, pagination);
  }),

  listAgents: asyncHandler(async (_req: Request, res: Response) => {
    const agents = await adminSupportService.listAgents();
    return ApiResponse.success(res, 200, "Agents retrieved.", { agents });
  }),

  bulkSetState: asyncHandler(async (req: Request, res: Response) => {
    const result = await adminSupportService.bulkSetState(req.body.conversationIds, req.body.state);
    return ApiResponse.success(res, 200, "Bulk update applied.", result);
  }),

  bulkAssign: asyncHandler(async (req: Request, res: Response) => {
    const result = await adminSupportService.bulkAssign(req.body.conversationIds, req.body.agentId);
    return ApiResponse.success(res, 200, "Bulk assignment applied.", result);
  }),

  getConversation: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const data = await adminSupportService.getConversation(req.params.id, query);
    return ApiResponse.success(res, 200, "Conversation retrieved.", data);
  }),

  reply: asyncHandler(async (req: Request, res: Response) => {
    const { content, attachmentUrls } = req.body;
    const message = await adminSupportService.reply(req.user!.id, req.params.id, content, attachmentUrls);
    return ApiResponse.success(res, 201, "Reply sent.", { message });
  }),

  setState: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await adminSupportService.setState(req.params.id, req.body.state);
    return ApiResponse.success(res, 200, "Conversation updated.", { conversation });
  }),

  assign: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await adminSupportService.assign(req.params.id, req.body.agentId);
    return ApiResponse.success(res, 200, "Conversation assigned.", { conversation });
  }),

  setPinned: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await adminSupportService.setPinned(req.params.id, req.body.isPinned);
    return ApiResponse.success(res, 200, "Conversation updated.", { conversation });
  }),

  updateTicket: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await adminSupportService.updateTicket(req.params.id, req.body);
    return ApiResponse.success(res, 200, "Ticket updated.", { conversation });
  }),

  deleteConversation: asyncHandler(async (req: Request, res: Response) => {
    await adminSupportService.deleteConversation(req.params.id);
    return ApiResponse.success(res, 200, "Conversation deleted.", {});
  }),

  // ── Quick links ──
  listQuickLinks: asyncHandler(async (_req: Request, res: Response) => {
    const quickLinks = await adminSupportService.quickLinks.list();
    return ApiResponse.success(res, 200, "Quick links retrieved.", { quickLinks });
  }),

  createQuickLink: asyncHandler(async (req: Request, res: Response) => {
    const quickLink = await adminSupportService.quickLinks.create(req.body);
    return ApiResponse.success(res, 201, "Quick link created.", { quickLink });
  }),

  updateQuickLink: asyncHandler(async (req: Request, res: Response) => {
    const quickLink = await adminSupportService.quickLinks.update(req.params.id, req.body);
    return ApiResponse.success(res, 200, "Quick link updated.", { quickLink });
  }),

  deleteQuickLink: asyncHandler(async (req: Request, res: Response) => {
    await adminSupportService.quickLinks.remove(req.params.id);
    return ApiResponse.success(res, 200, "Quick link deleted.", {});
  }),

  // ── Announcements ──
  listAnnouncements: asyncHandler(async (_req: Request, res: Response) => {
    const announcements = await adminSupportService.announcements.list();
    return ApiResponse.success(res, 200, "Announcements retrieved.", { announcements });
  }),

  createAnnouncement: asyncHandler(async (req: Request, res: Response) => {
    const payload = { ...req.body, expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined };
    const announcement = await adminSupportService.announcements.create(payload);
    return ApiResponse.success(res, 201, "Announcement created.", { announcement });
  }),

  updateAnnouncement: asyncHandler(async (req: Request, res: Response) => {
    const payload = {
      ...req.body,
      ...(req.body.expiresAt !== undefined ? { expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null } : {}),
    };
    const announcement = await adminSupportService.announcements.update(req.params.id, payload);
    return ApiResponse.success(res, 200, "Announcement updated.", { announcement });
  }),

  deleteAnnouncement: asyncHandler(async (req: Request, res: Response) => {
    await adminSupportService.announcements.remove(req.params.id);
    return ApiResponse.success(res, 200, "Announcement deleted.", {});
  }),

  // ── Settings ──
  getSettings: asyncHandler(async (_req: Request, res: Response) => {
    const settings = await adminSupportService.settings.getAll();
    return ApiResponse.success(res, 200, "Settings retrieved.", { settings });
  }),

  updateSetting: asyncHandler(async (req: Request, res: Response) => {
    const { key, value } = req.body;
    await adminSupportService.settings.update(key, value, req.user!.id);
    return ApiResponse.success(res, 200, "Setting updated.", { key, value });
  }),
};
