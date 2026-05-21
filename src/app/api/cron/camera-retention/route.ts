import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eligibleCamerasForPurge } from "@/lib/camera-retention";

/**
 * Phase 5 — Tht. § 25 + NAIH camera-retention purge tick.
 *
 * Daily cron driver. Walks every active BuildingCamera, computes the
 * footage cutoff (`now - retentionDays`), and emits a per-camera report
 * the caller (S3 lifecycle / storage worker) consumes to actually delete
 * the bytes. This endpoint does NOT delete footage itself — storage is
 * out of scope for the legal-alignment plan; the contract is that the
 * worker subscribes to this list and acts on it.
 *
 * Auth: Bearer token via CRON_SECRET, same pattern as the maintenance
 * cron. Idempotent — safe to re-run; it only reports cutoffs, never
 * mutates the camera rows.
 */

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await eligibleCamerasForPurge(prisma);
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    count: candidates.length,
    candidates,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
