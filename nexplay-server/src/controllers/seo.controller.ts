import type { Request, Response } from "express";
import { seoService } from "@/services/seo.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";

export const seoController = {
  getForPath: asyncHandler(async (req: Request, res: Response) => {
    const path = typeof req.query.path === "string" ? req.query.path : "/";
    const meta = await seoService.getForPath(path);
    return ApiResponse.success(res, 200, "SEO meta.", { meta });
  }),

  list: asyncHandler(async (_req: Request, res: Response) => {
    const items = await seoService.list();
    return ApiResponse.success(res, 200, "SEO entries.", { items });
  }),

  upsert: asyncHandler(async (req: Request, res: Response) => {
    const meta = await seoService.upsert(req.params.path ? decodeURIComponent(req.params.path) : req.body.path, req.body);
    return ApiResponse.success(res, 200, "SEO saved.", { meta });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await seoService.remove(decodeURIComponent(req.params.path));
    return ApiResponse.success(res, 200, "SEO deleted.", {});
  }),

  /** Public XML sitemap. */
  sitemap: asyncHandler(async (_req: Request, res: Response) => {
    const paths = await seoService.sitemapPaths();
    const base = process.env.CLIENT_URL || "http://localhost:3000";
    const urls = paths
      .map(
        (p: { path: string; updatedAt: Date }) =>
          `  <url><loc>${base}${p.path}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
    res.header("Content-Type", "application/xml");
    return res.send(xml);
  }),
};
