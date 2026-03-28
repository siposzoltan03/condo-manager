import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setActiveBuildingCookie } from "@/lib/building-context";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { buildingId } = body;

  if (!buildingId || typeof buildingId !== "string") {
    return NextResponse.json(
      { error: "buildingId is required" },
      { status: 400 }
    );
  }

  // Verify user belongs to this building
  const userBuilding = await prisma.userBuilding.findUnique({
    where: {
      userId_buildingId: {
        userId: user.id,
        buildingId,
      },
    },
    include: { building: { select: { id: true, name: true } } },
  });

  if (!userBuilding || !userBuilding.isActive) {
    return NextResponse.json(
      { error: "You do not have access to this building" },
      { status: 403 }
    );
  }

  // Set the cookie
  await setActiveBuildingCookie(buildingId);

  return NextResponse.json({
    buildingId: userBuilding.building.id,
    buildingName: userBuilding.building.name,
    role: userBuilding.role,
  });
}
