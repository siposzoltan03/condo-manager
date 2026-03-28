import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  MaintenanceCategory,
  Urgency,
  TicketStatus,
} from "@prisma/client";
import { generateTrackingNumber } from "@/lib/maintenance/tickets";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const urgency = searchParams.get("urgency") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
    const skip = (page - 1) * limit;

    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const where: Prisma.MaintenanceTicketWhereInput = { buildingId };

    // Residents see only their own tickets
    if (!isBoardPlus) {
      where.reporterId = userId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { trackingNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      if (!Object.values(TicketStatus).includes(status as TicketStatus)) {
        return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
      }
      where.status = status as TicketStatus;
    }

    if (urgency) {
      if (!Object.values(Urgency).includes(urgency as Urgency)) {
        return NextResponse.json({ error: "Invalid urgency filter" }, { status: 400 });
      }
      where.urgency = urgency as Urgency;
    }

    if (category) {
      if (!Object.values(MaintenanceCategory).includes(category as MaintenanceCategory)) {
        return NextResponse.json({ error: "Invalid category filter" }, { status: 400 });
      }
      where.category = category as MaintenanceCategory;
    }

    const [tickets, total] = await Promise.all([
      prisma.maintenanceTicket.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true } },
          assignedContractor: { select: { id: true, name: true } },
          _count: { select: { comments: true, attachments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.maintenanceTicket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch maintenance tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId } = await requireBuildingContext();

    const body = await request.json();
    const { title, description, category, urgency, location } = body;

    if (!title || !description || !category || !urgency) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, category, urgency" },
        { status: 400 }
      );
    }

    if (!Object.values(MaintenanceCategory).includes(category as MaintenanceCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (!Object.values(Urgency).includes(urgency as Urgency)) {
      return NextResponse.json({ error: "Invalid urgency" }, { status: 400 });
    }

    // Generate tracking number with retry on collision
    const MAX_RETRIES = 5;
    let ticket;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const trackingNumber = await generateTrackingNumber();

      try {
        ticket = await prisma.maintenanceTicket.create({
          data: {
            trackingNumber,
            title,
            description,
            category: category as MaintenanceCategory,
            urgency: urgency as Urgency,
            location: location ?? null,
            reporter: { connect: { id: userId } },
            building: { connect: { id: buildingId } },
          },
          include: {
            reporter: { select: { id: true, name: true } },
          },
        });
        break;
      } catch (err: unknown) {
        const isPrismaUniqueError =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (isPrismaUniqueError && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw err;
      }
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "Failed to generate unique tracking number" },
        { status: 500 }
      );
    }

    await createAuditLog({
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      action: "CREATE",
      userId,
      newValue: {
        trackingNumber: ticket.trackingNumber,
        title,
        category,
        urgency,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Failed to create maintenance ticket:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
