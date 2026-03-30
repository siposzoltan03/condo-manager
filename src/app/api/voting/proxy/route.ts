import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Gate voting feature based on active building
    try {
      const { buildingId } = await requireBuildingContext();
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      // If requireBuildingContext fails, continue (user might not have active building set)
    }

    const body = await request.json();
    const { granteeId, voteId, validUntil } = body;

    if (!granteeId) {
      return NextResponse.json(
        { error: "Missing required field: granteeId" },
        { status: 400 }
      );
    }

    if (granteeId === user.id) {
      return NextResponse.json(
        { error: "Cannot assign proxy to yourself" },
        { status: 400 }
      );
    }

    // Verify grantee exists
    const grantee = await prisma.user.findUnique({
      where: { id: granteeId },
      select: { id: true, name: true },
    });

    if (!grantee) {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }

    const proxy = await prisma.proxyAssignment.create({
      data: {
        grantorId: user.id,
        granteeId,
        voteId: voteId ?? null,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
    });

    await createAuditLog({
      entityType: "ProxyAssignment",
      entityId: proxy.id,
      action: "CREATE",
      userId: user.id,
      newValue: { granteeId, voteId: voteId ?? "general" },
    });

    return NextResponse.json(proxy, { status: 201 });
  } catch (error) {
    console.error("Failed to assign proxy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const proxyId = searchParams.get("id");

    if (!proxyId) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const proxy = await prisma.proxyAssignment.findUnique({
      where: { id: proxyId },
    });

    if (!proxy) {
      return NextResponse.json({ error: "Proxy not found" }, { status: 404 });
    }

    if (proxy.grantorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.proxyAssignment.delete({ where: { id: proxyId } });

    await createAuditLog({
      entityType: "ProxyAssignment",
      entityId: proxyId,
      action: "DELETE",
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke proxy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
