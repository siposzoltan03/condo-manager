import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { getOnlineUserIds } from "@/lib/communication-bus";

// ─── Types ────────────────────────────────────────────────────────────────

export type ChannelKindKey =
  | "ANNOUNCEMENT"
  | "TOPIC"
  | "DM"
  | "GROUP_DM"
  | "BOARD"
  | "PARTNER";

export type MessageKindKey = "POST" | "CHAT" | "POLL" | "SYSTEM";

export interface ChannelListItem {
  id: string;
  kind: ChannelKindKey;
  /** Display name. For DMs, derived from the other participant. */
  name: string;
  /** Subtitle line shown under name. */
  meta: string | null;
  isOfficial: boolean;
  isPrivate: boolean;
  /** Last message preview ("Te: …" or "<author>: …"). */
  preview: string | null;
  previewAt: string | null;
  /** Unread message count for the current user. */
  unreadCount: number;
  /** Initials for the channel/avatar tile. */
  initials: string | null;
  /** Counterparty's display initials for DM avatars. */
  isOnline: boolean;
}

export interface CommunicationOverviewData {
  isBoardPlus: boolean;
  /** Channels grouped for the sidebar. */
  channelGroups: {
    key: "channels" | "dms";
    label: string;
    items: ChannelListItem[];
  }[];
  /** Total unread across everything. */
  totalUnread: number;
  /** Currently-selected channel id (driven by ?channel=) or first available. */
  selectedChannelId: string | null;
}

export interface PollOptionRow {
  id: string;
  label: string;
  position: number;
  voteCount: number;
  /** True if the current viewer voted for this option. */
  votedByMe: boolean;
}

export interface PollRow {
  id: string;
  question: string;
  allowMultiple: boolean;
  closesAt: string | null;
  closedAt: string | null;
  options: PollOptionRow[];
  totalVotes: number;
}

export interface ReactionRow {
  emoji: string;
  count: number;
  /** True if the current viewer reacted with this emoji. */
  mine: boolean;
}

export interface MentionRow {
  userId: string;
  name: string;
  firstName: string;
}

export interface ChannelMessageRow {
  id: string;
  channelId: string;
  kind: MessageKindKey;
  title: string | null;
  body: string | null;
  audience: { type: string } | null;
  isPinned: boolean;
  isUrgent: boolean;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorRole: string | null;
  /** True if author === current viewer (used for chat bubble alignment). */
  isMine: boolean;
  /** Has the current viewer read this message? */
  isRead: boolean;
  /** Read count for posts (non-zero only on POSTs). */
  readCount: number;
  /** Total channel members at message time (used for "X / Y read"). */
  totalMembers: number;
  createdAt: string;
  editedAt: string | null;
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }[];
  replyCount: number;
  poll: PollRow | null;
  reactions: ReactionRow[];
  mentions: MentionRow[];
}

export interface ChannelDetailData {
  channel: {
    id: string;
    kind: ChannelKindKey;
    name: string;
    description: string | null;
    isOfficial: boolean;
    isPrivate: boolean;
    memberCount: number;
  };
  /** Messages, oldest-first for chats, newest-first for feed. */
  messages: ChannelMessageRow[];
  /** Read-receipt grid total. */
  totalMembers: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(d: Date, now: Date): string {
  const ms = now.getTime() - d.getTime();
  if (ms < 60_000) return "most";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}p`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}ó`;
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}n`;
  return d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

// ─── Main loaders ─────────────────────────────────────────────────────────

export const getCommunicationOverview = cache(
  async (
    selectedId?: string | null,
  ): Promise<CommunicationOverviewData> => {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    const isBoardPlus = allows(ctx, "view.boardContext");

    // All channels in this building the user can see.
    const channels = await prisma.channel.findMany({
      where: {
        buildingId,
        // Hide PRIVATE channels the user isn't a member of (DMs etc).
        OR: [
          { isPrivate: false },
          { members: { some: { userId } } },
        ],
        // Hide BOARD channel from non-board users.
        ...(isBoardPlus ? {} : { kind: { not: "BOARD" } }),
      },
      include: {
        _count: { select: { members: true, messages: true } },
        members: {
          where: { userId },
          select: { lastReadMessageId: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            body: true,
            title: true,
            createdAt: true,
            authorId: true,
            author: { select: { name: true } },
            kind: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const now = new Date();

    // Pre-compute presence: collect every counterparty id across DM channels
    // in one round trip, then ask the bus which are online.
    const dmChannelIds = channels
      .filter((c) => c.kind === "DM" || c.kind === "GROUP_DM")
      .map((c) => c.id);
    const dmCounterparties = dmChannelIds.length
      ? await prisma.channelMember.findMany({
          where: {
            channelId: { in: dmChannelIds },
            userId: { not: userId },
          },
          select: { channelId: true, userId: true },
        })
      : [];
    const allCounterpartyIds = Array.from(
      new Set(dmCounterparties.map((m) => m.userId)),
    );
    const onlineSet = getOnlineUserIds(allCounterpartyIds);
    const dmCounterpartiesByChannel = new Map<string, string[]>();
    for (const m of dmCounterparties) {
      const arr = dmCounterpartiesByChannel.get(m.channelId) ?? [];
      arr.push(m.userId);
      dmCounterpartiesByChannel.set(m.channelId, arr);
    }

    // Determine unread counts per channel.
    const items: ChannelListItem[] = await Promise.all(
      channels.map(async (c) => {
        const lastReadId = c.members[0]?.lastReadMessageId ?? null;
        let unreadCount = 0;
        if (lastReadId) {
          const after = await prisma.channelMessage.findUnique({
            where: { id: lastReadId },
            select: { createdAt: true },
          });
          if (after) {
            unreadCount = await prisma.channelMessage.count({
              where: {
                channelId: c.id,
                createdAt: { gt: after.createdAt },
                authorId: { not: userId },
              },
            });
          }
        } else {
          unreadCount = await prisma.channelMessage.count({
            where: { channelId: c.id, authorId: { not: userId } },
          });
        }

        // For DMs, derive name from the other participant.
        let displayName = c.name ?? "—";
        let initials: string | null = null;
        if (c.kind === "DM" || c.kind === "GROUP_DM") {
          const others = await prisma.channelMember.findMany({
            where: { channelId: c.id, userId: { not: userId } },
            include: { user: { select: { name: true } } },
            take: 3,
          });
          if (others.length === 1) {
            displayName = others[0].user.name;
            initials = initialsOf(displayName);
          } else if (others.length > 1) {
            displayName =
              c.name ??
              others
                .map((o) => o.user.name.split(" ")[0])
                .slice(0, 3)
                .join(", ");
            initials = "GR";
          }
        } else if (c.kind === "ANNOUNCEMENT") {
          initials = "📢";
        }

        const last = c.messages[0];
        const previewBody = last?.title ?? last?.body ?? null;
        const previewAuthorPrefix = last
          ? last.authorId === userId
            ? "Te: "
            : `${last.author.name.split(" ")[0]}: `
          : "";
        const preview = last
          ? previewAuthorPrefix +
            (previewBody ? truncate(previewBody, 60) : "")
          : null;

        let meta: string | null = null;
        if (c.kind === "ANNOUNCEMENT") {
          meta = `${c._count.members} lakó · hivatalos csatorna`;
        } else if (c.kind === "TOPIC") {
          meta = c.description
            ? truncate(c.description, 50)
            : `${c._count.members} tag`;
        } else if (c.kind === "BOARD") {
          meta = `Zárt · ${c._count.members} tag`;
        }

        // For 1:1 DMs the dot reflects the single counterparty's presence.
        // For GROUP_DMs it lights up if *any* member is online.
        const counterparties = dmCounterpartiesByChannel.get(c.id) ?? [];
        const isOnline =
          (c.kind === "DM" || c.kind === "GROUP_DM") &&
          counterparties.some((uid) => onlineSet.has(uid));

        return {
          id: c.id,
          kind: c.kind as ChannelKindKey,
          name: displayName,
          meta,
          isOfficial: c.isOfficial,
          isPrivate: c.isPrivate,
          preview,
          previewAt: last ? relativeTime(last.createdAt, now) : null,
          unreadCount,
          initials,
          isOnline,
        };
      }),
    );

    const channelItems = items.filter(
      (i) =>
        i.kind === "ANNOUNCEMENT" ||
        i.kind === "TOPIC" ||
        i.kind === "BOARD" ||
        i.kind === "PARTNER",
    );
    const dmItems = items.filter((i) => i.kind === "DM" || i.kind === "GROUP_DM");

    // Selected channel: from query param if visible, otherwise the first
    // ANNOUNCEMENT, otherwise the first overall.
    const visibleIds = new Set(items.map((i) => i.id));
    const fallbackId =
      channelItems.find((c) => c.kind === "ANNOUNCEMENT")?.id ??
      items[0]?.id ??
      null;
    const finalSelected =
      selectedId && visibleIds.has(selectedId) ? selectedId : fallbackId;

    return {
      isBoardPlus,
      channelGroups: [
        { key: "channels", label: "Csatornák", items: channelItems },
        { key: "dms", label: "Közvetlen üzenetek", items: dmItems },
      ],
      totalUnread: items.reduce((s, i) => s + i.unreadCount, 0),
      selectedChannelId: finalSelected,
    };
  },
);

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const getChannelDetail = cache(
  async (channelId: string): Promise<ChannelDetailData | null> => {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    const isBoardPlus = allows(ctx, "view.boardContext");

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        _count: { select: { members: true } },
      },
    });
    if (!channel || channel.buildingId !== buildingId) return null;

    // Visibility: BOARD channels are board+ only; private channels require
    // membership.
    if (channel.kind === "BOARD" && !isBoardPlus) return null;
    if (channel.isPrivate) {
      const m = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!m) return null;
    }

    const totalMembers = channel._count.members;

    // Fetch messages — newest 50 for feed-style, all (cap 200) for chat.
    const messageRows = await prisma.channelMessage.findMany({
      where: { channelId, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            userBuildings: {
              where: { buildingId },
              select: { role: true },
              take: 1,
            },
          },
        },
        attachments: true,
        reads: { where: { userId }, select: { id: true } },
        _count: { select: { reads: true, replies: true } },
        poll: {
          include: {
            options: {
              orderBy: { position: "asc" },
              include: {
                _count: { select: { votes: true } },
                votes: { where: { userId }, select: { id: true } },
              },
            },
            _count: { select: { votes: true } },
          },
        },
        reactions: { select: { emoji: true, userId: true } },
        mentions: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    // Derive a friendly display name (matching the sidebar).
    let displayName = channel.name ?? "—";
    if (channel.kind === "DM" || channel.kind === "GROUP_DM") {
      const others = await prisma.channelMember.findMany({
        where: { channelId, userId: { not: userId } },
        include: { user: { select: { name: true } } },
        take: 3,
      });
      if (others.length === 1) {
        displayName = others[0].user.name;
      } else if (others.length > 1) {
        displayName =
          channel.name ??
          others
            .map((o) => o.user.name.split(" ")[0])
            .slice(0, 3)
            .join(", ");
      }
    } else if (channel.kind === "ANNOUNCEMENT" && !channel.name) {
      displayName = "Hirdetőtábla";
    }

    return {
      channel: {
        id: channel.id,
        kind: channel.kind as ChannelKindKey,
        name: displayName,
        description: channel.description,
        isOfficial: channel.isOfficial,
        isPrivate: channel.isPrivate,
        memberCount: totalMembers,
      },
      messages: messageRows.map((m) => {
        // Group reactions by emoji.
        const reactionMap = new Map<
          string,
          { count: number; mine: boolean }
        >();
        for (const r of m.reactions) {
          const cur = reactionMap.get(r.emoji) ?? { count: 0, mine: false };
          cur.count++;
          if (r.userId === userId) cur.mine = true;
          reactionMap.set(r.emoji, cur);
        }
        const reactions: ReactionRow[] = Array.from(reactionMap.entries()).map(
          ([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }),
        );

        const poll: PollRow | null = m.poll
          ? {
              id: m.poll.id,
              question: m.poll.question,
              allowMultiple: m.poll.allowMultiple,
              closesAt: m.poll.closesAt?.toISOString() ?? null,
              closedAt: m.poll.closedAt?.toISOString() ?? null,
              totalVotes: m.poll._count.votes,
              options: m.poll.options.map((o) => ({
                id: o.id,
                label: o.label,
                position: o.position,
                voteCount: o._count.votes,
                votedByMe: o.votes.length > 0,
              })),
            }
          : null;

        const mentions: MentionRow[] = m.mentions.map((mn) => ({
          userId: mn.user.id,
          name: mn.user.name,
          firstName: mn.user.name.split(" ")[0] ?? mn.user.name,
        }));

        return {
          id: m.id,
          channelId: m.channelId,
          kind: m.kind as MessageKindKey,
          title: m.title,
          body: m.body,
          audience: m.audience as { type: string } | null,
          isPinned: m.isPinned,
          isUrgent: m.isUrgent,
          parentId: m.parentId,
          authorId: m.authorId,
          authorName: m.author.name,
          authorInitials: initialsOf(m.author.name),
          authorRole: m.author.userBuildings[0]?.role ?? null,
          isMine: m.authorId === userId,
          isRead: m.reads.length > 0,
          readCount: m._count.reads,
          totalMembers,
          createdAt: m.createdAt.toISOString(),
          editedAt: m.editedAt?.toISOString() ?? null,
          attachments: m.attachments.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
          })),
          replyCount: m._count.replies,
          poll,
          reactions,
          mentions,
        };
      }),
      totalMembers,
    };
  },
);


/**
 * Count of active members in a building — used by the emergency-button
 * confirm prompt on the communication page.
 */
export async function countActiveBuildingMembers(
  buildingId: string,
): Promise<number> {
  return prisma.userBuilding.count({
    where: { buildingId, isActive: true },
  });
}
