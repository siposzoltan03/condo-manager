import { NextResponse } from "next/server";
import { requireContractorOwner } from "@/lib/contractor/session";
import { getOrgDocument, deleteOrgDocument } from "@/lib/contractor";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * DELETE — remove a contractor document. Org-scoped: a document can only
 * be deleted by an OWNER of the same org. The file is best-effort
 * removed from storage but the DB row is the source of truth.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await getOrgDocument(ctx.orgId, id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteOrgDocument(ctx.orgId, doc.id);
  getStorage()
    .remove(doc.storageKey)
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
