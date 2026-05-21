import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { getResidentPermissions } from "@/lib/residents-dal";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { role } = await requireBuildingContext();
    if (!hasMinimumRole(role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    const data = await getResidentPermissions(id);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load resident permissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
