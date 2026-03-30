import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { generateInvitationToken, getInvitationExpiryDate } from "@/lib/invitation";

/**
 * POST /api/stripe/verify-session
 * Verifies a completed Stripe Checkout Session and provisions the subscription.
 * Public endpoint — called from the checkout success page.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.status !== "complete") {
      return NextResponse.json(
        { error: "Checkout session is not complete" },
        { status: 400 }
      );
    }

    const stripeSubscription = session.subscription;
    if (!stripeSubscription || typeof stripeSubscription === "string") {
      return NextResponse.json(
        { error: "No subscription found on session" },
        { status: 400 }
      );
    }

    // Idempotency: check if subscription already exists
    const existing = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubscription.id },
      include: { plan: true },
    });

    if (existing) {
      return NextResponse.json({
        subscription: {
          id: existing.id,
          planName: existing.plan.name,
          status: existing.subscriptionStatus,
        },
        invitationSent: false,
        alreadyExists: true,
      });
    }

    // Resolve plan from session metadata
    const planId = session.metadata?.planId;
    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID missing from session metadata" },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    const customerEmail =
      session.customer_email || session.customer_details?.email || "";

    // Determine trial end
    const trialEnd = stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null;

    const subscriptionStatus =
      stripeSubscription.status === "trialing" ? "TRIALING" : "ACTIVE";

    // Create a placeholder user for the subscription owner
    // This user will be updated when the admin accepts the invitation
    const { raw: inviteToken, hash: inviteTokenHash } = generateInvitationToken();

    const result = await prisma.$transaction(async (tx) => {
      // Create placeholder user
      const placeholderUser = await tx.user.create({
        data: {
          email: customerEmail,
          passwordHash: "", // Will be set when invitation is accepted
          name: customerEmail.split("@")[0], // Temporary name
          isActive: false, // Inactive until invitation is accepted
        },
      });

      // Create subscription
      const subscription = await tx.subscription.create({
        data: {
          name: customerEmail,
          email: customerEmail,
          stripeCustomerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id ?? null,
          stripeSubscriptionId: stripeSubscription.id,
          planId: plan.id,
          subscriptionStatus,
          trialEndsAt: trialEnd,
          ownerId: placeholderUser.id,
        },
        include: { plan: true },
      });

      // Create admin setup invitation
      const expiryDate = getInvitationExpiryDate(null, 168); // 7 days
      await tx.invitation.create({
        data: {
          email: customerEmail,
          tokenHash: inviteTokenHash,
          type: "ADMIN_SETUP",
          subscriptionId: subscription.id,
          expiresAt: expiryDate,
          status: "PENDING",
        },
      });

      return { subscription, placeholderUser };
    });

    // TODO: Queue email with invitation link containing inviteToken
    console.log(
      `[stripe:verify-session] Admin setup invitation created for ${customerEmail}. Token: ${inviteToken}`
    );

    return NextResponse.json({
      subscription: {
        id: result.subscription.id,
        planName: result.subscription.plan.name,
        status: result.subscription.subscriptionStatus,
      },
      invitationSent: true,
      alreadyExists: false,
    });
  } catch (error) {
    console.error("Failed to verify checkout session:", error);
    return NextResponse.json(
      { error: "Failed to verify checkout session" },
      { status: 500 }
    );
  }
}
