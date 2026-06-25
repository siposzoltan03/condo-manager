import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { Prisma, ComplaintStatus } from "@prisma/client";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";
import { rateLimitMutationOrRespond } from "@/lib/rate-limit";
import {
  listComplaintsPaginated,
  findActiveCategoryInBuilding,
  findUnitForRespondent,
  findLastComplaintTrackingNumber,
  createComplaintWithStatusEvent,
} from "@/lib/complaints-dal";
import { complaintCreated } from "@/lib/complaints/events";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit =
      isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
    const skip = (page - 1) * limit;

    if (status && !Object.values(ComplaintStatus).includes(status as ComplaintStatus)) {
      return NextResponse.json(
        { error: "Invalid status filter" },
        { status: 400 },
      );
    }

    const { complaints, total } = await listComplaintsPaginated({
      buildingId,
      viewerUserId: userId,
      isBoardPlus: hasMinimumRole(role, "BOARD_MEMBER"),
      search,
      status: status as ComplaintStatus | undefined,
      categoryId,
      skip,
      limit,
    });

    const result = complaints.map((c) => {
      const photosArr = Array.isArray(c.photos) ? c.photos : [];
      return {
        id: c.id,
        trackingNumber: c.trackingNumber,
        title: c.title,
        category: c.category,
        description: c.description,
        photosCount: photosArr.length,
        status: c.status,
        isPrivate: c.isPrivate,
        authorName: c.author.name,
        authorId: c.author.id,
        respondentUnit: c.respondentUnit,
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
      { status: 500 },
    );
  }
}

const MAX_TRACKING_RETRIES = 5;

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    const limited = await rateLimitMutationOrRespond(
      userId,
      "complaint:create",
      { limit: 10, windowSeconds: 60 },
    );
    if (limited) return limited;

    try {
      await requireNotFrozen(buildingId);
    } catch (e) {
      if (e instanceof FrozenBuildingError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const body = await request.json();
    const { categoryId, title, description, photos, isPrivate, respondentUnitId } =
      body;

    if (!categoryId || !description?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: categoryId, description" },
        { status: 400 },
      );
    }

    const category = await findActiveCategoryInBuilding(categoryId, buildingId);
    if (!category) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (respondentUnitId) {
      const unit = await findUnitForRespondent(respondentUnitId, buildingId);
      if (!unit) {
        return NextResponse.json(
          { error: "Invalid respondent unit" },
          { status: 400 },
        );
      }
    }

    let complaint:
      | Awaited<ReturnType<typeof createComplaintWithStatusEvent>>
      | null = null;

    for (let attempt = 0; attempt < MAX_TRACKING_RETRIES; attempt++) {
      const currentYear = new Date().getFullYear();
      const prefix = `CMP-${currentYear}-`;

      const lastComplaint = await findLastComplaintTrackingNumber(prefix);

      let nextNumber = 1;
      if (lastComplaint) {
        const lastNum = parseInt(
          lastComplaint.trackingNumber.split("-")[2],
          10,
        );
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }
      const trackingNumber = `${prefix}${String(nextNumber).padStart(3, "0")}`;

      try {
        complaint = await createComplaintWithStatusEvent({
          trackingNumber,
          title: title?.trim() || null,
          description,
          photos: Array.isArray(photos) ? photos : [],
          isPrivate: isPrivate ?? true,
          authorId: userId,
          buildingId,
          categoryId,
          respondentUnitId: respondentUnitId ?? null,
        });
        break;
      } catch (err: unknown) {
        const isPrismaUniqueError =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (isPrismaUniqueError && attempt < MAX_TRACKING_RETRIES - 1) {
          continue;
        }
        throw err;
      }
    }

    if (!complaint) {
      return NextResponse.json(
        { error: "Failed to generate unique tracking number" },
        { status: 500 },
      );
    }

    await complaintCreated({
      complaintId: complaint.id,
      trackingNumber: complaint.trackingNumber,
      authorUserId: userId,
      buildingId,
      categoryId,
      title: title ?? null,
      description,
      isPrivate: isPrivate ?? true,
      respondentUnitId: respondentUnitId ?? null,
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
