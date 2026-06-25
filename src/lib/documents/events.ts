import { createAuditLog } from "@/lib/audit";

/**
 * Documents domain events. Same pattern as the other event modules —
 * thin wrappers around audit (notify isn't fired on the docs surface
 * today).
 */

export async function documentCreated(opts: {
  documentId: string;
  createdByUserId: string;
  buildingId: string;
  title: string;
  categoryId: string;
  visibility: string;
}) {
  await createAuditLog({
    entityType: "Document",
    entityId: opts.documentId,
    action: "CREATE",
    userId: opts.createdByUserId,
    buildingId: opts.buildingId,
    newValue: {
      title: opts.title,
      categoryId: opts.categoryId,
      visibility: opts.visibility,
    },
  });
}

export async function documentUpdated(opts: {
  documentId: string;
  updatedByUserId: string;
  buildingId: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "Document",
    entityId: opts.documentId,
    action: "UPDATE",
    userId: opts.updatedByUserId,
    buildingId: opts.buildingId,
    oldValue: opts.oldValue,
    newValue: opts.newValue,
  });
}

export async function documentPinToggled(opts: {
  documentId: string;
  toggledByUserId: string;
  buildingId: string;
  oldPinned: boolean;
  newPinned: boolean;
}) {
  await createAuditLog({
    entityType: "Document",
    entityId: opts.documentId,
    action: "UPDATE",
    userId: opts.toggledByUserId,
    buildingId: opts.buildingId,
    oldValue: { isPinned: opts.oldPinned },
    newValue: { isPinned: opts.newPinned },
  });
}

export async function documentVersionCreated(opts: {
  versionId: string;
  documentId: string;
  createdByUserId: string;
  buildingId: string;
  newValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "DocumentVersion",
    entityId: opts.versionId,
    action: "CREATE",
    userId: opts.createdByUserId,
    buildingId: opts.buildingId,
    newValue: opts.newValue,
  });
}

export async function documentDeleted(opts: {
  documentId: string;
  deletedByUserId: string;
  buildingId: string;
  oldValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "Document",
    entityId: opts.documentId,
    action: "DELETE",
    userId: opts.deletedByUserId,
    buildingId: opts.buildingId,
    oldValue: opts.oldValue,
  });
}

export async function documentCategoryCreated(opts: {
  categoryId: string;
  createdByUserId: string;
  buildingId: string;
  name: string;
  icon: string | null;
  parentId: string | null;
}) {
  await createAuditLog({
    entityType: "DocumentCategory",
    entityId: opts.categoryId,
    action: "CREATE",
    userId: opts.createdByUserId,
    buildingId: opts.buildingId,
    newValue: { name: opts.name, icon: opts.icon, parentId: opts.parentId },
  });
}
