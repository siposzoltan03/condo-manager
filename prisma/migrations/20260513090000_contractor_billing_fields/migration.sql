-- Phase 6: contractor-side Stripe linkage + trial expiry.
ALTER TABLE "ContractorOrg"
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEndsAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ContractorOrg_stripeSubscriptionId_key"
  ON "ContractorOrg" ("stripeSubscriptionId");
