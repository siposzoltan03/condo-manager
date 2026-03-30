import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireBuildingContext } from "@/lib/auth";
import { getSubscriptionForBuilding } from "@/lib/feature-gate";

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for the subscription owner.
 * Authenticated endpoint — requires active building context.
 */
export async function POST() {
  try {
    const { buildingId } = await requireBuildingContext();

    const subscription = await getSubscriptionForBuilding(buildingId);

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found for this building" },
        { status: 404 }
      );
    }

    if (!subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer associated with this subscription" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/en/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
