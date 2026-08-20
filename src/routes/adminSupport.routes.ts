import { Router } from "express";
import { adminSupportController } from "@/controllers/adminSupport.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { chatFileUpload } from "@/middlewares/upload.middleware";
import { messengerController } from "@/controllers/messenger.controller";
import {
  adminReplySchema,
  conversationStateSchema,
  assignConversationSchema,
  pinConversationSchema,
  updateTicketSchema,
  bulkStateSchema,
  bulkAssignSchema,
  quickLinkCreateSchema,
  quickLinkUpdateSchema,
  announcementCreateSchema,
  announcementUpdateSchema,
  settingUpdateSchema,
} from "@/validators/messenger.validator";

const router = Router();

// Agents upload through the same validated pipeline as customers.
router.post("/files", chatFileUpload, messengerController.uploadFile);

// Entire admin support surface requires a support role.
router.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));

// ── Conversations (live support inbox) ──
router.get("/agents", adminSupportController.listAgents);
router.get("/conversations", adminSupportController.listConversations);
router.post("/conversations/bulk/state", validate(bulkStateSchema), adminSupportController.bulkSetState);
router.post("/conversations/bulk/assign", validate(bulkAssignSchema), adminSupportController.bulkAssign);
router.get("/conversations/:id", adminSupportController.getConversation);
router.post("/conversations/:id/reply", validate(adminReplySchema), adminSupportController.reply);
router.patch("/conversations/:id/state", validate(conversationStateSchema), adminSupportController.setState);
router.patch("/conversations/:id/assign", validate(assignConversationSchema), adminSupportController.assign);
router.patch("/conversations/:id/pin", validate(pinConversationSchema), adminSupportController.setPinned);
router.patch("/conversations/:id/ticket", validate(updateTicketSchema), adminSupportController.updateTicket);
router.delete("/conversations/:id", adminSupportController.deleteConversation);

// ── Quick links ──
router.get("/quick-links", adminSupportController.listQuickLinks);
router.post("/quick-links", validate(quickLinkCreateSchema), adminSupportController.createQuickLink);
router.patch("/quick-links/:id", validate(quickLinkUpdateSchema), adminSupportController.updateQuickLink);
router.delete("/quick-links/:id", adminSupportController.deleteQuickLink);

// ── Announcements ──
router.get("/announcements", adminSupportController.listAnnouncements);
router.post("/announcements", validate(announcementCreateSchema), adminSupportController.createAnnouncement);
router.patch("/announcements/:id", validate(announcementUpdateSchema), adminSupportController.updateAnnouncement);
router.delete("/announcements/:id", adminSupportController.deleteAnnouncement);

// ── Settings ──
router.get("/settings", adminSupportController.getSettings);
router.patch("/settings", validate(settingUpdateSchema), adminSupportController.updateSetting);

export { router as adminSupportRoutes };
