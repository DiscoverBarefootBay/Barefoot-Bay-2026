import { Router, type RequestHandler } from "express";

export interface AdminMessageListRow {
  id: number;
  senderId: number;
  senderRole: string | null;
  senderUsername?: string | null;
  senderFullName?: string | null;
  senderEmail?: string | null;
}

export interface AdminMessageRecipientRow {
  messageId: number;
  recipientId: number;
  readAt: Date | null;
  status: string | null;
  recipientUsername: string | null;
  recipientFullName: string | null;
  recipientEmail: string | null;
  recipientRole: string | null;
}

export interface AdminMessageAttachmentRow {
  messageId: number;
}

export function buildAdminMessageDetails<
  TMessage extends AdminMessageListRow,
  TAttachment extends AdminMessageAttachmentRow,
>(
  messages: TMessage[],
  recipients: AdminMessageRecipientRow[],
  attachments: TAttachment[],
) {
  const recipientsByMessage = new Map<number, AdminMessageRecipientRow[]>();
  for (const recipient of recipients) {
    const group = recipientsByMessage.get(recipient.messageId) ?? [];
    group.push(recipient);
    recipientsByMessage.set(recipient.messageId, group);
  }

  const attachmentsByMessage = new Map<number, TAttachment[]>();
  for (const attachment of attachments) {
    const group = attachmentsByMessage.get(attachment.messageId) ?? [];
    group.push(attachment);
    attachmentsByMessage.set(attachment.messageId, group);
  }

  return messages.map((message) => {
    const actualRecipients = recipientsByMessage.get(message.id) ?? [];
    const messageRecipients = actualRecipients.length > 0
      ? actualRecipients.map((recipient) => ({
          id: recipient.recipientId,
          username: recipient.recipientUsername,
          fullName: recipient.recipientFullName,
          email: recipient.recipientEmail,
          role: recipient.recipientRole,
          readAt: recipient.readAt,
          status: recipient.status,
        }))
      : [{
          id: null,
          username: message.senderRole === "admin" ? "all-users" : "admin-group",
          fullName: message.senderRole === "admin" ? "All Users (Inferred)" : "All Administrators",
          email: null,
          role: message.senderRole === "admin" ? "inferred" : "admin",
          readAt: null,
          status: "inferred",
        }];

    return {
      ...message,
      sender: {
        id: message.senderId,
        username: message.senderUsername ?? null,
        fullName: message.senderFullName ?? null,
        email: message.senderEmail ?? null,
        role: message.senderRole ?? null,
      },
      recipients: messageRecipients,
      attachments: attachmentsByMessage.get(message.id) ?? [],
      hasInferredRecipients: actualRecipients.length === 0,
    };
  });
}

export interface AdminMessageDeleteStore {
  exists(messageId: number): Promise<boolean>;
  assertDeletable(messageId: number): Promise<void>;
  deleteAttachments(messageId: number): Promise<void>;
  deleteRecipients(messageId: number): Promise<void>;
  deleteMessage(messageId: number): Promise<boolean>;
}

export async function deleteAdminMessageSafely(
  messageId: number,
  store: AdminMessageDeleteStore,
): Promise<boolean> {
  if (!await store.exists(messageId)) return false;

  // A legal hold must be checked before any dependent rows are removed.
  await store.assertDeletable(messageId);
  await store.deleteAttachments(messageId);
  await store.deleteRecipients(messageId);
  return store.deleteMessage(messageId);
}

export interface AdminMessagesService {
  list(): Promise<{ messages: unknown[]; total: number }>;
  delete(messageId: number): Promise<boolean>;
}

export interface AdminMessagesMiddleware {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
}

export function createAdminMessagesRouter(
  service: AdminMessagesService,
  middleware: AdminMessagesMiddleware,
) {
  const router = Router();

  router.get("/", middleware.requireAuth, middleware.requireAdmin, async (_req, res): Promise<void> => {
    try {
      const result = await service.list();
      res.json({ success: true, data: result.messages, total: result.total });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch messages for admin review",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete("/:messageId", middleware.requireAuth, middleware.requireAdmin, async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
    if (!/^[1-9]\d*$/.test(rawId)) {
      res.status(400).json({ success: false, message: "Invalid message ID" });
      return;
    }

    try {
      const deleted = await service.delete(Number(rawId));
      if (!deleted) {
        res.status(404).json({ success: false, message: "Message not found" });
        return;
      }
      res.json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
      const holdError = error as Error & { code?: string; heldIds?: number[] };
      const held = error instanceof Error && holdError.code === "LEGAL_HOLD";
      res.status(held ? 423 : 500).json({
        success: false,
        message: held ? error.message : "Failed to delete message",
        ...(held
          ? { error: "legal_hold", heldIds: holdError.heldIds ?? [] }
          : { error: error instanceof Error ? error.message : String(error) }),
      });
    }
  });

  return router;
}