import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/**
 * Stream a stored file. Phase 1 trust model: any signed-in user in a
 * building can read any file. Per-file ACLs (board-only docs, private
 * complaint photos) are enforced at the parent module today — the page
 * showing the URL already gates whether the user sees the URL at all.
 *
 * Phase 2 (cloud): this route 302-redirects to a Cloudflare R2 presigned
 * URL instead of streaming. Stored URLs in the DB stay `/api/files/<key>`
 * forever, so swapping backends needs no data migration.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireBuildingContext();

    const { path: parts } = await context.params;
    const key = parts.join("/");
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    let body: Buffer | NodeJS.ReadableStream;
    let contentType: string;
    let contentLength: number;
    try {
      const r = await getStorage().read(key);
      body = r.body;
      contentType = r.contentType;
      contentLength = r.contentLength;
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // ReadableStream from createReadStream is a Node stream; Next will
    // convert it. For the buffer path we just hand it back.
    return new Response(body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Failed to serve file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
