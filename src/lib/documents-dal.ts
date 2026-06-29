import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";

// ─── Types ────────────────────────────────────────────────────────────────

export type DocVisibilityKey = "PUBLIC" | "BOARD_ONLY" | "ADMIN_ONLY";

export interface DocCategoryNode {
  id: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  /** Direct + descendant document count. */
  documentCount: number;
  children: DocCategoryNode[];
}

export interface DocVersionLite {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploaderName: string;
  uploaderInitials: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  description: string | null;
  visibility: DocVisibilityKey;
  isPinned: boolean;
  isArchived: boolean;
  expiresAt: string | null;
  /** Days from now to expiry; negative = past. Null = no expiry. */
  daysToExpiry: number | null;
  /** Latest version. */
  latestVersion: {
    versionNumber: number;
    fileName: string;
    fileSize: number;
    mimeType: string;
    /** Short type tag like "PDF", "DOC", "XLS", "IMG". */
    fileType: "pdf" | "doc" | "xls" | "img" | "other";
  } | null;
  uploaderName: string;
  uploaderInitials: string;
  updatedAt: string;
  viewCount: number;
  downloadCount: number;
  /** Days since last update for the "X napja" cell. */
  ageDays: number;
}

export interface DocumentsOverviewData {
  isBoardPlus: boolean;
  isAdminPlus: boolean;
  /** Top-level + nested categories with counts. */
  tree: DocCategoryNode[];
  /** Currently selected category id (driven by ?category=). null = All. */
  selectedCategoryId: string | null;
  /** Resolved category name + meta for the header. */
  selectedCategoryName: string | null;
  selectedCategoryIcon: string | null;
  /** Document count + size of the current category. */
  selectedDocumentCount: number;
  selectedTotalBytes: number;
  /** "X órája" / "X napja" relative to most-recent updatedAt in the category. */
  selectedLastUpdateLabel: string | null;
  /** First pinned document in current category — rendered as the dark hero. */
  pinnedDocument: DocumentRow | null;
  /** Documents in current category (excluding pinned). */
  documents: DocumentRow[];
  /** All categories total — for the "Összes" tree node count. */
  totalDocuments: number;
  /** Storage usage. */
  totalBytesUsed: number;
  storageQuotaBytes: number;
  /** Total expiring within 90 days. */
  expiringSoonCount: number;
  archivedCount: number;
}

export interface VersionPanelData {
  document: {
    id: string;
    title: string;
    isPinned: boolean;
    visibility: DocVisibilityKey;
    expiresAt: string | null;
  };
  versions: DocVersionLite[];
  /** Current version (most recent). */
  currentVersionNumber: number;
  /** Audit. */
  viewCount: number;
  downloadCount: number;
  lastAccessedAt: string | null;
  /** Number of board+ users who can access (for the "5 képviselő" line). */
  boardCount: number;
  /** "External" audience count — currently a placeholder of 0. */
  externalCount: number;
  isBoardPlus: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fileTypeOf(
  mime: string,
  fileName: string,
): "pdf" | "doc" | "xls" | "img" | "other" {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (mime.includes("word") || ext === "doc" || ext === "docx") return "doc";
  if (mime.includes("sheet") || ext === "xls" || ext === "xlsx") return "xls";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "img";
  return "other";
}

function ageDaysOf(d: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

function relativeAgeLabel(d: Date, now: Date): string {
  const ms = now.getTime() - d.getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "most";
  if (hours < 24) return `${hours} órája`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} napja`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} hónapja`;
  const years = Math.floor(months / 12);
  return `${years} éve`;
}

function buildCategoryTree(
  rows: { id: string; name: string; icon: string | null; parentId: string | null; sortOrder: number }[],
  countsById: Map<string, number>,
): DocCategoryNode[] {
  const byId = new Map<string, DocCategoryNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      icon: r.icon,
      parentId: r.parentId,
      documentCount: countsById.get(r.id) ?? 0,
      children: [],
    });
  }
  const roots: DocCategoryNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Roll up child counts to parents (for the tree-node total count).
  function rollUp(n: DocCategoryNode): number {
    const childTotal = n.children.reduce((s, c) => s + rollUp(c), 0);
    n.documentCount += childTotal;
    return n.documentCount;
  }
  for (const r of roots) rollUp(r);
  return roots;
}

const STORAGE_QUOTA_BYTES = 20 * 1024 * 1024 * 1024; // 20 GB demo quota
const PINNED_FALLBACK_LIMIT = 1;

// Visibility filter expressed as a Prisma where clause.
function visibilityWhereForRole(
  role: "OWNER" | "TENANT" | "BOARD_MEMBER" | "ADMIN" | "SUPER_ADMIN",
) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return undefined; // sees all
  if (role === "BOARD_MEMBER") {
    return { in: ["PUBLIC", "BOARD_ONLY"] as DocVisibilityKey[] };
  }
  return { equals: "PUBLIC" as DocVisibilityKey };
}

// ─── Main loader ──────────────────────────────────────────────────────────

interface OverviewParams {
  categoryId?: string | null;
  search?: string | null;
  /** Whether to search inside extractedText (full-text), not just title/description. */
  fullText?: boolean;
  visibilityFilter?: DocVisibilityKey | "ALL";
  /** Filter to docs with a fileType matching this key. */
  fileType?: "pdf" | "doc" | "xls" | "img" | "other" | "ALL";
}

export const getDocumentsOverview = cache(
  async (params: OverviewParams = {}): Promise<DocumentsOverviewData> => {
    const ctx = await requireBuildingContext();
    const { buildingId, role } = ctx;
    const isBoardPlus = allows(ctx, "view.boardContext");
    const isAdminPlus = allows(ctx, "view.adminContext");

    const visibilityClause = visibilityWhereForRole(
      role as "OWNER" | "TENANT" | "BOARD_MEMBER" | "ADMIN" | "SUPER_ADMIN",
    );

    // Fetch all categories for this building (for the tree).
    const categories = await prisma.documentCategory.findMany({
      where: { buildingId },
      select: {
        id: true,
        name: true,
        icon: true,
        parentId: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const categoryIds = categories.map((c) => c.id);

    // Per-category direct doc counts (visible to the current role).
    const counts = await prisma.document.groupBy({
      by: ["categoryId"],
      where: {
        category: { buildingId },
        isArchived: false,
        ...(visibilityClause ? { visibility: visibilityClause } : {}),
      },
      _count: { _all: true },
    });
    const countsById = new Map(
      counts.map((c) => [c.categoryId, c._count._all] as const),
    );
    const tree = buildCategoryTree(categories, countsById);

    const totalDocuments = counts.reduce((s, c) => s + c._count._all, 0);

    // Storage usage: sum of latest versions of all visible docs.
    const allDocs = await prisma.document.findMany({
      where: {
        category: { buildingId },
        isArchived: false,
        ...(visibilityClause ? { visibility: visibilityClause } : {}),
      },
      select: {
        id: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { fileSize: true },
        },
      },
    });
    const totalBytesUsed = allDocs.reduce(
      (sum, d) => sum + (d.versions[0]?.fileSize ?? 0),
      0,
    );

    // Expiring soon (next 90 days)
    const now = new Date();
    const ninetyDaysOut = new Date(now.getTime() + 90 * 86_400_000);
    const [expiringSoonCount, archivedCount] = await Promise.all([
      prisma.document.count({
        where: {
          category: { buildingId },
          isArchived: false,
          expiresAt: { gte: now, lte: ninetyDaysOut },
          ...(visibilityClause ? { visibility: visibilityClause } : {}),
        },
      }),
      prisma.document.count({
        where: {
          category: { buildingId },
          isArchived: true,
          ...(visibilityClause ? { visibility: visibilityClause } : {}),
        },
      }),
    ]);

    // ── Selected category (or All) ───────────────────────────────────────
    const selectedCategoryId = params.categoryId ?? null;
    const selectedNode = selectedCategoryId
      ? categories.find((c) => c.id === selectedCategoryId)
      : null;

    // Resolve descendant ids for the selected category (so a parent shows all subs).
    const descendantIds = new Set<string>();
    if (selectedCategoryId) {
      const queue = [selectedCategoryId];
      while (queue.length) {
        const id = queue.shift()!;
        descendantIds.add(id);
        for (const c of categories) if (c.parentId === id) queue.push(c.id);
      }
    }

    const docWhere = {
      category: { buildingId },
      isArchived: false,
      ...(visibilityClause ? { visibility: visibilityClause } : {}),
      ...(selectedCategoryId
        ? { categoryId: { in: Array.from(descendantIds) } }
        : {}),
      ...(params.visibilityFilter && params.visibilityFilter !== "ALL"
        ? { visibility: params.visibilityFilter }
        : {}),
      ...(params.search
        ? params.fullText
          ? {
              OR: [
                { title: { contains: params.search, mode: "insensitive" as const } },
                { description: { contains: params.search, mode: "insensitive" as const } },
                {
                  versions: {
                    some: {
                      extractedText: { contains: params.search, mode: "insensitive" as const },
                    },
                  },
                },
              ],
            }
          : {
              OR: [
                { title: { contains: params.search, mode: "insensitive" as const } },
                { description: { contains: params.search, mode: "insensitive" as const } },
              ],
            }
        : {}),
    };

    const docs = await prisma.document.findMany({
      where: docWhere,
      include: {
        uploadedBy: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            versionNumber: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
          },
        },
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });

    const allRows: DocumentRow[] = docs.map((d) => {
      const v = d.versions[0] ?? null;
      const updated = d.updatedAt;
      return {
        id: d.id,
        title: d.title,
        description: d.description,
        visibility: d.visibility as DocVisibilityKey,
        isPinned: d.isPinned,
        isArchived: d.isArchived,
        expiresAt: d.expiresAt?.toISOString() ?? null,
        daysToExpiry: d.expiresAt
          ? Math.floor((d.expiresAt.getTime() - now.getTime()) / 86_400_000)
          : null,
        latestVersion: v
          ? {
              versionNumber: v.versionNumber,
              fileName: v.fileName,
              fileSize: v.fileSize,
              mimeType: v.mimeType,
              fileType: fileTypeOf(v.mimeType, v.fileName),
            }
          : null,
        uploaderName: d.uploadedBy.name,
        uploaderInitials: initialsOf(d.uploadedBy.name),
        updatedAt: updated.toISOString(),
        viewCount: d.viewCount,
        downloadCount: d.downloadCount,
        ageDays: ageDaysOf(updated, now),
      };
    });

    // File-type filter (post-query since type derived from mime + name).
    const filteredRows = allRows.filter((r) => {
      if (params.fileType && params.fileType !== "ALL") {
        if (r.latestVersion?.fileType !== params.fileType) return false;
      }
      return true;
    });

    // Pinned hero: first pinned in selection.
    const pinnedDocument =
      filteredRows.find((r) => r.isPinned) ??
      (filteredRows.length > 0 && !selectedCategoryId
        ? filteredRows.slice(0, PINNED_FALLBACK_LIMIT)[0] ?? null
        : null);
    const documents = filteredRows.filter(
      (r) => r.id !== pinnedDocument?.id,
    );

    const selectedDocumentCount = filteredRows.length;
    const selectedTotalBytes = filteredRows.reduce(
      (s, r) => s + (r.latestVersion?.fileSize ?? 0),
      0,
    );
    const newestUpdate = filteredRows[0]
      ? new Date(filteredRows[0].updatedAt)
      : null;
    const selectedLastUpdateLabel = newestUpdate
      ? relativeAgeLabel(newestUpdate, now)
      : null;

    return {
      isBoardPlus,
      isAdminPlus,
      tree,
      selectedCategoryId,
      selectedCategoryName: selectedNode?.name ?? null,
      selectedCategoryIcon: selectedNode?.icon ?? null,
      selectedDocumentCount,
      selectedTotalBytes,
      selectedLastUpdateLabel,
      pinnedDocument,
      documents,
      totalDocuments,
      totalBytesUsed,
      storageQuotaBytes: STORAGE_QUOTA_BYTES,
      expiringSoonCount,
      archivedCount,
    };
  },
);

// ─── Version panel loader ─────────────────────────────────────────────────

export const getVersionPanel = cache(
  async (documentId: string): Promise<VersionPanelData | null> => {
    const ctx = await requireBuildingContext();
    const { buildingId, role } = ctx;
    const isBoardPlus = allows(ctx, "view.boardContext");
    const visibilityClause = visibilityWhereForRole(
      role as "OWNER" | "TENANT" | "BOARD_MEMBER" | "ADMIN" | "SUPER_ADMIN",
    );

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        category: { select: { buildingId: true } },
        versions: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!doc || doc.category.buildingId !== buildingId) return null;
    if (visibilityClause) {
      if (visibilityClause.equals && doc.visibility !== visibilityClause.equals)
        return null;
      if (
        visibilityClause.in &&
        !visibilityClause.in.includes(doc.visibility as DocVisibilityKey)
      )
        return null;
    }

    const boardCount = await prisma.userBuilding.count({
      where: {
        buildingId,
        role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] },
        isActive: true,
      },
    });

    return {
      document: {
        id: doc.id,
        title: doc.title,
        isPinned: doc.isPinned,
        visibility: doc.visibility as DocVisibilityKey,
        expiresAt: doc.expiresAt?.toISOString() ?? null,
      },
      versions: doc.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        fileName: v.fileName,
        fileSize: v.fileSize,
        mimeType: v.mimeType,
        uploadedAt: v.uploadedAt.toISOString(),
        uploaderName: v.uploadedBy.name,
        uploaderInitials: initialsOf(v.uploadedBy.name),
      })),
      currentVersionNumber: doc.versions[0]?.versionNumber ?? 0,
      viewCount: doc.viewCount,
      downloadCount: doc.downloadCount,
      lastAccessedAt: doc.lastAccessedAt?.toISOString() ?? null,
      boardCount,
      externalCount: 0,
      isBoardPlus,
    };
  },
);
