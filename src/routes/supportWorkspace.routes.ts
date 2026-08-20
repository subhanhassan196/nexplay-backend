import { Router } from "express";
import { supportWorkspaceController } from "@/controllers/supportWorkspace.controller";
import { requireAuth, requirePermission } from "@/middlewares/auth.middleware";
import { PERMISSIONS } from "@/constants/permissions";

const router = Router();

// Staff-only. Nothing here is ever exposed on a customer-facing route —
// internal notes and financial records must never reach the customer.
router.use(requireAuth);

// Internal notes — any agent who can read chat can keep notes.
router.get("/conversations/:conversationId/notes", requirePermission(PERMISSIONS.CHAT_READ), supportWorkspaceController.listNotes);
router.post("/conversations/:conversationId/notes", requirePermission(PERMISSIONS.CHAT_REPLY), supportWorkspaceController.addNote);
router.delete("/notes/:noteId", requirePermission(PERMISSIONS.CHAT_REPLY), supportWorkspaceController.deleteNote);

// Deleted-message audit — moderation capability, not plain chat access.
router.get("/conversations/:conversationId/audit", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.listMessageAudits);

// Tags
router.get("/tags", requirePermission(PERMISSIONS.CHAT_READ), supportWorkspaceController.listTags);
router.post("/tags", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.createTag);
router.patch("/tags/:id", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.updateTag);
router.delete("/tags/:id", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.deleteTag);

router.get("/customers/:userId/tags", requirePermission(PERMISSIONS.CHAT_READ), supportWorkspaceController.getUserTags);
router.post("/customers/:userId/tags", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.toggleUserTag);

// Financial records — deliberately gated behind user management, not
// plain chat access: this is customer money data, not conversation data.
router.get("/customers/:userId/financials", requirePermission(PERMISSIONS.USERS_READ), supportWorkspaceController.getFinancials);
router.post("/customers/:userId/financials", requirePermission(PERMISSIONS.USERS_UPDATE), supportWorkspaceController.addFinancialRecord);
router.delete("/financials/:id", requirePermission(PERMISSIONS.USERS_UPDATE), supportWorkspaceController.deleteFinancialRecord);

// Broadcasts — sending reaches every targeted customer at once, so it
// sits behind the same capability as other bulk chat management.
router.get("/broadcasts", requirePermission(PERMISSIONS.CHAT_READ), supportWorkspaceController.listBroadcasts);
router.post("/broadcasts/audience", requirePermission(PERMISSIONS.CHAT_READ), supportWorkspaceController.previewAudience);
router.post("/broadcasts", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.createBroadcast);
router.patch("/broadcasts/:id", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.updateBroadcast);
router.delete("/broadcasts/:id", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.deleteBroadcast);
router.post("/broadcasts/:id/send", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.sendBroadcast);

// Account security. Login history and overlap signals are customer
// records, so they sit behind user-read rather than chat access.
router.get("/customers/:userId/logins", requirePermission(PERMISSIONS.USERS_READ), supportWorkspaceController.loginHistory);
router.get("/customers/:userId/related", requirePermission(PERMISSIONS.USERS_READ), supportWorkspaceController.relatedAccounts);

// Agent links — every agent can mint their own; listing all of them is
// an admin view.
router.get("/my-link", requirePermission(PERMISSIONS.CHAT_REPLY), supportWorkspaceController.myAgentLink);
router.get("/agent-links", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.listAgentLinks);
router.patch("/agent-links/:agentId", requirePermission(PERMISSIONS.CHAT_MANAGE), supportWorkspaceController.setAgentLinkActive);

export { router as supportWorkspaceRoutes };
