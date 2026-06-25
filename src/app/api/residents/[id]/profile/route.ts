import { NextRequest, NextResponse } from "next/server";
import { getResidentProfile } from "@/lib/residents-dal";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const profile = await getResidentProfile(id);
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Failed to load resident profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
