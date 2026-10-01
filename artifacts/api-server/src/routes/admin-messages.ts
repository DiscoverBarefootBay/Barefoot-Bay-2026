import { count, desc, eq, inArray } from "drizzle-orm";
import { messages, messageAttachments, messageRecipients, users } from "@workspace/db";
import { db } from "../db";
import { requireAuth, requireAdmin } from "../auth";
import { assertMessageDeletable } from "../dmca/legal-hold";
import {
  buildAdminMessageDetails,
  createAdminMessagesRouter,
  deleteAdminMessageSafely,
} from "./admin-messages-router";

const adminMessagesService = {
  async list() {
    const [allMessages, countResult] = await Promise.all([
      db
        .select({
          id: messages.id,
          subject: messages.subject,
          content: messages.content,
          senderId: messages.senderId,
          messageType: messages.messageType,
          inReplyTo: messages.inReplyTo,
          deletedAt: messages.deletedAt,
          deletedBySender: messages.deletedBySender,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          senderUsername: users.username,
          senderFullName: users.fullName,
          senderEmail: users.email,
          senderRole: users.role,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .orderBy(desc(messages.createdAt))
        .limit(1000),
      db.select({ total: count() }).from(messages),
    ]);

    const messageIds = allMessages.map((message) => message.id);
    const [recipients, attachments] = messageIds.length > 0
      ? await Promise.all([
          db
            .select({
              messageId: messageRecipients.messageId,
              recipientId: messageRecipients.recipientId,
              readAt: messageRecipients.readAt,
              status: messageRecipients.status,
              recipientUsername: users.username,
              recipientFullName: users.fullName,
              recipientEmail: users.email,
              recipientRole: users.role,
            })
            .from(messageRecipients)
            .leftJoin(users, eq(messageRecipients.recipientId, users.id))
            .where(inArray(messageRecipients.messageId, messageIds)),
          db
            .select()
            .from(messageAttachments)
            .where(inArray(messageAttachments.messageId, messageIds)),
        ])
      : [[], []];

    return {
      messages: buildAdminMessageDetails(allMessages, recipients, attachments),
      total: Number(countResult[0]?.total ?? 0),
    };
  },

  async delete(messageId: number) {
    return db.transaction(async (tx) => deleteAdminMessageSafely(messageId, {
      async exists(id) {
        const rows = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.id, id))
          .limit(1);
        return rows.length > 0;
      },
      assertDeletable: (id) => assertMessageDeletable(id, tx),
      async deleteAttachments(id) {
        await tx.delete(messageAttachments).where(eq(messageAttachments.messageId, id));
      },
      async deleteRecipients(id) {
        await tx.delete(messageRecipients).where(eq(messageRecipients.messageId, id));
      },
      async deleteMessage(id) {
        const deleted = await tx.delete(messages).where(eq(messages.id, id)).returning({ id: messages.id });
        return deleted.length > 0;
      },
    }));
  },
};

export default createAdminMessagesRouter(adminMessagesService, { requireAuth, requireAdmin });