import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        slug: { not: "legacy" },
      },
      orderBy: { priceMonthly: "asc" },
      select: {
        name: true,
        slug: true,
        priceMonthly: true,
        priceYearly: true,
        maxBuildings: true,
        maxUnitsPerBuilding: true,
        features: true,
        trialDays: true,
      },
    });

    // Convert Decimal fields to numbers for JSON serialization
    const serialized = plans.map((plan) => ({
      ...plan,
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: Number(plan.priceYearly),
    }));

    return NextResponse.json(serialized, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
