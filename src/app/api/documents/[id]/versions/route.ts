import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireRole(user.role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { versionNumber: true },
        },
      },
    });

    if (!document) {
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
        uploadedById: user.id,
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
      userId: user.id,
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
