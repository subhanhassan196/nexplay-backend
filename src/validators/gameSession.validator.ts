import { z } from "zod";

export const startSessionSchema = z.object({
  body: z.object({
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const endSessionSchema = z.object({
  body: z.object({
    result: z.enum(["WIN", "LOSS", "DRAW"]).optional(),
    score: z.number().int().min(0).max(1_000_000_000),
    durationSeconds: z.number().int().min(0).max(60 * 60 * 12), // cap at 12h — sanity bound, not a real play session
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>["body"];
export type EndSessionInput = z.infer<typeof endSessionSchema>["body"];
