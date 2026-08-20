import { Router } from "express";
import { messengerController } from "@/controllers/messenger.controller";
import { requireAuth } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { sendMessageSchema, editMessageSchema, reactionSchema } from "@/validators/messenger.validator";
import { chatAttachmentUpload } from "@/middlewares/upload.middleware";

const router = Router();

// Bootstrap (welcome/quick-links/announcements) is available to any
// signed-in user opening the messenger.
router.use(requireAuth);

router.get("/bootstrap", messengerController.bootstrap);
router.get("/conversation", messengerController.myConversation);
router.get("/messages", messengerController.myMessages);
router.post("/attachments", chatAttachmentUpload, messengerController.uploadAttachment);
router.post("/messages", validate(sendMessageSchema), messengerController.sendMessage);
router.patch("/messages/:messageId", validate(editMessageSchema), messengerController.editMessage);
router.delete("/messages/:messageId", messengerController.deleteMessage);
router.post("/messages/:messageId/reactions", validate(reactionSchema), messengerController.react);
router.post("/read", messengerController.markRead);

export { router as messengerRoutes };
