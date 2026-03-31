import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { generateInvitationToken, getInvitationExpiryDate } from "@/lib/invitation";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription lifecycle management.
 * Public endpoint — called by Stripe.
 * Uses request.text() for raw body (required for signature verification).
 */
export async function POST(request: NextRequest) {
  let event: Stripe.Event;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[stripe:webhook] Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe:webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  console.log(`[stripe:webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`[stripe:webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[stripe:webhook] Error handling ${event.type}:`, error);
    // Return 200 to prevent Stripe from retrying — log the error for investigation
  }

  return NextResponse.json({ received: true });
}

/**
 * checkout.session.completed
 * Creates Subscription + admin setup invitation if not already exists (idempotent).
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!stripeSubscriptionId) {
    console.warn("[stripe:webhook] checkout.session.completed without subscription ID");
    return;
  }

  // Idempotency: skip if subscription already exists
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (existing) {
    console.log(
      `[stripe:webhook] Subscription ${stripeSubscriptionId} already exists (id: ${existing.id}), skipping`
    );
    return;
  }

  const planId = session.metadata?.planId;
  if (!planId) {
    console.error("[stripe:webhook] No planId in session metadata");
    return;
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    console.error(`[stripe:webhook] Plan not found: ${planId}`);
    return;
  }

  const customerEmail =
    session.customer_email || session.customer_details?.email || "";

  // Retrieve Stripe subscription for trial info
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : null;
  const subscriptionStatus =
    stripeSubscription.status === "trialing" ? "TRIALING" : "ACTIVE";

  const { raw: inviteToken, hash: inviteTokenHash } = generateInvitationToken();

  await prisma.$transaction(async (tx) => {
    const placeholderUser = await tx.user.create({
      data: {
        email: customerEmail,
        passwordHash: "",
        name: customerEmail.split("@")[0],
        isActive: false,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        name: customerEmail,
        email: customerEmail,
        stripeCustomerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null,
        stripeSubscriptionId,
        planId: plan.id,
        subscriptionStatus,
        trialEndsAt: trialEnd,
        ownerId: placeholderUser.id,
      },
    });

    const expiryDate = getInvitationExpiryDate(null, 168);
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
  });

  // TODO: Queue email with invitation link
  console.log(
    `[stripe:webhook] Created subscription for ${customerEmail}. Invite token: ${inviteToken}`
  );
}

/**
 * Extracts the subscription ID from an invoice's parent.subscription_details.
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) return null;
  return typeof subDetails.subscription === "string"
    ? subDetails.subscription
    : subDetails.subscription?.id ?? null;
}

/**
 * invoice.paid — set subscription status to ACTIVE.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!stripeSubscriptionId) {
    console.warn("[stripe:webhook] invoice.paid without subscription ID");
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscriptionId} (invoice.paid)`
    );
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { subscriptionStatus: "ACTIVE" },
  });

  console.log(
    `[stripe:webhook] Subscription ${subscription.id} set to ACTIVE (invoice.paid)`
  );
}

/**
 * invoice.payment_failed — set subscription status to PAST_DUE.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!stripeSubscriptionId) {
    console.warn("[stripe:webhook] invoice.payment_failed without subscription ID");
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscriptionId} (invoice.payment_failed)`
    );
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { subscriptionStatus: "PAST_DUE" },
  });

  console.log(
    `[stripe:webhook] Subscription ${subscription.id} set to PAST_DUE (invoice.payment_failed)`
  );
}

/**
 * customer.subscription.updated — sync plan changes, handle downgrades.
 */
async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
    include: { plan: true, buildings: { select: { id: true }, orderBy: { createdAt: "desc" } } },
  });

  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscription.id} (updated)`
    );
    return;
  }

  // Map Stripe status to our SubscriptionStatus
  const statusMap: Record<string, string> = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
  };

  const newStatus = statusMap[stripeSubscription.status] || "ACTIVE";

  // Try to detect plan change via price ID
  const newPriceId = stripeSubscription.items?.data?.[0]?.price?.id;
  let newPlanId = subscription.planId;

  if (newPriceId && newPriceId !== subscription.plan.stripePriceId) {
    const newPlan = await prisma.plan.findFirst({
      where: { stripePriceId: newPriceId, isActive: true },
    });

    if (newPlan) {
      newPlanId = newPlan.id;
      console.log(
        `[stripe:webhook] Plan change detected: ${subscription.plan.slug} -> ${newPlan.slug}`
      );

      // Check for downgrade — freeze excess buildings if over new limits
      if (newPlan.maxBuildings !== -1 && subscription.buildings.length > newPlan.maxBuildings) {
        const excessCount = subscription.buildings.length - newPlan.maxBuildings;
        const buildingsToFreeze = subscription.buildings.slice(0, excessCount);

        await prisma.building.updateMany({
          where: { id: { in: buildingsToFreeze.map((b) => b.id) } },
          data: { isFrozen: true },
        });

        console.log(
          `[stripe:webhook] Froze ${excessCount} buildings due to plan downgrade`
        );
      }
    }
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      subscriptionStatus: newStatus as "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED",
      planId: newPlanId,
    },
  });

  console.log(
    `[stripe:webhook] Subscription ${subscription.id} updated: status=${newStatus}, planId=${newPlanId}`
  );
}

/**
 * customer.subscription.deleted — set status to CANCELED.
 */
async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscription.id} (deleted)`
    );
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { subscriptionStatus: "CANCELED" },
  });

  console.log(
    `[stripe:webhook] Subscription ${subscription.id} set to CANCELED (deleted)`
  );
}
