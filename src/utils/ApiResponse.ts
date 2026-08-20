import type { Response } from "express";
import type { PaginationMeta } from "@/utils/apiFeatures";

export class ApiResponse {
  static success<T>(res: Response, statusCode: number, message: string, data?: T) {
    return res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null,
    });
  }

  static paginated<T>(res: Response, message: string, items: T[], pagination: PaginationMeta) {
    return res.status(200).json({
      success: true,
      message,
      data: items,
      pagination,
    });
  }
}
