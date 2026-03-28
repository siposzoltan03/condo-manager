import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { role: activeRole } = await requireBuildingContext();

    if (!hasMinimumRole(activeRole, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contractors = await prisma.contractor.findMany({
      include: {
        ratings: { select: { rating: true } },
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = contractors.map((c) => {
      const avgRating =
        c.ratings.length > 0
          ? c.ratings.reduce((sum, r) => sum + r.rating, 0) / c.ratings.length
          : null;

      return {
        id: c.id,
        name: c.name,
        specialty: c.specialty,
        contactInfo: c.contactInfo,
        taxId: c.taxId,
        averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        totalJobs: c._count.tickets,
        createdAt: c.createdAt,
      };
    });

    return NextResponse.json({ contractors: result });
  } catch (error) {
    console.error("Failed to fetch contractors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { role: activeRole } = await requireBuildingContext();

    if (!hasMinimumRole(activeRole, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, specialty, contactInfo, taxId } = body;

    if (!name || !specialty || !contactInfo) {
      return NextResponse.json(
        { error: "Missing required fields: name, specialty, contactInfo" },
        { status: 400 }
      );
    }

    const contractor = await prisma.contractor.create({
      data: {
        name,
        specialty,
        contactInfo,
        taxId: taxId ?? null,
      },
    });

    return NextResponse.json(contractor, { status: 201 });
  } catch (error) {
    console.error("Failed to create contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
