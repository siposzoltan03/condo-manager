"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

interface ActionResult {
  success?: boolean;
  error?: string;
  requestId?: string;
}

/**
 * Dual-control resident removal — step 1: a board-level user (resident.remove
 * cap, i.e. ADMIN or a board member with the delete_resident grant) initiates
 * a removal with a reason. A DIFFERENT board-level user must approve it.
 */
export async function requestResidentRemoval(input: {
  targetUserBuildingId: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    requireCapability(ctx, "resident.remove");

    const reason = input.reason?.trim();
    if (!reason) return { error: "A reason is required." };

    const target = await prisma.userBuilding.findUnique({
      where: { id: input.targetUserBuildingId },
      select: { id: true, userId: true, buildingId: true, isActive: true, role: true },
    });
    if (!target || target.buildingId !== ctx.buildingId) {
      return { error: "Resident not found." };
    }
    if (target.userId === ctx.userId) return { error: "You cannot remove yourself." };
    if (target.role === "ADMIN" || target.role === "SUPER_ADMIN") {
      return { error: "An administrator cannot be removed this way." };
    }
    if (!target.isActive) return { error: "This resident is already inactive." };

    const existing = await prisma.residentRemovalRequest.findFirst({
      where: { targetUserBuildingId: target.id, status: "PENDING" },
    });
    if (existing) {
      return { error: "A removal request is already pending for this resident." };
    }

    const req = await prisma.residentRemovalRequest.create({
      data: {
        buildingId: ctx.buildingId,
        targetUserBuildingId: target.id,
        requestedById: ctx.userId,
        reason,
      },
    });
    await createAuditLog({
      entityType: "ResidentRemovalRequest",
      entityId: req.id,
      action: "CREATE",
      userId: ctx.userId,
      buildingId: ctx.buildingId,
      newValue: { targetUserId: target.userId, reason },
    });
    revalidatePath("/residents");
    return { success: true, requestId: req.id };
  } catch (e) {
    console.error("requestResidentRemoval failed:", e);
    return { error: e instanceof Error ? e.message : "Internal error" };
  }
}

/**
 * Step 2: a DIFFERENT board-level user approves or rejects. On approval the
 * membership is soft-removed (deactivated) — accounting records + assembly
 * minutes are retained per statutory periods; hard erasure stays the separate
 * GDPR flow. Fully audited.
 */
export async function reviewResidentRemoval(input: {
  requestId: string;
  approve: boolean;
  note?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    requireCapability(ctx, "resident.remove");

    const req = await prisma.residentRemovalRequest.findUnique({
      where: { id: input.requestId },
      include: {
        targetUserBuilding: {
          select: { id: true, userId: true, buildingId: true, role: true },
        },
      },
    });
    if (!req || req.buildingId !== ctx.buildingId) return { error: "Request not found." };
    if (req.status !== "PENDING") return { error: "This request is no longer pending." };
    // Dual control — the approver must differ from the initiator.
    if (req.requestedById === ctx.userId) {
      return { error: "A different board member must approve the removal." };
    }

    const note = input.note?.trim() || null;

    if (input.approve) {
      if (
        req.targetUserBuilding.role === "ADMIN" ||
        req.targetUserBuilding.role === "SUPER_ADMIN"
      ) {
        return { error: "An administrator cannot be removed this way." };
      }
      // Soft-remove: deactivate the building membership only (the user may
      // belong to other buildings). Reversible; retains records.
      await prisma.$transaction([
        prisma.userBuilding.update({
          where: { id: req.targetUserBuildingId },
          data: { isActive: false },
        }),
        prisma.residentRemovalRequest.update({
          where: { id: req.id },
          data: {
            status: "APPROVED",
            reviewedById: ctx.userId,
            reviewedAt: new Date(),
            reviewNote: note,
          },
        }),
      ]);
      await createAuditLog({
        entityType: "ResidentRemovalRequest",
        entityId: req.id,
        action: "UPDATE",
        userId: ctx.userId,
        buildingId: ctx.buildingId,
        oldValue: { status: "PENDING" },
        newValue: { status: "APPROVED", membershipDeactivated: req.targetUserBuilding.userId },
        reason: note ?? undefined,
      });
    } else {
      await prisma.residentRemovalRequest.update({
        where: { id: req.id },
        data: {
          status: "REJECTED",
          reviewedById: ctx.userId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      });
      await createAuditLog({
        entityType: "ResidentRemovalRequest",
        entityId: req.id,
        action: "UPDATE",
        userId: ctx.userId,
        buildingId: ctx.buildingId,
        oldValue: { status: "PENDING" },
        newValue: { status: "REJECTED" },
        reason: note ?? undefined,
      });
    }
    revalidatePath("/residents");
    return { success: true };
  } catch (e) {
    console.error("reviewResidentRemoval failed:", e);
    return { error: e instanceof Error ? e.message : "Internal error" };
  }
}

/** The initiator (or any resident.remove holder) may cancel a pending request. */
export async function cancelResidentRemoval(input: {
  requestId: string;
}): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    requireCapability(ctx, "resident.remove");
    const req = await prisma.residentRemovalRequest.findUnique({
      where: { id: input.requestId },
    });
    if (!req || req.buildingId !== ctx.buildingId) return { error: "Request not found." };
    if (req.status !== "PENDING") return { error: "This request is no longer pending." };
    await prisma.residentRemovalRequest.update({
      where: { id: req.id },
      data: { status: "CANCELLED", reviewedById: ctx.userId, reviewedAt: new Date() },
    });
    revalidatePath("/residents");
    return { success: true };
  } catch (e) {
    console.error("cancelResidentRemoval failed:", e);
    return { error: e instanceof Error ? e.message : "Internal error" };
  }
}
