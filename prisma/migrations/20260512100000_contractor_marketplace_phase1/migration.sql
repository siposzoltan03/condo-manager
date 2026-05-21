-- ────────────────────────────────────────────────────────────────────────────
-- Contractor Marketplace · Phase 1 foundation
-- ────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "ContractorPlan" AS ENUM ('FREE', 'PRO', 'PREMIUM');
CREATE TYPE "ContractorOrgStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELISTED');
CREATE TYPE "ContractorUserRole" AS ENUM ('OWNER', 'STAFF');
CREATE TYPE "MarketplacePublishStatus" AS ENUM ('DRAFT', 'OPEN', 'AWARDED', 'CLOSED');
CREATE TYPE "MarketplaceBidStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'REJECTED', 'WON');

-- ──────────────── ContractorOrg ─────────────────────────────────────────────
CREATE TABLE "ContractorOrg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "navConfirmedAt" TIMESTAMP(3),
    "specialties" JSONB NOT NULL DEFAULT '[]',
    "regions" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "stripeCustomerId" TEXT,
    "plan" "ContractorPlan" NOT NULL DEFAULT 'FREE',
    "planStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "status" "ContractorOrgStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "legacyContractorId" TEXT,
    "dpaSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorOrg_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractorOrg_taxId_key" ON "ContractorOrg"("taxId");
CREATE UNIQUE INDEX "ContractorOrg_stripeCustomerId_key" ON "ContractorOrg"("stripeCustomerId");
CREATE UNIQUE INDEX "ContractorOrg_legacyContractorId_key" ON "ContractorOrg"("legacyContractorId");
CREATE INDEX "ContractorOrg_status_idx" ON "ContractorOrg"("status");
CREATE INDEX "ContractorOrg_plan_idx" ON "ContractorOrg"("plan");

ALTER TABLE "ContractorOrg" ADD CONSTRAINT "ContractorOrg_legacyContractorId_fkey"
  FOREIGN KEY ("legacyContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────── ContractorUser ────────────────────────────────────────────
CREATE TABLE "ContractorUser" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "ContractorUserRole" NOT NULL DEFAULT 'OWNER',
    "emailVerifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notificationPreferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractorUser_email_key" ON "ContractorUser"("email");
CREATE INDEX "ContractorUser_orgId_idx" ON "ContractorUser"("orgId");

ALTER TABLE "ContractorUser" ADD CONSTRAINT "ContractorUser_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "ContractorOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────── ContractorDocument ────────────────────────────────────────
CREATE TABLE "ContractorDocument" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractorDocument_orgId_kind_idx" ON "ContractorDocument"("orgId", "kind");

ALTER TABLE "ContractorDocument" ADD CONSTRAINT "ContractorDocument_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "ContractorOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────── MarketplacePublication ────────────────────────────────────
CREATE TABLE "MarketplacePublication" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "status" "MarketplacePublishStatus" NOT NULL DEFAULT 'OPEN',
    "scrubbedTitle" TEXT NOT NULL,
    "scrubbedDescription" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "budgetBand" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "specialties" JSONB NOT NULL DEFAULT '[]',
    "revealAddressOnAward" BOOLEAN NOT NULL DEFAULT true,
    "revealUnitOnAward" BOOLEAN NOT NULL DEFAULT false,
    "revealOwnerPhoneOnAward" BOOLEAN NOT NULL DEFAULT false,
    "boardContactEmail" TEXT NOT NULL,
    "boardContactPhone" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT NOT NULL,
    "publisherDisplayName" TEXT NOT NULL,
    "awardedBidId" TEXT,
    "awardedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,

    CONSTRAINT "MarketplacePublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplacePublication_ticketId_key" ON "MarketplacePublication"("ticketId");
CREATE UNIQUE INDEX "MarketplacePublication_awardedBidId_key" ON "MarketplacePublication"("awardedBidId");
CREATE INDEX "MarketplacePublication_status_publishedAt_idx" ON "MarketplacePublication"("status", "publishedAt");
CREATE INDEX "MarketplacePublication_city_idx" ON "MarketplacePublication"("city");
CREATE INDEX "MarketplacePublication_category_idx" ON "MarketplacePublication"("category");

ALTER TABLE "MarketplacePublication" ADD CONSTRAINT "MarketplacePublication_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplacePublication" ADD CONSTRAINT "MarketplacePublication_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────── MarketplaceBid ────────────────────────────────────────────
CREATE TABLE "MarketplaceBid" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "etaDays" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "MarketplaceBidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceBid_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceBid_publicationId_bidderId_key" ON "MarketplaceBid"("publicationId", "bidderId");
CREATE INDEX "MarketplaceBid_bidderId_status_idx" ON "MarketplaceBid"("bidderId", "status");
CREATE INDEX "MarketplaceBid_status_idx" ON "MarketplaceBid"("status");

ALTER TABLE "MarketplaceBid" ADD CONSTRAINT "MarketplaceBid_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "MarketplacePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceBid" ADD CONSTRAINT "MarketplaceBid_bidderId_fkey"
  FOREIGN KEY ("bidderId") REFERENCES "ContractorOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Now that the bid table exists we can add the awardedBid FK on publications.
ALTER TABLE "MarketplacePublication" ADD CONSTRAINT "MarketplacePublication_awardedBidId_fkey"
  FOREIGN KEY ("awardedBidId") REFERENCES "MarketplaceBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────── MarketplaceMessage ────────────────────────────────────────
CREATE TABLE "MarketplaceMessage" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "senderSide" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceMessage_publicationId_bidderId_createdAt_idx" ON "MarketplaceMessage"("publicationId", "bidderId", "createdAt");

ALTER TABLE "MarketplaceMessage" ADD CONSTRAINT "MarketplaceMessage_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "MarketplacePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceMessage" ADD CONSTRAINT "MarketplaceMessage_bidderId_fkey"
  FOREIGN KEY ("bidderId") REFERENCES "ContractorOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────── MarketplaceFitScore ───────────────────────────────────────
CREATE TABLE "MarketplaceFitScore" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "weightsVersion" TEXT NOT NULL,
    "factorsJson" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceFitScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceFitScore_bidId_key" ON "MarketplaceFitScore"("bidId");
CREATE INDEX "MarketplaceFitScore_publicationId_score_idx" ON "MarketplaceFitScore"("publicationId", "score");

ALTER TABLE "MarketplaceFitScore" ADD CONSTRAINT "MarketplaceFitScore_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "MarketplacePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceFitScore" ADD CONSTRAINT "MarketplaceFitScore_bidId_fkey"
  FOREIGN KEY ("bidId") REFERENCES "MarketplaceBid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────── MaintenanceTicket.awardedContractorId ─────────────────────
ALTER TABLE "MaintenanceTicket" ADD COLUMN "awardedContractorId" TEXT;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_awardedContractorId_fkey"
  FOREIGN KEY ("awardedContractorId") REFERENCES "ContractorOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MaintenanceTicket_awardedContractorId_idx" ON "MaintenanceTicket"("awardedContractorId");
