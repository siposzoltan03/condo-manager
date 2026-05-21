import { NextRequest, NextResponse } from "next/server";
import { getVersionPanel } from "@/lib/documents-dal";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const panel = await getVersionPanel(id);
    if (!panel) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(panel);
  } catch (error) {
    console.error("Failed to load version panel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
