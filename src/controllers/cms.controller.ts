import type { Request, Response } from "express";
import { cmsService } from "@/services/cms.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import type { BannerPlacement } from "@prisma/client";

export const cmsController = {
  // ── Content (public read / admin write) ──
  getContent: asyncHandler(async (req: Request, res: Response) => {
    const content = await cmsService.content.get(req.params.key);
    return ApiResponse.success(res, 200, "Content.", { content });
  }),

  listContent: asyncHandler(async (_req: Request, res: Response) => {
    const items = await cmsService.content.list();
    return ApiResponse.success(res, 200, "Content list.", { items });
  }),

  setContent: asyncHandler(async (req: Request, res: Response) => {
    const content = await cmsService.content.set(req.params.key, req.body.value, req.user?.id);
    return ApiResponse.success(res, 200, "Content saved.", { content });
  }),

  deleteContent: asyncHandler(async (req: Request, res: Response) => {
    await cmsService.content.remove(req.params.key);
    return ApiResponse.success(res, 200, "Content deleted.", {});
  }),

  // ── Banners ──
  listBanners: asyncHandler(async (req: Request, res: Response) => {
    const placement = typeof req.query.placement === "string" ? (req.query.placement as BannerPlacement) : undefined;
    const activeOnly = req.query.activeOnly === "true";
    const banners = await cmsService.banners.list(placement, activeOnly);
    return ApiResponse.success(res, 200, "Banners.", { banners });
  }),

  createBanner: asyncHandler(async (req: Request, res: Response) => {
    const banner = await cmsService.banners.create(req.body);
    return ApiResponse.success(res, 201, "Banner created.", { banner });
  }),

  updateBanner: asyncHandler(async (req: Request, res: Response) => {
    const banner = await cmsService.banners.update(req.params.id, req.body);
    return ApiResponse.success(res, 200, "Banner updated.", { banner });
  }),

  deleteBanner: asyncHandler(async (req: Request, res: Response) => {
    await cmsService.banners.remove(req.params.id);
    return ApiResponse.success(res, 200, "Banner deleted.", {});
  }),

  // ── Legal pages ──
  getLegalPage: asyncHandler(async (req: Request, res: Response) => {
    const page = await cmsService.legal.get(req.params.slug);
    return ApiResponse.success(res, 200, "Page.", { page });
  }),

  listLegalPages: asyncHandler(async (req: Request, res: Response) => {
    const publishedOnly = req.query.publishedOnly === "true";
    const pages = await cmsService.legal.list(publishedOnly);
    return ApiResponse.success(res, 200, "Pages.", { pages });
  }),

  upsertLegalPage: asyncHandler(async (req: Request, res: Response) => {
    const page = await cmsService.legal.upsert(req.params.slug, req.body, req.user?.id);
    return ApiResponse.success(res, 200, "Page saved.", { page });
  }),

  deleteLegalPage: asyncHandler(async (req: Request, res: Response) => {
    await cmsService.legal.remove(req.params.slug);
    return ApiResponse.success(res, 200, "Page deleted.", {});
  }),

  // ── FAQ ──
  listFaq: asyncHandler(async (req: Request, res: Response) => {
    const publishedOnly = req.query.publishedOnly === "true";
    const faqs = await cmsService.faq.list(publishedOnly);
    return ApiResponse.success(res, 200, "FAQs.", { faqs });
  }),

  createFaq: asyncHandler(async (req: Request, res: Response) => {
    const faq = await cmsService.faq.create(req.body);
    return ApiResponse.success(res, 201, "FAQ created.", { faq });
  }),

  updateFaq: asyncHandler(async (req: Request, res: Response) => {
    const faq = await cmsService.faq.update(req.params.id, req.body);
    return ApiResponse.success(res, 200, "FAQ updated.", { faq });
  }),

  deleteFaq: asyncHandler(async (req: Request, res: Response) => {
    await cmsService.faq.remove(req.params.id);
    return ApiResponse.success(res, 200, "FAQ deleted.", {});
  }),
};
