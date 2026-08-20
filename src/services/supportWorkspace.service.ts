import { prisma } from "@/config/db";
import { NotFoundError, ValidationError } from "@/errors";
import { stripHtml } from "@/helpers/sanitize";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import type { FinancialRecordType, Prisma } from "@prisma/client";

/**
 * Agent-facing support tooling.
 *
 * Everything here is staff-only. The customer messenger endpoints never
 * touch these tables, so there's no path by which a note or a financial
 * record can leak into a customer response.
 */
export const supportWorkspaceService = {
  // ── Internal notes ──
  listNotes(conversationId: string) {
    return prisma.internalNote.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, username: true, role: true } } },
    });
  },

  async addNote(conversationId: string, authorId: string, content: string) {
    const clean = stripHtml(content).trim();
    if (!clean) throw new ValidationError("Note cannot be empty.");

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundError("Conversation");

    const note = await prisma.internalNote.create({
      data: { conversationId, authorId, content: clean },
      include: { author: { select: { id: true, username: true, role: true } } },
    });

    void activityService.record({
      actorId: authorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "InternalNote",
      entityId: note.id,
      metadata: { action: "created", conversationId },
    });

    return note;
  },

  async deleteNote(noteId: string, actorId: string) {
    const note = await prisma.internalNote.findUnique({ where: { id: noteId }, select: { authorId: true } });
    if (!note) throw new NotFoundError("Note");
    // Notes are the author's own working memory — only they remove them.
    if (note.authorId !== actorId) throw new ValidationError("You can only delete your own notes.");

    await prisma.internalNote.delete({ where: { id: noteId } });
    return { success: true };
  },

  // ── Customer tags ──
  listTags(includeInactive = false) {
    return prisma.customerTag.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { assignments: true } } },
    });
  },

  createTag(data: Prisma.CustomerTagCreateInput) {
    return prisma.customerTag.create({ data });
  },

  updateTag(id: string, data: Prisma.CustomerTagUpdateInput) {
    return prisma.customerTag.update({ where: { id }, data });
  },

  async deleteTag(id: string) {
    // Assignments cascade, so removing a tag cleanly unassigns it.
    await prisma.customerTag.delete({ where: { id } });
    return { success: true };
  },

  getUserTags(userId: string) {
    return prisma.customerTagAssignment.findMany({
      where: { userId },
      include: { tag: true },
      orderBy: { createdAt: "asc" },
    });
  },

  /** Toggles a tag on a customer, returning the resulting state. */
  async toggleUserTag(userId: string, tagId: string, actorId: string) {
    const existing = await prisma.customerTagAssignment.findUnique({
      where: { userId_tagId: { userId, tagId } },
    });

    if (existing) {
      await prisma.customerTagAssignment.delete({ where: { id: existing.id } });
      void activityService.record({
        actorId,
        action: ACTIVITY_ACTIONS.ADMIN_ACTION,
        entityType: "CustomerTag",
        entityId: tagId,
        metadata: { action: "unassigned", userId },
      });
      return { assigned: false };
    }

    await prisma.customerTagAssignment.create({ data: { userId, tagId, assignedById: actorId } });
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "CustomerTag",
      entityId: tagId,
      metadata: { action: "assigned", userId },
    });
    return { assigned: true };
  },

  /** Customers carrying a given tag — used to target a broadcast. */
  async usersWithTag(tagId: string) {
    const rows = await prisma.customerTagAssignment.findMany({
      where: { tagId },
      select: { userId: true },
    });
    return rows.map((r: { userId: string }) => r.userId);
  },

  // ── Financial records ──
  /**
   * Returns the ledger plus a derived summary. The net total is computed
   * from the rows every time rather than stored, so it can never drift
   * out of sync with the underlying records.
   */
  async getFinancials(userId: string) {
    const records = await prisma.customerFinancialRecord.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 200,
    });

    let depositMinor = 0;
    let cashoutMinor = 0;
    for (const r of records) {
      if (r.type === "DEPOSIT") depositMinor += r.amountMinor;
      else if (r.type === "CASHOUT") cashoutMinor += r.amountMinor;
      else depositMinor += r.amountMinor; // ADJUSTMENT can be negative
    }

    return {
      records,
      summary: {
        depositMinor,
        cashoutMinor,
        netMinor: depositMinor - cashoutMinor,
        currency: records[0]?.currency ?? "PKR",
      },
    };
  },

  async addFinancialRecord(
    userId: string,
    data: { type: FinancialRecordType; amountMinor: number; currency?: string; note?: string },
    actorId: string
  ) {
    if (!Number.isInteger(data.amountMinor)) {
      throw new ValidationError("Amount must be a whole number of minor units.");
    }
    // Deposits and cashouts are directional by type; a negative amount
    // there would silently invert the maths. Adjustments may be negative.
    if (data.type !== "ADJUSTMENT" && data.amountMinor <= 0) {
      throw new ValidationError("Amount must be greater than zero.");
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundError("Customer");

    const record = await prisma.customerFinancialRecord.create({
      data: {
        userId,
        type: data.type,
        amountMinor: data.amountMinor,
        currency: data.currency ?? "PKR",
        note: data.note ? stripHtml(data.note).trim() : undefined,
        recordedById: actorId,
      },
    });

    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "CustomerFinancialRecord",
      entityId: record.id,
      metadata: { action: "created", type: data.type, amountMinor: data.amountMinor, userId },
    });

    return record;
  },

  async deleteFinancialRecord(id: string, actorId: string) {
    const record = await prisma.customerFinancialRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundError("Record");

    await prisma.customerFinancialRecord.delete({ where: { id } });
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "CustomerFinancialRecord",
      entityId: id,
      metadata: { action: "deleted", type: record.type, amountMinor: record.amountMinor },
    });
    return { success: true };
  },

  // ── Message audit ──
  /** The original text of messages deleted for everyone in a thread. */
  listMessageAudits(conversationId: string) {
    return prisma.messageAudit.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },
};
