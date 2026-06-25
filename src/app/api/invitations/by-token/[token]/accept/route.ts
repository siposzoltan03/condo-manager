import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { validatePassword, hashPassword } from "@/lib/password";
import { findInvitationByToken, isInvitationExpired } from "@/lib/invitation";

/**
 * POST /api/invitations/[token]/accept
 * Public, rate-limited endpoint. Accepts an invitation by creating the user
 * and building membership.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Rate limit: 5 attempts per IP per 15 minutes
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const rl = await rateLimit({
      key: `invitation:accept:${ip}`,
      limit: 5,
      windowSeconds: 15 * 60,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const invitation = await findInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation token" },
        { status: 404 }
      );
    }

    if (isInvitationExpired(invitation)) {
      const statusMessage =
        invitation.status === "ACCEPTED"
          ? "This invitation has already been accepted"
          : invitation.status === "REVOKED"
            ? "This invitation has been revoked"
            : "This invitation has expired";
      return NextResponse.json(
        { error: statusMessage },
        { status: 410 }
      );
    }

    const body = await request.json();
    const {
      name,
      password,
      buildingName,
      buildingAddress,
      buildingCity,
      buildingZipCode,
      /**
       * Phase 5 (GDPR Art. 6 + Tht. § 22(2)) — only meaningful when the
       * invitee is being added as a TENANT. When `true`, we record an
       * affirmative consent stamp on the UnitUser row so downstream code
       * (resident directory, vendor anonymizer, notification fanout) can
       * share or use the tenant's contact data beyond name + presence.
       * Default false = retain only what § 22(2) requires.
       */
      contactConsent,
    } = body;

    if (!name || !password) {
      return NextResponse.json(
        { error: "Missing required fields: name, password" },
        { status: 400 }
      );
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors.join(". ") },
        { status: 400 }
      );
    }

    // For ADMIN_SETUP, require building details
    if (invitation.type === "ADMIN_SETUP") {
      if (!buildingName || !buildingAddress || !buildingCity || !buildingZipCode) {
        return NextResponse.json(
          { error: "Missing required fields: buildingName, buildingAddress, buildingCity, buildingZipCode" },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      // Check if user with this email already exists
      let user = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      if (invitation.type === "ADMIN_SETUP") {
        // ADMIN_SETUP: create user + building + membership
        if (!user) {
          user = await tx.user.create({
            data: {
              email: invitation.email,
              name,
              passwordHash,
            },
          });
        }

        const building = await tx.building.create({
          data: {
            name: buildingName,
            address: buildingAddress,
            city: buildingCity,
            zipCode: buildingZipCode,
            subscriptionId: invitation.subscriptionId,
          },
        });

        await tx.userBuilding.create({
          data: {
            userId: user.id,
            buildingId: building.id,
            role: "ADMIN",
          },
        });

        return { user, building };
      } else {
        // USER_INVITE: create user (if needed) + building membership + optional unit assignment
        if (!user) {
          user = await tx.user.create({
            data: {
              email: invitation.email,
              name,
              passwordHash,
            },
          });
        }

        if (!invitation.buildingId) {
          throw new Error("USER_INVITE must have a buildingId");
        }

        await tx.userBuilding.create({
          data: {
            userId: user.id,
            buildingId: invitation.buildingId,
            role: invitation.role ?? "OWNER",
          },
        });

        // If a unit was specified, create the unit-user assignment.
        if (invitation.unitId) {
          const relationship = invitation.relationship ?? "OWNER";
          // Phase 5 — tenants must affirmatively consent before the
          // building retains contact data beyond name + presence (GDPR
          // Art. 6, Tht. § 22(2)). Owners aren't subject to this rule
          // (they're members of the building under § 16).
          const recordConsent = relationship === "TENANT" && contactConsent === true;
          await tx.unitUser.create({
            data: {
              userId: user.id,
              unitId: invitation.unitId,
              relationship,
              contactConsentAt: recordConsent ? new Date() : null,
              contactConsentMode: recordConsent ? "explicit" : null,
            },
          });
        }

        return { user, building: invitation.building };
      }
    });

    // Mark invitation as accepted (outside transaction for simplicity)
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      building: result.building
        ? { id: result.building.id, name: result.building.name }
        : null,
    });
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
