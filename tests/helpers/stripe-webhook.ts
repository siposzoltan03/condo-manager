import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

/**
 * Sign a webhook payload as Stripe would. The route's `constructEvent`
 * verification path runs unchanged in tests — we just produce a valid
 * signature header against the test-only `STRIPE_WEBHOOK_SECRET`.
 */
export function stripeSignature(
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const signed = `${timestamp}.${rawBody}`;
  const v1 = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/**
 * Build a NextRequest carrying a Stripe-style signed payload. Mirrors how
 * Stripe's POSTs land at our route in production.
 */
export function stripeRequest(
  payload: object,
  opts: { secret?: string; sigOverride?: string | null } = {},
) {
  const secret =
    opts.secret ?? process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_secret";
  const body = JSON.stringify(payload);
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.sigOverride !== null) {
    headers.set(
      "stripe-signature",
      opts.sigOverride ?? stripeSignature(body, secret),
    );
  }
  return new NextRequest("http://test.local/api/stripe/webhook", {
    method: "POST",
    body,
    headers,
  });
}

/**
 * Build a Stripe event envelope for a specific event type and inner object.
 * The route only reads `event.type` and `event.data.object`, plus a couple
 * of `metadata` fields — fixture payloads can be minimal.
 */
export function stripeEvent<T extends object>(
  type: string,
  object: T,
  overrides: Partial<{ id: string; created: number }> = {},
) {
  return {
    id: overrides.id ?? `evt_${Math.random().toString(36).slice(2, 10)}`,
    object: "event",
    api_version: "2026-03-25",
    created: overrides.created ?? Math.floor(Date.now() / 1000),
    type,
    data: { object },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  };
}
