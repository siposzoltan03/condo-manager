import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Billing Data Access Layer.
 *
 * Owns prisma writes for `Subscription`, `Plan` lookups, contractor-side
 * plan-state on `ContractorOrg`, and the `Building.isFrozen` flip on
 * downgrade. The Stripe webhook handlers in `./webhook-handlers.ts`
 * compose these — no handler imports prisma directly.
 */

type Db = typeof prisma | Prisma.TransactionClient;

export async function runTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}

// ────────────────────────────────────────────────────────────────────────
// Subscription (condo side)
// ────────────────────────────────────────────────────────────────────────

export async function findSubscriptionByStripeId(
  stripeSubscriptionId: string,
) {
  return prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
}

export async function findSubscriptionWithPlanAndBuildings(
  stripeSubscriptionId: string,
) {
  return prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: {
      plan: true,
      buildings: {
        select: { id: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function updateSubscriptionStatus(
  id: string,
  subscriptionStatus:
    | "TRIALING"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "EXPIRED",
) {
  return prisma.subscription.update({
    where: { id },
    data: { subscriptionStatus },
  });
}

export async function updateSubscriptionStatusAndPlan(
  id: string,
  data: {
    subscriptionStatus:
      | "TRIALING"
      | "ACTIVE"
      | "PAST_DUE"
      | "CANCELED"
      | "EXPIRED";
    planId: string;
  },
) {
  return prisma.subscription.update({
    where: { id },
    data,
  });
}

/**
 * Creates Subscription + placeholder User + ADMIN_SETUP Invitation in a
 * single transaction. Used by `checkout.session.completed` on the condo
 * side, where the buyer doesn't have an account yet.
 */
export async function createSubscriptionWithPlaceholder(input: {
  email: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  planId: string;
  subscriptionStatus: "TRIALING" | "ACTIVE";
  trialEndsAt: Date | null;
  invitationTokenHash: string;
  invitationExpiresAt: Date;
}) {
  return runTransaction(async (tx) => {
    const placeholderUser = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: "",
        name: input.email.split("@")[0],
        isActive: false,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        name: input.email,
        email: input.email,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        planId: input.planId,
        subscriptionStatus: input.subscriptionStatus,
        trialEndsAt: input.trialEndsAt,
        ownerId: placeholderUser.id,
      },
    });

    await tx.invitation.create({
      data: {
        email: input.email,
        tokenHash: input.invitationTokenHash,
        type: "ADMIN_SETUP",
        subscriptionId: subscription.id,
        expiresAt: input.invitationExpiresAt,
        status: "PENDING",
      },
    });

    return { subscription, placeholderUser };
  });
}

// ────────────────────────────────────────────────────────────────────────
// Plan
// ────────────────────────────────────────────────────────────────────────

export async function findPlanById(id: string) {
  return prisma.plan.findUnique({ where: { id } });
}

export async function findActivePlanByStripePriceId(stripePriceId: string) {
  return prisma.plan.findFirst({
    where: { stripePriceId, isActive: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Building (downgrade-freeze on subscription.updated)
// ────────────────────────────────────────────────────────────────────────

export async function freezeBuildings(buildingIds: string[], db: Db = prisma) {
  if (buildingIds.length === 0) return { count: 0 };
  return db.building.updateMany({
    where: { id: { in: buildingIds } },
    data: { isFrozen: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// ContractorOrg plan state
// ────────────────────────────────────────────────────────────────────────

export async function setContractorOrgPlanFromCheckout(
  orgId: string,
  data: {
    plan: "PRO" | "PREMIUM";
    stripeCustomerId: string | undefined;
    stripeSubscriptionId: string | undefined;
    currentPeriodEndsAt: Date | null;
  },
) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: {
      plan: data.plan,
      planStatus: "ACTIVE",
      trialEndsAt: null,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      currentPeriodEndsAt: data.currentPeriodEndsAt,
    },
  });
}

export async function setContractorOrgPlanStatusAndPeriod(
  orgId: string,
  data: {
    planStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
    currentPeriodEndsAt: Date | null;
  },
) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data,
  });
}

export async function downgradeContractorOrgToFree(orgId: string) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: {
      plan: "FREE",
      planStatus: "CANCELLED",
      currentPeriodEndsAt: null,
    },
  });
}
