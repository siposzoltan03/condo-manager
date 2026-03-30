import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for a new subscription.
 * Public endpoint — the buyer is not yet a user.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planSlug, billingPeriod, email } = body;

    if (!planSlug || !email) {
      return NextResponse.json(
        { error: "planSlug and email are required" },
        { status: 400 }
      );
    }

    if (billingPeriod && !["monthly", "yearly"].includes(billingPeriod)) {
      return NextResponse.json(
        { error: "billingPeriod must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: "Plan not found or not active" },
        { status: 404 }
      );
    }

    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: "Plan does not have a Stripe price configured" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/en/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/en/pricing`,
      metadata: {
        planSlug: plan.slug,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          planSlug: plan.slug,
          planId: plan.id,
        },
        ...(plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
