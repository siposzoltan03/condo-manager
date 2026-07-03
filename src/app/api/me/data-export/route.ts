import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { buildUserDataExport } from "@/lib/gdpr";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/me/data-export
 *
 * GDPR Article 15 — self-service. Returns a JSON dump of the personal data
 * the platform holds about the authenticated caller (profile, memberships,
 * units, proxies, meeting participation, complaints, notifications, sessions,
 * open-vote ballots, and their own activity log). Security material
 * (password hash, TOTP secret, backup codes) is excluded; secret ballots are
 * unreachable by construction (userId is null on those rows).
 */
export async function GET() {
  let userId: string;
  try {
    ({ userId } = await requireBuildingContext());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await buildUserDataExport(prisma, userId);
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = JSON.stringify(payload, null, 2);
  const filename = `kozos-adatexport-${userId.slice(-8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
