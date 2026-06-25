import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishToBuilding } from "@/lib/communication-bus";
import { rateLimitMutationOrRespond } from "@/lib/rate-limit";
import {
  recordPhysicalBoardPosting,
  queueEmailDeliveriesForAnnouncement,
} from "@/lib/announcement-delivery";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

interface AttachmentInput {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface PollInput {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  closesAt?: string | null;
}

interface PostBody {
  kind?: "POST" | "CHAT" | "POLL";
  title?: string | null;
  body?: string | null;
  parentId?: string | null;
  isUrgent?: boolean;
  attachments?: AttachmentInput[];
  poll?: PollInput | null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    const limited = await rateLimitMutationOrRespond(userId, "message:send", {
      limit: 60,
      windowSeconds: 60,
    });
    if (limited) return limited;
    const { channelId } = await context.params;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, buildingId: true, kind: true, isPrivate: true },
    });
    if (!channel || channel.buildingId !== buildingId) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.isPrivate) {
      const membership = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const data = (await request.json()) as PostBody;

    const isFeed =
      channel.kind === "ANNOUNCEMENT" ||
      channel.kind === "TOPIC" ||
      channel.kind === "BOARD";
    const requestedKind = data.kind;
    const kind =
      requestedKind ??
      (data.poll ? "POLL" : isFeed && !data.parentId ? "POST" : "CHAT");

    const trimmedBody = (data.body ?? "").trim();
    const trimmedTitle = (data.title ?? "").trim();

    // Validate poll payload before content emptiness check.
    if (kind === "POLL") {
      if (
        !data.poll ||
        !data.poll.question?.trim() ||
        !Array.isArray(data.poll.options)
      ) {
        return NextResponse.json(
          { error: "Poll requires question + options" },
          { status: 400 },
        );
      }
      const cleanedOptions = data.poll.options
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      if (cleanedOptions.length < 2 || cleanedOptions.length > 8) {
        return NextResponse.json(
          { error: "Poll needs 2–8 options" },
          { status: 400 },
        );
      }
    } else if (
      !trimmedBody &&
      !trimmedTitle &&
      !(data.attachments?.length ?? 0)
    ) {
      return NextResponse.json(
        { error: "Empty message" },
        { status: 400 },
      );
    }

    if (data.parentId) {
      const parent = await prisma.channelMessage.findUnique({
        where: { id: data.parentId },
        select: { channelId: true },
      });
      if (!parent || parent.channelId !== channelId) {
        return NextResponse.json(
          { error: "Invalid parentId" },
          { status: 400 },
        );
      }
    }

    const message = await prisma.channelMessage.create({
      data: {
        channelId,
        authorId: userId,
        kind,
        title: trimmedTitle || null,
        body: trimmedBody || null,
        parentId: data.parentId ?? null,
        isUrgent: data.isUrgent === true,
        attachments: data.attachments?.length
          ? {
              create: data.attachments.map((a) => ({
                fileName: a.fileName,
                fileUrl: a.fileUrl,
                fileSize: a.fileSize,
                mimeType: a.mimeType,
              })),
            }
          : undefined,
        poll:
          kind === "POLL" && data.poll
            ? {
                create: {
                  question: data.poll.question.trim(),
                  allowMultiple: data.poll.allowMultiple === true,
                  closesAt: data.poll.closesAt
                    ? new Date(data.poll.closesAt)
                    : null,
                  options: {
                    create: data.poll.options
                      .map((o) => o.trim())
                      .filter((o) => o.length > 0)
                      .map((label, position) => ({ label, position })),
                  },
                },
              }
            : undefined,
      },
      select: { id: true, createdAt: true },
    });

    // Phase 5 (Tht. § 43/A, § 33/A) — record proof of physical-board
    // posting for every ANNOUNCEMENT-channel POST. Email-equivalent
    // delivery rows (§ 33/A) are queued by the mailer worker that fans
    // the message out to recipients; that's out of scope here. The
    // PHYSICAL_BOARD row is the legally-mandatory minimum that proves
    // the building posted the notice on its mandatory hirdetőtábla.
    if (channel.kind === "ANNOUNCEMENT" && kind === "POST") {
      await recordPhysicalBoardPosting(prisma, message.id);
      // Tht. § 33/A — queue per-recipient EMAIL rows; the mailer worker
      // owns the actual SMTP send and flips status to DELIVERED/FAILED.
      await queueEmailDeliveriesForAnnouncement(prisma, {
        messageId: message.id,
        buildingId,
      });
    }

    // ── @-mention parsing ───────────────────────────────────────────────
    // Parse the body for @FirstName tokens and resolve to channel members.
    if (trimmedBody) {
      const tokens = Array.from(
        trimmedBody.matchAll(/@([\p{L}][\p{L}0-9_-]{1,40})/gu),
      ).map((m) => m[1].toLowerCase());
      if (tokens.length > 0) {
        const members = await prisma.channelMember.findMany({
          where: { channelId },
          include: { user: { select: { id: true, name: true } } },
        });
        const matched = new Set<string>();
        for (const token of tokens) {
          for (const m of members) {
            if (matched.has(m.userId)) continue;
            if (m.userId === userId) continue;
            const first = (m.user.name.split(" ")[0] ?? "").toLowerCase();
            if (first === token) matched.add(m.userId);
          }
        }
        if (matched.size > 0) {
          await prisma.messageMention.createMany({
            data: Array.from(matched).map((uid) => ({
              messageId: message.id,
              userId: uid,
            })),
            skipDuplicates: true,
          });
          await prisma.notification.createMany({
            data: Array.from(matched).map((uid) => ({
              userId: uid,
              type: "MENTION",
              title: trimmedTitle || "Megemlítettek egy üzenetben",
              body: trimmedBody.slice(0, 140),
              entityType: "ChannelMessage",
              entityId: message.id,
            })),
          });
        }
      }
    }

    // Bump channel.updatedAt so it surfaces in the sidebar.
    await prisma.channel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    // Author has implicitly read their own message — set their lastReadMessageId.
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: { lastReadMessageId: message.id },
      create: {
        channelId,
        userId,
        lastReadMessageId: message.id,
      },
    });

    publishToBuilding(buildingId, {
      type: "message:new",
      buildingId,
      channelId,
      messageId: message.id,
      authorId: userId,
      isUrgent: data.isUrgent === true,
    });

    return NextResponse.json({ id: message.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to send channel message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
