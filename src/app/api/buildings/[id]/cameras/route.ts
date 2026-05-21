import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCameraInstallEligibility } from "@/lib/camera-install";
import { createAuditLog } from "@/lib/audit";

/**
 * Phase 5 — Tht. § 25 + NAIH building-camera install API.
 *
 * GET — List active cameras for the building. Allowed for ADMIN,
 *       BOARD_MEMBER, AUDITOR memberships in the building (and
 *       SUPER_ADMIN platform-side).
 *
 * POST — Install a new camera. Allowed for ADMIN or the chair of the
 *        intézőbizottság (BOARD_MEMBER with isChair=true). Validates
 *        the TWO_THIRDS-passed vote and the privacy-notice document
 *        via `checkCameraInstallEligibility`. NAIH caps retention at
 *        15 days for ordinary buildings — the API clamps any caller-
 *        supplied value into [1, 15].
 */

interface InstallBody {
  location?: string;
  voteId?: string;
  privacyNoticeDocumentId?: string;
  retentionDays?: number;
}

const MAX_RETENTION_DAYS = 15;
const MIN_RETENTION_DAYS = 1;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: buildingId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    const membership = await prisma.userBuilding.findUnique({
      where: { userId_buildingId: { userId: user.id, buildingId } },
      select: { role: true },
    });
    const allowed =
      membership?.role === "ADMIN" ||
      membership?.role === "BOARD_MEMBER" ||
      membership?.role === "AUDITOR";
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const cameras = await prisma.buildingCamera.findMany({
    where: { buildingId, isActive: true },
    orderBy: { installedAt: "desc" },
    select: {
      id: true,
      location: true,
      retentionDays: true,
      installedAt: true,
      installedByVoteId: true,
    },
  });

  return NextResponse.json({ buildingId, cameras });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: buildingId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SUPER_ADMIN cannot install on behalf of a building — Tht. § 25
  // requires the chair or registered manager to authorize. We mirror
  // the capability matrix from src/lib/capabilities.ts.
  const isAdmin = user.role === "ADMIN";
  let isChair = false;
  if (!isAdmin) {
    const membership = await prisma.userBuilding.findUnique({
      where: { userId_buildingId: { userId: user.id, buildingId } },
      select: { role: true, isChair: true },
    });
    isChair = membership?.role === "BOARD_MEMBER" && membership.isChair === true;
    if (!isChair) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as InstallBody;
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const voteId = body.voteId;
  const privacyNoticeDocumentId = body.privacyNoticeDocumentId;

  if (!location || !voteId || !privacyNoticeDocumentId) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: location, voteId, privacyNoticeDocumentId",
      },
      { status: 400 },
    );
  }

  let retentionDays = MAX_RETENTION_DAYS;
  if (body.retentionDays !== undefined && body.retentionDays !== null) {
    const parsed = Number(body.retentionDays);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return NextResponse.json(
        { error: "retentionDays must be an integer in [1, 15]" },
        { status: 400 },
      );
    }
    if (parsed < MIN_RETENTION_DAYS || parsed > MAX_RETENTION_DAYS) {
      return NextResponse.json(
        {
          error: `retentionDays must be in [${MIN_RETENTION_DAYS}, ${MAX_RETENTION_DAYS}] (NAIH cap)`,
        },
        { status: 400 },
      );
    }
    retentionDays = parsed;
  }

  const check = await checkCameraInstallEligibility(prisma, {
    buildingId,
    voteId,
    privacyNoticeDocumentId,
  });
  if (!check.ok) {
    return NextResponse.json(
      { error: check.message, code: check.code },
      { status: 422 },
    );
  }

  const camera = await prisma.buildingCamera.create({
    data: {
      buildingId,
      location,
      installedByVoteId: voteId,
      retentionDays,
    },
    select: {
      id: true,
      location: true,
      retentionDays: true,
      installedAt: true,
      installedByVoteId: true,
    },
  });

  await createAuditLog({
    entityType: "BuildingCamera",
    entityId: camera.id,
    action: "CREATE",
    userId: user.id,
    buildingId,
    newValue: {
      location,
      voteId,
      privacyNoticeDocumentId,
      retentionDays,
    },
  });

  return NextResponse.json(camera, { status: 201 });
}
