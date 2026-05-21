-- Phase 5/6: contractor invoice flow + paid → VERIFIED handoff.

CREATE TYPE "MarketplaceInvoiceStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "MarketplaceInvoice" (
  "id"            TEXT NOT NULL,
  "bidId"         TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "grossAmount"   DECIMAL(12, 2) NOT NULL,
  "issuedAt"      TIMESTAMP(3) NOT NULL,
  "dueAt"         TIMESTAMP(3) NOT NULL,
  "storageKey"    TEXT,
  "fileName"      TEXT,
  "status"        "MarketplaceInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt"        TIMESTAMP(3),
  "paidById"      TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceInvoice_bidId_key"
  ON "MarketplaceInvoice" ("bidId");

CREATE INDEX "MarketplaceInvoice_status_idx"
  ON "MarketplaceInvoice" ("status");

ALTER TABLE "MarketplaceInvoice"
  ADD CONSTRAINT "MarketplaceInvoice_bidId_fkey"
  FOREIGN KEY ("bidId")
  REFERENCES "MarketplaceBid" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
