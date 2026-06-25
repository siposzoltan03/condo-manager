import { NextRequest, NextResponse } from "next/server";
import { requireContractorOwner } from "@/lib/contractor/session";
import {
  getOrgForBillingCheckout,
  activateOrgViaDevCheckout,
} from "@/lib/contractor";
import { PLAN_CAPS, type Plan } from "@/lib/marketplace";
import { createAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/contractor/billing/checkout
 *
 * Body: { plan: "PRO" | "PREMIUM" }
 *
 * Stripe-mode (default in prod): creates a Stripe Checkout Session for
 * the requested plan and returns the redirect URL. Webhook flips the
 * org to ACTIVE on payment.
 *
 * Dev-override mode: when `STRIPE_SECRET_KEY` is unset OR the plan's
 * `stripePriceEnv` isn't configured, we flip the plan immediately (no
 * Stripe call) and return `{ ok: true, dev: true }`. Lets dev users
 * test the gating end-to-end without a real Stripe account.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { plan?: string }
    | null;
  const requested = body?.plan;
  if (requested !== "PRO" && requested !== "PREMIUM") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const plan = requested as Plan;
  const caps = PLAN_CAPS[plan];
  const priceId = caps.stripePriceEnv
    ? process.env[caps.stripePriceEnv]
    : undefined;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const devMode = !stripeKey || !priceId;

  if (devMode) {
    // Dev override — flip the org without going through Stripe.
    await activateOrgViaDevCheckout(
      ctx.orgId,
      plan,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    );
    await createAuditLog({
      entityType: "ContractorOrg",
      entityId: ctx.orgId,
      action: "UPDATE",
      userId: ctx.userId,
      newValue: { plan, devOverride: true },
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, dev: true });
  }

  // Stripe path. Load org + owner email for prefill.
  const org = await getOrgForBillingCheckout(ctx.orgId);
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }
  const ownerEmail = org.users[0]?.email;

  const { stripe } = await import("@/lib/stripe");
  const base =
    process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/hu/contractor/billing?success=1`,
    cancel_url: `${base}/hu/contractor/billing?cancelled=1`,
    customer: org.stripeCustomerId ?? undefined,
    customer_email: org.stripeCustomerId ? undefined : ownerEmail,
    metadata: {
      product: "contractor",
      contractorOrgId: org.id,
      plan,
    },
    subscription_data: {
      metadata: {
        product: "contractor",
        contractorOrgId: org.id,
        plan,
      },
    },
  });

  return NextResponse.json({ ok: true, dev: false, url: session.url });
}
