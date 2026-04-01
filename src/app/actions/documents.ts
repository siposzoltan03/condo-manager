"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { requireNotFrozen } from "@/lib/frozen-check";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { DocumentVisibility } from "@prisma/client";

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface CreateDocumentInput {
  title: string;
  description?: string;
  categoryId: string;
  visibility: string;
  tags?: string[];
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export async function createDocument(input: CreateDocumentInput): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "BOARD_MEMBER");
    await requireNotFrozen(buildingId);

    const { title, description, categoryId, visibility, tags, fileName, fileUrl, fileSize, mimeType } = input;

    if (!title || !categoryId || !visibility || !fileName || !fileUrl) {
      return { error: "Missing required fields" };
    }

    if (!Object.values(DocumentVisibility).includes(visibility as DocumentVisibility)) {
      return { error: "Invalid visibility" };
    }

    // Verify category exists and belongs to building
    const category = await prisma.documentCategory.findUnique({
      where: { id: categoryId },
      select: { buildingId: true },
    });
    if (!category || category.buildingId !== buildingId) {
      return { error: "Category not found" };
    }

    const document = await prisma.document.create({
      data: {
        title,
        description: description || null,
        category: { connect: { id: categoryId } },
        visibility: visibility as DocumentVisibility,
        tags: Array.isArray(tags) ? tags : [],
        uploadedBy: { connect: { id: userId } },
        versions: {
          create: {
            versionNumber: 1,
            fileName,
            fileUrl,
            fileSize,
            mimeType,
            uploadedBy: { connect: { id: userId } },
          },
        },
      },
    });

    await createAuditLog({
      entityType: "Document",
      entityId: document.id,
      action: "CREATE",
      userId,
      newValue: { title, categoryId, visibility, fileName },
    });

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    console.error("Failed to create document:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
