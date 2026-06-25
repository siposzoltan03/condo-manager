import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import {
  getStorage,
  MAX_UPLOAD_BYTES,
  ALLOWED_SCOPES,
  type StorageScope,
} from "@/lib/storage";

export const runtime = "nodejs";
// File uploads can be larger than the default body limit; configure
// per-request explicitly.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Auth-only gate. The parent objects (Document, Complaint, ChannelMessage)
    // enforce their own permission rules — at this layer we just want to
    // ensure the caller is a known user in a known building.
    await requireBuildingContext();

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    const scopeInput = formData.get("scope");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (typeof scopeInput !== "string") {
      return NextResponse.json({ error: "Missing scope" }, { status: 400 });
    }
    if (!(ALLOWED_SCOPES as readonly string[]).includes(scopeInput)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
        },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await getStorage().put({
      scope: scopeInput as StorageScope,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      body: buffer,
    });

    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
