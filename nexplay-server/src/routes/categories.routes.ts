import { createPlaceholderModule } from "@/routes/placeholderModule";

/** Reserved for Phase 6, alongside Games. */
export const categoriesRoutes = createPlaceholderModule("Categories", [
  { method: "get", path: "/" },
  { method: "get", path: "/:slug" },
]);
