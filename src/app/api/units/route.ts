import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const units = await prisma.unit.findMany({
      select: {
        id: true,
        number: true,
        floor: true,
      },
      orderBy: { number: "asc" },
    });

    return NextResponse.json(units);
  } catch (error) {
    console.error("Failed to fetch units:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
