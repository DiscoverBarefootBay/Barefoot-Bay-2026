type MessageLike = {
  id: number;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  inReplyTo?: number | null;
  in_reply_to?: number | null;
  [key: string]: unknown;
};

function parentId(message: MessageLike): number | null {
  const value = message.inReplyTo ?? message.in_reply_to;
  return value == null ? null : Number(value);
}

function timestamp(value: Date | string | null | undefined): number {
  if (value == null) return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function activityTime(message: MessageLike): number {
  const createdAt = timestamp(message.createdAt);
  const updatedAt = timestamp(message.updatedAt);
  return Math.max(Number.isFinite(createdAt) ? createdAt : 0, Number.isFinite(updatedAt) ? updatedAt : 0);
}

function chronologicalTime(message: MessageLike): number {
  const value = timestamp(message.createdAt);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Assemble a caller-scoped flat history. The input must contain only messages
 * visible to that caller; missing parents are deliberately treated as orphan
 * heads instead of being fetched to reveal their contents.
 */
export function assembleMessageHistory<T extends MessageLike>(visibleMessages: readonly T[]): Array<T & {
  threadRoot: true;
  displayRootId: number;
  orphanedReply: boolean;
  lastActivityAt: string;
  replies: Array<T & { threadRoot: false; displayRootId: number }>;
}> {
  const byId = new Map(visibleMessages.map(message => [message.id, message]));
  const rootsById = new Map<number, T>();
  const groupedReplies = new Map<number, Array<T & { threadRoot: false; displayRootId: number }>>();
  const activityByRoot = new Map<number, number>();

  const getDisplayRootId = (message: T): number => {
    let current = message;
    const path: T[] = [];
    const seen = new Map<number, number>();

    while (true) {
      const priorIndex = seen.get(current.id);
      if (priorIndex !== undefined) {
        // Malformed legacy cycles are represented deterministically instead of
        // recursing forever or dropping otherwise visible messages.
        return Math.min(...path.slice(priorIndex).map(item => item.id));
      }
      seen.set(current.id, path.length);
      path.push(current);

      const parent = parentId(current);
      const visibleParent = parent == null ? undefined : byId.get(parent);
      if (!visibleParent) return current.id;
      current = visibleParent;
    }
  };

  for (const message of visibleMessages) {
    const rootId = getDisplayRootId(message);
    const root = byId.get(rootId) ?? message;
    rootsById.set(root.id, root);
    const activity = activityTime(message);
    activityByRoot.set(root.id, Math.max(activityByRoot.get(root.id) ?? 0, activity));
    if (message.id !== root.id) {
      const reply = { ...message, threadRoot: false as const, displayRootId: root.id };
      const replies = groupedReplies.get(root.id) ?? [];
      replies.push(reply);
      groupedReplies.set(root.id, replies);
    }
  }

  return [...rootsById.values()]
    .map(root => {
      const replies = (groupedReplies.get(root.id) ?? []).sort((a, b) =>
        chronologicalTime(a) - chronologicalTime(b) || a.id - b.id
      );
      const rootActivity = activityByRoot.get(root.id) ?? activityTime(root);
      return {
        ...root,
        threadRoot: true as const,
        displayRootId: root.id,
        orphanedReply: parentId(root) !== null && !byId.has(parentId(root)!),
        lastActivityAt: new Date(rootActivity).toISOString(),
        replies,
      };
    })
    .sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime() || b.id - a.id
    );
}

/** Return caller-visible descendants in stable chronological order. */
export function getVisibleDescendants<T extends MessageLike>(visibleMessages: readonly T[], messageId: number): T[] {
  const byParent = new Map<number, T[]>();
  for (const message of visibleMessages) {
    const parent = parentId(message);
    if (parent == null) continue;
    const children = byParent.get(parent) ?? [];
    children.push(message);
    byParent.set(parent, children);
  }

  const descendants: T[] = [];
  const seen = new Set<number>([messageId]);
  const pending = [...(byParent.get(messageId) ?? [])];
  while (pending.length > 0) {
    const message = pending.shift()!;
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    descendants.push(message);
    pending.push(...(byParent.get(message.id) ?? []));
  }

  return descendants.sort((a, b) => chronologicalTime(a) - chronologicalTime(b) || a.id - b.id);
}