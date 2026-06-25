import { NextRequest, NextResponse } from "next/server";
import { getUnitDetail } from "@/lib/units-dal";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const detail = await getUnitDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error("Failed to load unit detail:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
