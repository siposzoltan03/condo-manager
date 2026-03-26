import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? "";

    // Find conversations where the current user is a participant
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: user.id },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = conversations
      .map((conv) => {
        const currentParticipant = conv.participants.find(
          (p) => p.userId === user.id
        );
        const otherParticipants = conv.participants.filter(
          (p) => p.userId !== user.id
        );
        const lastMessage = conv.messages[0] ?? null;

        // Calculate unread count
        const lastReadAt = currentParticipant?.lastReadAt ?? new Date(0);

        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          otherParticipants: otherParticipants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
          })),
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body:
                  lastMessage.body.length > 100
                    ? lastMessage.body.slice(0, 100) + "..."
                    : lastMessage.body,
                senderName: lastMessage.sender.name,
                senderId: lastMessage.sender.id,
                createdAt: lastMessage.createdAt,
              }
            : null,
          lastReadAt,
          updatedAt: conv.updatedAt,
          createdAt: conv.createdAt,
        };
      })
      .filter((conv) => {
        if (!search) return true;
        const lowerSearch = search.toLowerCase();
        const nameMatch = conv.otherParticipants.some((p) =>
          p.name.toLowerCase().includes(lowerSearch)
        );
        const convNameMatch = conv.name
          ?.toLowerCase()
          .includes(lowerSearch);
        return nameMatch || convNameMatch;
      });

    // Build a map of conversationId -> lastReadAt for efficient unread counting
    const conversationIds = result.map((c) => c.id);
    const lastReadMap = new Map(
      result.map((c) => [c.id, c.lastReadAt])
    );

    // Calculate the earliest lastReadAt to narrow down the message query
    const minLastReadAt = result.reduce(
      (min, c) => (c.lastReadAt < min ? c.lastReadAt : min),
      result[0]?.lastReadAt ?? new Date(0)
    );

    // Single query: fetch only messages newer than the earliest lastReadAt
    const unreadMessages = conversationIds.length > 0
      ? await prisma.message.findMany({
          where: {
            conversationId: { in: conversationIds },
            senderId: { not: user.id },
            createdAt: { gt: minLastReadAt },
          },
          select: {
            conversationId: true,
            createdAt: true,
          },
        })
      : [];

    // Aggregate unread counts in memory using per-conversation lastReadAt
    const unreadMap = new Map<string, number>();
    for (const msg of unreadMessages) {
      const lastReadAt = lastReadMap.get(msg.conversationId) ?? new Date(0);
      if (msg.createdAt > lastReadAt) {
        unreadMap.set(
          msg.conversationId,
          (unreadMap.get(msg.conversationId) ?? 0) + 1
        );
      }
    }

    const conversations_out = result.map(
      ({ lastReadAt, ...conv }) => ({
        ...conv,
        unreadCount: unreadMap.get(conv.id) ?? 0,
      })
    );

    return NextResponse.json({ conversations: conversations_out });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { participantIds, name } = body as {
      participantIds: string[];
      name?: string;
    };

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: "participantIds is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    // Ensure current user is included
    const allParticipantIds = Array.from(
      new Set([user.id, ...participantIds])
    );

    // Validate all participants exist
    const users = await prisma.user.findMany({
      where: { id: { in: allParticipantIds }, isActive: true },
      select: { id: true },
    });

    if (users.length !== allParticipantIds.length) {
      return NextResponse.json(
        { error: "One or more participants not found" },
        { status: 400 }
      );
    }

    // Determine conversation type
    const isDirect = allParticipantIds.length === 2;
    const isGroup = allParticipantIds.length >= 3;

    if (!isDirect && !isGroup) {
      return NextResponse.json(
        { error: "Need at least one other participant" },
        { status: 400 }
      );
    }

    if (isGroup && !name) {
      return NextResponse.json(
        { error: "Group conversations require a name" },
        { status: 400 }
      );
    }

    // For DIRECT, check if a conversation already exists between these two users
    if (isDirect) {
      const otherUserId = allParticipantIds.find((id) => id !== user.id)!;
      const existing = await prisma.conversation.findFirst({
        where: {
          type: "DIRECT",
          AND: [
            { participants: { some: { userId: user.id } } },
            { participants: { some: { userId: otherUserId } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (existing) {
        return NextResponse.json(existing);
      }
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        type: isDirect ? "DIRECT" : "GROUP",
        name: isGroup ? name : null,
        participants: {
          create: allParticipantIds.map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
