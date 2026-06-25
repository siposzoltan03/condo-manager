import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  handleCheckoutCompleted,
  handleContractorCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleContractorSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleContractorSubscriptionDeleted,
} from "@/lib/billing";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 * Public endpoint — called by Stripe. The route's only responsibilities:
 *   1. Read raw body + signature header.
 *   2. Verify signature via `stripe.webhooks.constructEvent`.
 *   3. Dispatch to a handler in `@/lib/billing`.
 *   4. Always ack (200) so Stripe doesn't retry — handlers log their
 *      own failures internally.
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
        { status: 400 },
      );
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe:webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  console.log(`[stripe:webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.product === "contractor") {
          await handleContractorCheckoutCompleted(session);
        } else {
          await handleCheckoutCompleted(session);
        }
        break;
      }
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.product === "contractor") {
          await handleContractorSubscriptionUpdated(sub);
        } else {
          await handleSubscriptionUpdated(sub);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.product === "contractor") {
          await handleContractorSubscriptionDeleted(sub);
        } else {
          await handleSubscriptionDeleted(sub);
        }
        break;
      }
      default:
        console.log(`[stripe:webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[stripe:webhook] Error handling ${event.type}:`, error);
    // Return 200 anyway — handler errors are logged for investigation
    // but we don't want Stripe to retry indefinitely.
  }

  return NextResponse.json({ received: true });
}
