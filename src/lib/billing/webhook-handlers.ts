import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  generateInvitationToken,
  getInvitationExpiryDate,
} from "@/lib/invitation";
import * as dal from "./dal";

/**
 * One function per Stripe webhook event we handle. Each function takes
 * the parsed Stripe object, mutates state via `./dal`, and is a pure
 * orchestrator otherwise. The route's job is dispatch only — no DB
 * code lives there.
 *
 * The legacy condo-side handlers split off the contractor branch via
 * `metadata.product === "contractor"`. We preserve that split here
 * with explicit `*Contractor*` siblings.
 */

// ────────────────────────────────────────────────────────────────────────
// checkout.session.completed (condo)
// ────────────────────────────────────────────────────────────────────────

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!stripeSubscriptionId) {
    console.warn(
      "[stripe:webhook] checkout.session.completed without subscription ID",
    );
    return;
  }

  // Idempotency: skip if subscription already exists.
  const existing = await dal.findSubscriptionByStripeId(stripeSubscriptionId);
  if (existing) {
    console.log(
      `[stripe:webhook] Subscription ${stripeSubscriptionId} already exists (id: ${existing.id}), skipping`,
    );
    return;
  }

  const planId = session.metadata?.planId;
  if (!planId) {
    console.error("[stripe:webhook] No planId in session metadata");
    return;
  }

  const plan = await dal.findPlanById(planId);
  if (!plan) {
    console.error(`[stripe:webhook] Plan not found: ${planId}`);
    return;
  }

  const customerEmail =
    session.customer_email || session.customer_details?.email || "";

  const stripeSubscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
  );
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : null;
  const subscriptionStatus =
    stripeSubscription.status === "trialing" ? "TRIALING" : "ACTIVE";

  const { raw: inviteToken, hash: inviteTokenHash } = generateInvitationToken();
  const invitationExpiresAt = getInvitationExpiryDate(null, 168);

  await dal.createSubscriptionWithPlaceholder({
    email: customerEmail,
    stripeCustomerId:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null,
    stripeSubscriptionId,
    planId: plan.id,
    subscriptionStatus,
    trialEndsAt: trialEnd,
    invitationTokenHash: inviteTokenHash,
    invitationExpiresAt,
  });

  // Send invitation email — best-effort.
  try {
    const { sendEmail } = await import("@/lib/email");
    const { invitationEmail } = await import("@/lib/email-templates");
    const inviteLink = `${process.env.NEXTAUTH_URL}/accept-invitation?token=${inviteToken}`;
    const email = invitationEmail({
      buildingName: "Your new building",
      roleName: "Admin",
      inviteLink,
      expiryHours: 168,
    });
    await sendEmail(customerEmail, email.subject, email.html);
  } catch (emailErr) {
    console.error(
      "[stripe:webhook] Failed to send invitation email:",
      emailErr,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────
// invoice.paid / invoice.payment_failed (condo)
// ────────────────────────────────────────────────────────────────────────

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) return null;
  return typeof subDetails.subscription === "string"
    ? subDetails.subscription
    : subDetails.subscription?.id ?? null;
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) {
    console.warn("[stripe:webhook] invoice.paid without subscription ID");
    return;
  }
  const subscription = await dal.findSubscriptionByStripeId(
    stripeSubscriptionId,
  );
  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscriptionId} (invoice.paid)`,
    );
    return;
  }
  await dal.updateSubscriptionStatus(subscription.id, "ACTIVE");
  console.log(
    `[stripe:webhook] Subscription ${subscription.id} set to ACTIVE (invoice.paid)`,
  );
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) {
    console.warn(
      "[stripe:webhook] invoice.payment_failed without subscription ID",
    );
    return;
  }
  const subscription = await dal.findSubscriptionByStripeId(
    stripeSubscriptionId,
  );
  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscriptionId} (invoice.payment_failed)`,
    );
    return;
  }
  await dal.updateSubscriptionStatus(subscription.id, "PAST_DUE");
  console.log(
    `[stripe:webhook] Subscription ${subscription.id} set to PAST_DUE (invoice.payment_failed)`,
  );
}

// ────────────────────────────────────────────────────────────────────────
// customer.subscription.updated (condo) — plan changes + downgrade freeze
// ────────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<
  string,
  "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED"
> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "PAST_DUE",
};

export async function handleSubscriptionUpdated(
  stripeSubscription: Stripe.Subscription,
) {
  const subscription = await dal.findSubscriptionWithPlanAndBuildings(
    stripeSubscription.id,
  );
  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscription.id} (updated)`,
    );
    return;
  }

  const newStatus = STATUS_MAP[stripeSubscription.status] ?? "ACTIVE";

  // Plan change detection via priceId.
  const newPriceId = stripeSubscription.items?.data?.[0]?.price?.id;
  let newPlanId = subscription.planId;

  if (newPriceId && newPriceId !== subscription.plan.stripePriceId) {
    const newPlan = await dal.findActivePlanByStripePriceId(newPriceId);
    if (newPlan) {
      newPlanId = newPlan.id;
      console.log(
        `[stripe:webhook] Plan change detected: ${subscription.plan.slug} -> ${newPlan.slug}`,
      );

      // Downgrade — freeze excess buildings. The current policy freezes
      // the *newest* excess buildings (DESC orderBy + slice from start);
      // see characterization test in stripe-webhook.test.ts.
      if (
        newPlan.maxBuildings !== -1 &&
        subscription.buildings.length > newPlan.maxBuildings
      ) {
        const excessCount =
          subscription.buildings.length - newPlan.maxBuildings;
        const buildingsToFreeze = subscription.buildings.slice(0, excessCount);
        await dal.freezeBuildings(buildingsToFreeze.map((b) => b.id));
        console.log(
          `[stripe:webhook] Froze ${excessCount} buildings due to plan downgrade`,
        );
      }
    }
  }

  await dal.updateSubscriptionStatusAndPlan(subscription.id, {
    subscriptionStatus: newStatus,
    planId: newPlanId,
  });
  console.log(
    `[stripe:webhook] Subscription ${subscription.id} updated: status=${newStatus}, planId=${newPlanId}`,
  );
}

// ────────────────────────────────────────────────────────────────────────
// customer.subscription.deleted (condo)
// ────────────────────────────────────────────────────────────────────────

export async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
) {
  const subscription = await dal.findSubscriptionByStripeId(
    stripeSubscription.id,
  );
  if (!subscription) {
    console.warn(
      `[stripe:webhook] Subscription not found for ${stripeSubscription.id} (deleted)`,
    );
    return;
  }
  await dal.updateSubscriptionStatus(subscription.id, "CANCELED");
  console.log(
    `[stripe:webhook] Subscription ${subscription.id} set to CANCELED (deleted)`,
  );
}

// ────────────────────────────────────────────────────────────────────────
// Contractor-side handlers
// ────────────────────────────────────────────────────────────────────────

export async function handleContractorCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  const orgId = session.metadata?.contractorOrgId;
  const plan = session.metadata?.plan;
  if (!orgId || (plan !== "PRO" && plan !== "PREMIUM")) {
    console.error("[stripe:webhook] contractor checkout missing metadata");
    return;
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  let currentPeriodEndsAt: Date | null = null;
  if (stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const items = sub.items?.data ?? [];
    const periodEnd = items[0]?.current_period_end as number | undefined;
    if (periodEnd) currentPeriodEndsAt = new Date(periodEnd * 1000);
  }

  await dal.setContractorOrgPlanFromCheckout(orgId, {
    plan,
    stripeCustomerId: stripeCustomerId ?? undefined,
    stripeSubscriptionId: stripeSubscriptionId ?? undefined,
    currentPeriodEndsAt,
  });
  console.log(
    `[stripe:webhook] Contractor ${orgId} → ${plan} (sub ${stripeSubscriptionId})`,
  );
}

export async function handleContractorSubscriptionUpdated(
  sub: Stripe.Subscription,
) {
  const orgId = sub.metadata?.contractorOrgId;
  if (!orgId) return;

  const items = sub.items?.data ?? [];
  const periodEnd = items[0]?.current_period_end as number | undefined;

  let planStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  if (sub.status === "trialing") planStatus = "TRIALING";
  else if (sub.status === "past_due" || sub.status === "unpaid")
    planStatus = "PAST_DUE";
  else if (sub.status === "canceled" || sub.status === "incomplete_expired")
    planStatus = "CANCELLED";
  else planStatus = "ACTIVE";

  await dal.setContractorOrgPlanStatusAndPeriod(orgId, {
    planStatus,
    currentPeriodEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
  });
}

export async function handleContractorSubscriptionDeleted(
  sub: Stripe.Subscription,
) {
  const orgId = sub.metadata?.contractorOrgId;
  if (!orgId) return;
  await dal.downgradeContractorOrgToFree(orgId);
}
