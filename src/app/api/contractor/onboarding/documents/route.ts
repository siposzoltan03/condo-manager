import { NextRequest, NextResponse } from "next/server";
import { requireContractorOwner } from "@/lib/contractor/session";
import { listOrgDocuments, createOrgDocument } from "@/lib/contractor";
import { getStorage, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_KINDS = new Set(["insurance", "license", "reference", "other"]);

/**
 * GET — list documents for the current contractor org.
 * POST — multipart upload (`file` + `kind`); stores in the
 *        `contractor-document` scope, persists a `ContractorDocument`
 *        row, and returns it.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const docs = await listOrgDocuments(ctx.orgId);
  return NextResponse.json({ documents: docs });
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  const kindRaw = form.get("kind");
  const validUntilRaw = form.get("validUntil");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (typeof kindRaw !== "string" || !ALLOWED_KINDS.has(kindRaw)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  let validUntil: Date | null = null;
  if (typeof validUntilRaw === "string" && validUntilRaw.trim()) {
    const d = new Date(validUntilRaw);
    if (!Number.isNaN(d.getTime())) validUntil = d;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put({
    scope: "contractor-document",
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    body: buf,
  });

  const doc = await createOrgDocument(ctx.orgId, {
    kind: kindRaw,
    fileName: file.name,
    storageKey: stored.key,
    validUntil,
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
