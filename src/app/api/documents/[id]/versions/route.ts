import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        category: { select: { buildingId: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { versionNumber: true },
        },
      },
    });

    if (!document || document.category.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { fileUrl, fileName, fileSize, mimeType } = body;

    if (!fileUrl || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields: fileUrl, fileName" },
        { status: 400 }
      );
    }

    const nextVersion = (document.versions[0]?.versionNumber ?? 0) + 1;

    const version = await prisma.documentVersion.create({
      data: {
        documentId: id,
        versionNumber: nextVersion,
        fileUrl,
        fileName,
        fileSize: fileSize ?? 0,
        mimeType: mimeType ?? "application/octet-stream",
        extractedText: null,
        uploadedById: userId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    // Touch the document updatedAt
    await prisma.document.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    await createAuditLog({
      entityType: "DocumentVersion",
      entityId: version.id,
      action: "CREATE",
      userId,
      newValue: {
        documentId: id,
        versionNumber: nextVersion,
        fileName,
      },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Failed to create document version:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
