import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { searchParams } = request.nextUrl;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;
    const upcoming = searchParams.get("upcoming") === "true";

    const where: Record<string, unknown> = { buildingId };
    if (upcoming) {
      where.date = { gte: new Date() };
    }

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          rsvps: {
            select: { userId: true, status: true },
          },
          _count: { select: { rsvps: true, votes: true } },
        },
        orderBy: { date: upcoming ? "asc" : "desc" },
        skip,
        take: limit,
      }),
      prisma.meeting.count({ where }),
    ]);

    const result = meetings.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      date: m.date,
      time: m.time,
      location: m.location,
      agenda: m.agenda,
      hasMinutes: !!m.minutes,
      createdBy: m.createdBy,
      rsvpCounts: {
        attending: m.rsvps.filter((r) => r.status === "ATTENDING").length,
        notAttending: m.rsvps.filter((r) => r.status === "NOT_ATTENDING").length,
        proxy: m.rsvps.filter((r) => r.status === "PROXY").length,
        total: m.rsvps.length,
      },
      myRsvp: m.rsvps.find((r) => r.userId === userId)?.status ?? null,
      voteCount: m._count.votes,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      meetings: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch meetings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, date, time, location, agenda } = body;

    if (!title || !date || !time) {
      return NextResponse.json(
        { error: "Missing required fields: title, date, time" },
        { status: 400 }
      );
    }

    const meeting = await prisma.meeting.create({
      data: {
        title,
        description: description ?? null,
        date: new Date(date),
        time,
        location: location ?? null,
        agenda: agenda ?? [],
        createdById: userId,
        buildingId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      entityType: "Meeting",
      entityId: meeting.id,
      action: "CREATE",
      userId,
      newValue: { title, date, time, location },
    });

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error("Failed to create meeting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
