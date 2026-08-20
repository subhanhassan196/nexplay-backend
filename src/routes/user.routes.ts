import { Router } from "express";
import { userController } from "@/controllers/user.controller";
import { requireAuth } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { avatarUpload, bannerUpload } from "@/middlewares/upload.middleware";
import { updateProfileSchema, updateSettingsSchema } from "@/validators/user.validator";

const router = Router();

router.use(requireAuth); // every route below requires a logged-in user

router.get("/me/profile", userController.getMyProfile);
router.patch("/me/profile", validate(updateProfileSchema), userController.updateMyProfile);

router.get("/me/settings", userController.getMySettings);
router.patch("/me/settings", validate(updateSettingsSchema), userController.updateMySettings);

router.post("/me/avatar", avatarUpload, userController.uploadAvatar);
router.post("/me/banner", bannerUpload, userController.uploadBanner);

export { router as userRoutes };
