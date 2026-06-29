import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Prisma, DocumentVisibility } from "@prisma/client";
import { documentCreated } from "@/lib/documents/events";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const visibility = searchParams.get("visibility") ?? undefined;
    const fileType = searchParams.get("type") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {};

    // Filter by category's building
    where.category = { buildingId };

    // Archive filter: show archived or non-archived (default: non-archived)
    const archived = searchParams.get("archived");
    where.isArchived = archived === "true" ? true : false;

    // Visibility filtering based on role
    const isAdmin = allows(ctx, "view.adminContext");
    const isBoardPlus = allows(ctx, "view.boardContext");

    if (!isAdmin && !isBoardPlus) {
      // Regular users can only see PUBLIC
      where.visibility = "PUBLIC";
    } else if (!isAdmin) {
      // Board members can see PUBLIC and BOARD_ONLY
      where.visibility = { in: ["PUBLIC", "BOARD_ONLY"] };
    }
    // Admins can see everything

    // Filter by explicit visibility param (within allowed range)
    if (visibility && ["PUBLIC", "BOARD_ONLY", "ADMIN_ONLY"].includes(visibility)) {
      const requestedVisibility = visibility as DocumentVisibility;
      if (requestedVisibility === "ADMIN_ONLY" && !isAdmin) {
        // Keep existing restriction
      } else if (requestedVisibility === "BOARD_ONLY" && !isBoardPlus) {
        // Keep existing restriction
      } else {
        where.visibility = requestedVisibility;
      }
    }

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Search in title
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by file type (mime type of latest version)
    // This is done post-query since it depends on versions
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true },
          },
          uploadedBy: {
            select: { id: true, name: true },
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: {
              id: true,
              versionNumber: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              uploadedBy: { select: { id: true, name: true } },
              uploadedAt: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    let result = documents.map((doc) => {
      const latestVersion = doc.versions[0] ?? null;
      return {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        categoryId: doc.categoryId,
        category: doc.category,
        visibility: doc.visibility,
        tags: doc.tags,
        uploadedBy: doc.uploadedBy,
        latestVersion,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    // Post-filter by file type if requested
    if (fileType) {
      const mimeMap: Record<string, string[]> = {
        PDF: ["application/pdf"],
        DOCX: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
        XLSX: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
      };
      const allowedMimes = mimeMap[fileType.toUpperCase()];
      if (allowedMimes) {
        result = result.filter(
          (doc) => doc.latestVersion && allowedMimes.includes(doc.latestVersion.mimeType)
        );
      }
    }

    return NextResponse.json({
      documents: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    if (!allows(ctx, "document.publish.public")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      visibility,
      tags,
      fileName,
      fileUrl,
      fileSize,
      mimeType,
      expiresAt,
      extractedText,
    } = body;

    if (!title || !categoryId || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: "Missing required fields: title, categoryId, fileName, fileUrl" },
        { status: 400 }
      );
    }

    if (visibility && !["PUBLIC", "BOARD_ONLY", "ADMIN_ONLY"].includes(visibility)) {
      return NextResponse.json(
        { error: "Invalid visibility value" },
        { status: 400 }
      );
    }

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
      }
      parsedExpiresAt = d;
    }

    // Verify category exists and belongs to this building
    const category = await prisma.documentCategory.findUnique({ where: { id: categoryId } });
    if (!category || category.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Create document with initial version
    const document = await prisma.document.create({
      data: {
        title,
        description: description ?? null,
        categoryId,
        visibility: visibility ?? "PUBLIC",
        tags: tags ?? [],
        expiresAt: parsedExpiresAt,
        uploadedById: userId,
        versions: {
          create: {
            versionNumber: 1,
            fileUrl,
            fileName,
            fileSize: fileSize ?? 0,
            mimeType: mimeType ?? "application/octet-stream",
            extractedText: extractedText ?? null,
            uploadedById: userId,
          },
        },
      },
      include: {
        category: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedBy: { select: { id: true, name: true } },
            uploadedAt: true,
          },
        },
      },
    });

    await documentCreated({
      documentId: document.id,
      createdByUserId: userId,
      buildingId,
      title,
      categoryId,
      visibility: visibility ?? "PUBLIC",
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Failed to create document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
