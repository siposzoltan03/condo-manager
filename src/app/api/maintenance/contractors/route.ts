import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "ADMIN")) {
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
