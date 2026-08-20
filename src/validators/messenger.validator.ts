import { z } from "zod";

// ── User-facing messenger ──
export const sendMessageSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1).max(4000),
    // Attachments are URLs returned by our own upload endpoint — relative
    // paths and absolute URLs both allowed, capped at 5 per message.
    attachmentUrls: z.array(z.string().max(500)).max(5).optional(),
    replyToId: z.string().uuid().optional(),
    // Which game the user was viewing when they sent this. Context only.
    gameContext: z
      .object({
        slug: z.string().trim().max(80),
        title: z.string().trim().max(120),
      })
      .optional(),
    // Metadata returned by the /files upload endpoint. The URL is only
    // accepted because it was minted by our own uploader moments earlier.
    attachments: z
      .array(
        z.object({
          kind: z.enum(["IMAGE", "DOCUMENT", "VOICE"]),
          url: z.string().max(1000),
          filename: z.string().max(200),
          mimeType: z.string().max(120),
          sizeBytes: z.number().int().nonnegative(),
          durationSeconds: z.number().int().nonnegative().nullable().optional(),
        })
      )
      .max(5)
      .optional(),
  }),
});

export const editMessageSchema = z.object({
  body: z.object({ content: z.string().trim().min(1).max(4000) }),
});

export const reactionSchema = z.object({
  body: z.object({
    emoji: z.string().trim().min(1).max(16),
    add: z.boolean(),
  }),
});

// ── Admin: reply + conversation management ──
export const adminReplySchema = z.object({
  body: z.object({
    content: z.string().trim().min(1).max(4000),
    attachmentUrls: z.array(z.string().max(500)).max(5).optional(),
    // Same structured metadata customers send — agents can reply with a
    // screenshot, a document or a voice note.
    attachments: z
      .array(
        z.object({
          kind: z.enum(["IMAGE", "DOCUMENT", "VOICE"]),
          url: z.string().max(1000),
          filename: z.string().max(200),
          mimeType: z.string().max(120),
          sizeBytes: z.number().int().nonnegative(),
          durationSeconds: z.number().int().nonnegative().nullable().optional(),
        })
      )
      .max(5)
      .optional(),
  }),
});

export const conversationStateSchema = z.object({
  body: z.object({ state: z.enum(["OPEN", "PENDING", "RESOLVED", "ARCHIVED"]) }),
});

export const assignConversationSchema = z.object({
  body: z.object({ agentId: z.string().uuid().nullable() }),
});

export const pinConversationSchema = z.object({
  body: z.object({ isPinned: z.boolean() }),
});

export const updateTicketSchema = z.object({
  body: z.object({
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    category: z.enum(["GENERAL", "ACCOUNT", "BILLING", "TECHNICAL", "GAME_ACCESS", "BUG_REPORT", "FEEDBACK"]).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    resolutionNotes: z.string().trim().max(2000).optional(),
  }),
});

export const bulkStateSchema = z.object({
  body: z.object({
    conversationIds: z.array(z.string().uuid()).min(1).max(100),
    state: z.enum(["OPEN", "PENDING", "RESOLVED", "ARCHIVED"]),
  }),
});

export const bulkAssignSchema = z.object({
  body: z.object({
    conversationIds: z.array(z.string().uuid()).min(1).max(100),
    agentId: z.string().uuid().nullable(),
  }),
});

// ── Admin: content management ──
const quickLinkCategory = z.enum([
  "FEATURED_GAME",
  "TRENDING_GAME",
  "REWARD",
  "TOURNAMENT",
  "CASINO",
  "POKER",
  "ROULETTE",
  "BLACKJACK",
  "SLOTS",
  "GENERAL",
]);

export const quickLinkCreateSchema = z.object({
  body: z.object({
    category: quickLinkCategory,
    label: z.string().trim().min(1).max(80),
    url: z.string().trim().min(1).max(500),
    iconName: z.string().trim().max(40).optional(),
    description: z.string().trim().max(200).optional(),
    order: z.number().int().min(0).optional(),
  }),
});

export const quickLinkUpdateSchema = z.object({
  body: z.object({
    category: quickLinkCategory.optional(),
    label: z.string().trim().min(1).max(80).optional(),
    url: z.string().trim().min(1).max(500).optional(),
    iconName: z.string().trim().max(40).optional(),
    description: z.string().trim().max(200).optional(),
    order: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const announcementCreateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2000),
    expiresAt: z.string().datetime().optional(),
  }),
});

export const announcementUpdateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(120).optional(),
    body: z.string().trim().min(1).max(2000).optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  }),
});

export const settingUpdateSchema = z.object({
  body: z.object({
    key: z.string().trim().min(1).max(60),
    value: z.string().max(4000),
  }),
});
