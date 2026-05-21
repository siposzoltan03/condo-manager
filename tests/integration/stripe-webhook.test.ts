import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeBuilding,
  makeContractorOrg,
  makePlan,
  makeStandaloneUser,
} from "../fixtures";
import { stripeRequest, stripeEvent } from "../helpers/stripe-webhook";

// Mock @/lib/stripe so the webhook route uses a real `webhooks.constructEvent`
// (so signature verification is exercised) but a stubbed `subscriptions.retrieve`.
const { subscriptionsRetrieveMock } = vi.hoisted(() => ({
  subscriptionsRetrieveMock: vi.fn(),
}));

vi.mock("@/lib/stripe", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  const real = new Stripe("sk_test_unused", {
    apiVersion: "2026-03-25.dahlia",
  });
  return {
    stripe: {
      webhooks: real.webhooks,
      subscriptions: { retrieve: subscriptionsRetrieveMock },
    },
    getStripe: () => ({
      webhooks: real.webhooks,
      subscriptions: { retrieve: subscriptionsRetrieveMock },
    }),
  };
});

// Email is dynamic-imported by the route and wrapped in try/catch; we mock
// it to keep test output clean.
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Route under test — imported after mocks are set up.
const { POST } = await import("@/app/api/stripe/webhook/route");

beforeEach(() => {
  subscriptionsRetrieveMock.mockReset();
});

describe("POST /api/stripe/webhook — signature handling", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const event = stripeEvent("invoice.paid", {});
    const req = stripeRequest(event, { sigOverride: null });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing stripe-signature/i);
  });

  it("returns 400 when signature verification fails", async () => {
    const event = stripeEvent("invoice.paid", {});
    const req = stripeRequest(event, { sigOverride: "t=1,v1=deadbeef" });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/webhook signature verification failed/i);
  });
});

describe("POST /api/stripe/webhook — checkout.session.completed (condo)", () => {
  it("creates Subscription, placeholder User, and ADMIN_SETUP Invitation", async () => {
    const plan = await makePlan({ slug: "small" });
    subscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_test_1",
      status: "trialing",
      trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    });

    const event = stripeEvent("checkout.session.completed", {
      id: "cs_test_1",
      subscription: "sub_test_1",
      customer: "cus_test_1",
      customer_email: "owner@example.com",
      customer_details: { email: "owner@example.com" },
      metadata: { planId: plan.id },
    });
    const req = stripeRequest(event);

    const res = await POST(req);
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: "sub_test_1" },
      include: { invitations: true, owner: true },
    });
    expect(sub).not.toBeNull();
    expect(sub!.planId).toBe(plan.id);
    expect(sub!.subscriptionStatus).toBe("TRIALING");
    expect(sub!.trialEndsAt).not.toBeNull();
    expect(sub!.stripeCustomerId).toBe("cus_test_1");

    // Placeholder user: isActive false, empty password, email matches.
    expect(sub!.owner.email).toBe("owner@example.com");
    expect(sub!.owner.isActive).toBe(false);
    expect(sub!.owner.passwordHash).toBe("");

    // ADMIN_SETUP invitation linked to the subscription.
    expect(sub!.invitations).toHaveLength(1);
    expect(sub!.invitations[0].type).toBe("ADMIN_SETUP");
    expect(sub!.invitations[0].status).toBe("PENDING");
    expect(sub!.invitations[0].email).toBe("owner@example.com");
  });

  it("is idempotent — duplicate event for same subscription id is a no-op", async () => {
    const plan = await makePlan({ slug: "small-2" });
    subscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_idem",
      status: "active",
      trial_end: null,
    });

    const event = stripeEvent("checkout.session.completed", {
      id: "cs_idem",
      subscription: "sub_idem",
      customer: "cus_idem",
      customer_email: "idem@example.com",
      customer_details: { email: "idem@example.com" },
      metadata: { planId: plan.id },
    });

    const r1 = await POST(stripeRequest(event));
    expect(r1.status).toBe(200);
    const r2 = await POST(stripeRequest(event));
    expect(r2.status).toBe(200);

    const subs = await prisma.subscription.findMany({
      where: { stripeSubscriptionId: "sub_idem" },
    });
    expect(subs).toHaveLength(1);
    const invites = await prisma.invitation.findMany({
      where: { subscriptionId: subs[0].id },
    });
    expect(invites).toHaveLength(1);
  });
});

describe("POST /api/stripe/webhook — checkout.session.completed (contractor)", () => {
  it("promotes the contractor org to the purchased plan", async () => {
    const { org } = await makeContractorOrg();
    subscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_contractor_1",
      items: {
        data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }],
      },
    });

    const event = stripeEvent("checkout.session.completed", {
      id: "cs_contractor",
      subscription: "sub_contractor_1",
      customer: "cus_contractor_1",
      metadata: { product: "contractor", contractorOrgId: org.id, plan: "PRO" },
    });

    const res = await POST(stripeRequest(event));
    expect(res.status).toBe(200);

    const updated = await prisma.contractorOrg.findUnique({
      where: { id: org.id },
    });
    expect(updated!.plan).toBe("PRO");
    expect(updated!.planStatus).toBe("ACTIVE");
    expect(updated!.trialEndsAt).toBeNull();
    expect(updated!.stripeCustomerId).toBe("cus_contractor_1");
    expect(updated!.stripeSubscriptionId).toBe("sub_contractor_1");
    expect(updated!.currentPeriodEndsAt).not.toBeNull();
  });
});

describe("POST /api/stripe/webhook — invoice events", () => {
  async function seedSubscription(stripeSubscriptionId: string) {
    const plan = await makePlan();
    const owner = await makeStandaloneUser();
    return prisma.subscription.create({
      data: {
        name: owner.name,
        email: owner.email,
        planId: plan.id,
        ownerId: owner.id,
        stripeSubscriptionId,
        subscriptionStatus: "TRIALING",
      },
    });
  }

  it("invoice.paid sets the subscription status to ACTIVE", async () => {
    const seeded = await seedSubscription("sub_paid_1");

    const event = stripeEvent("invoice.paid", {
      id: "in_paid_1",
      parent: { subscription_details: { subscription: "sub_paid_1" } },
    });

    const res = await POST(stripeRequest(event));
    expect(res.status).toBe(200);

    const after = await prisma.subscription.findUnique({
      where: { id: seeded.id },
    });
    expect(after!.subscriptionStatus).toBe("ACTIVE");
  });

  it("invoice.payment_failed sets the subscription status to PAST_DUE", async () => {
    const seeded = await seedSubscription("sub_failed_1");

    const event = stripeEvent("invoice.payment_failed", {
      id: "in_failed_1",
      parent: { subscription_details: { subscription: "sub_failed_1" } },
    });

    const res = await POST(stripeRequest(event));
    expect(res.status).toBe(200);

    const after = await prisma.subscription.findUnique({
      where: { id: seeded.id },
    });
    expect(after!.subscriptionStatus).toBe("PAST_DUE");
  });
});

describe("POST /api/stripe/webhook — customer.subscription.updated (condo)", () => {
  it("freezes excess buildings when downgrading to a smaller plan", async () => {
    const bigPlan = await makePlan({
      slug: "big",
      maxBuildings: 5,
      stripePriceId: "price_big",
    });
    const smallPlan = await makePlan({
      slug: "small-down",
      maxBuildings: 1,
      stripePriceId: "price_small",
    });
    const owner = await makeStandaloneUser();
    const sub = await prisma.subscription.create({
      data: {
        name: owner.name,
        email: owner.email,
        planId: bigPlan.id,
        ownerId: owner.id,
        stripeSubscriptionId: "sub_downgrade_1",
        subscriptionStatus: "ACTIVE",
      },
    });
    // Three buildings under the big plan; we'll downgrade to small (max 1).
    const buildingA = await prisma.building.create({
      data: { name: "A", address: "1", city: "x", zipCode: "1011", subscriptionId: sub.id },
    });
    const buildingB = await prisma.building.create({
      data: { name: "B", address: "2", city: "x", zipCode: "1011", subscriptionId: sub.id },
    });
    const buildingC = await prisma.building.create({
      data: { name: "C", address: "3", city: "x", zipCode: "1011", subscriptionId: sub.id },
    });

    const event = stripeEvent("customer.subscription.updated", {
      id: "sub_downgrade_1",
      status: "active",
      items: { data: [{ price: { id: "price_small" } }] },
    });

    const res = await POST(stripeRequest(event));
    expect(res.status).toBe(200);

    const after = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(after!.planId).toBe(smallPlan.id);

    const frozen = await prisma.building.findMany({
      where: { subscriptionId: sub.id, isFrozen: true },
      orderBy: { createdAt: "asc" },
    });
    // Current behavior: handler queries buildings DESC by createdAt then
    // slices(0, excessCount) — i.e. the *newest* excess buildings are
    // frozen. Test locks this in. If the policy ever changes (e.g. freeze
    // oldest first), this assertion needs to change too.
    expect(frozen).toHaveLength(2);
    const frozenIds = frozen.map((b) => b.id).sort();
    expect(frozenIds).toEqual([buildingB.id, buildingC.id].sort());

    const stillActive = await prisma.building.findUnique({ where: { id: buildingA.id } });
    expect(stillActive!.isFrozen).toBe(false);
  });
});

describe("POST /api/stripe/webhook — customer.subscription.deleted", () => {
  it("condo: sets subscription status to CANCELED", async () => {
    const plan = await makePlan();
    const owner = await makeStandaloneUser();
    const sub = await prisma.subscription.create({
      data: {
        name: owner.name,
        email: owner.email,
        planId: plan.id,
        ownerId: owner.id,
        stripeSubscriptionId: "sub_cancel_1",
        subscriptionStatus: "ACTIVE",
      },
    });

    const event = stripeEvent("customer.subscription.deleted", {
      id: "sub_cancel_1",
      status: "canceled",
    });

    const res = await POST(stripeRequest(event));
    expect(res.status).toBe(200);

    const after = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(after!.subscriptionStatus).toBe("CANCELED");
  });

  it("contractor: drops plan to FREE and clears period end", async () => {
    const { org } = await makeContractorOrg();
    await prisma.contractorOrg.update({
      where: { id: org.id },
      data: {
        plan: "PRO",
        planStatus: "ACTIVE",
        stripeSubscriptionId: "sub_contractor_cancel",
        currentPeriodEndsAt: new Date(),
      },
    });

    const event = stripeEvent("customer.subscription.deleted", {
      id: "sub_contractor_cancel",
      status: "canceled",
      metadata: { product: "contractor", contractorOrgId: org.id },
    });

    const res = await POST(stripeRequest(event));
    expect(res.status).toBe(200);

    const after = await prisma.contractorOrg.findUnique({ where: { id: org.id } });
    expect(after!.plan).toBe("FREE");
    expect(after!.planStatus).toBe("CANCELLED");
    expect(after!.currentPeriodEndsAt).toBeNull();
  });
});

// Note on cross-tenant assertions:
// The webhook does not perform cross-org reads — it's invoked by Stripe with
// an explicit subscription/customer id, and every handler scopes its query to
// that one entity. The tenant-isolation property the refactor guards (one
// org/building cannot read another's data) does not apply at this surface.
// The paired-tenant fixture pattern still helps when neighboring orgs exist;
// none of these tests touched a sibling, which is intentional.
