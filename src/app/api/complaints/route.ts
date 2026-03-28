import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma, ComplaintCategory, ComplaintStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
    const skip = (page - 1) * limit;

    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const where: Prisma.ComplaintWhereInput = { buildingId };

    // Visibility: public complaints visible to all; private only to author + BOARD_MEMBER+
    if (!isBoardPlus) {
      where.OR = [
        { isPrivate: false },
        { authorId: userId },
      ];
    }

    if (search) {
      const searchFilter: Prisma.ComplaintWhereInput = {
        OR: [
          { description: { contains: search, mode: "insensitive" } },
          { trackingNumber: { contains: search, mode: "insensitive" } },
        ],
      };
      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchFilter];
        delete where.OR;
      } else {
        where.OR = searchFilter.OR;
      }
    }

    if (status) {
      if (!Object.values(ComplaintStatus).includes(status as ComplaintStatus)) {
        return NextResponse.json(
          { error: "Invalid status filter" },
          { status: 400 }
        );
      }
      where.status = status as ComplaintStatus;
    }

    if (category) {
      if (!Object.values(ComplaintCategory).includes(category as ComplaintCategory)) {
        return NextResponse.json(
          { error: "Invalid category filter" },
          { status: 400 }
        );
      }
      where.category = category as ComplaintCategory;
    }

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          author: {
            select: { id: true, name: true },
          },
          _count: {
            select: { notes: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.complaint.count({ where }),
    ]);

    const result = complaints.map((c) => {
      const photosArr = Array.isArray(c.photos) ? c.photos : [];
      return {
        id: c.id,
        trackingNumber: c.trackingNumber,
        category: c.category,
        description: c.description,
        photosCount: photosArr.length,
        status: c.status,
        isPrivate: c.isPrivate,
        authorName: c.author.name,
        authorId: c.author.id,
        notesCount: c._count.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json({
      complaints: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch complaints:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId } = await requireBuildingContext();

    const body = await request.json();
    const { category, description, photos, isPrivate } = body;

    if (!category || !description) {
      return NextResponse.json(
        { error: "Missing required fields: category, description" },
        { status: 400 }
      );
    }

    if (!Object.values(ComplaintCategory).includes(category as ComplaintCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Generate tracking number: CMP-YYYY-NNN
    // Retry loop to handle unique constraint race conditions (P2002)
    const MAX_RETRIES = 5;
    let complaint;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const currentYear = new Date().getFullYear();
      const prefix = `CMP-${currentYear}-`;

      const lastComplaint = await prisma.complaint.findFirst({
        where: {
          trackingNumber: { startsWith: prefix },
        },
        orderBy: { trackingNumber: "desc" },
        select: { trackingNumber: true },
      });

      let nextNumber = 1;
      if (lastComplaint) {
        const lastNum = parseInt(lastComplaint.trackingNumber.split("-")[2], 10);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }

      const trackingNumber = `${prefix}${String(nextNumber).padStart(3, "0")}`;

      try {
        complaint = await prisma.complaint.create({
          data: {
            trackingNumber,
            category: category as ComplaintCategory,
            description,
            photos: Array.isArray(photos) ? photos : [],
            isPrivate: isPrivate ?? false,
            author: { connect: { id: userId } },
            building: { connect: { id: buildingId } },
          },
          include: {
            author: {
              select: { id: true, name: true },
            },
          },
        });
        break; // Success — exit retry loop
      } catch (err: unknown) {
        const isPrismaUniqueError =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (isPrismaUniqueError && attempt < MAX_RETRIES - 1) {
          continue; // Retry with a fresh sequence number
        }
        throw err; // Non-retryable or exhausted retries
      }
    }

    if (!complaint) {
      return NextResponse.json(
        { error: "Failed to generate unique tracking number" },
        { status: 500 }
      );
    }

    await createAuditLog({
      entityType: "Complaint",
      entityId: complaint.id,
      action: "CREATE",
      userId,
      newValue: {
        trackingNumber: complaint.trackingNumber,
        category,
        description,
        isPrivate: isPrivate ?? false,
      },
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
