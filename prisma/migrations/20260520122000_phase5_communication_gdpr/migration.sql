-- Phase 5 — Tht. § 25, § 33/A, § 40(3), § 43/A + GDPR Art. 5(1)(c), Art. 28 + NAIH.

-- ── 5a: announcement delivery proof (Tht. § 33/A, § 40(3), § 43/A) ──────────
CREATE TYPE "AnnouncementChannel" AS ENUM ('EMAIL', 'PUSH', 'PHYSICAL_BOARD', 'SMS');

CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'DELIVERED', 'FAILED', 'ACK_REQUIRED');

CREATE TABLE "AnnouncementDelivery" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT,
  "channel" "AnnouncementChannel" NOT NULL,
  "externalId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "deliveredAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnnouncementDelivery_messageId_status_idx" ON "AnnouncementDelivery"("messageId", "status");
CREATE INDEX "AnnouncementDelivery_userId_idx" ON "AnnouncementDelivery"("userId");
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChannelMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5b: Contractor DPA pointer (GDPR Art. 28) ──────────────────────────────
ALTER TABLE "Contractor" ADD COLUMN "dataProcessingAgreementDocumentId" TEXT;
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_dataProcessingAgreementDocumentId_fkey"
  FOREIGN KEY ("dataProcessingAgreementDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5c: BuildingCamera + CameraAccessLog (Tht. § 25, NAIH) ─────────────────
CREATE TABLE "BuildingCamera" (
  "id" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "installedByVoteId" TEXT,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retentionDays" INTEGER NOT NULL DEFAULT 15,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "BuildingCamera_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BuildingCamera_buildingId_idx" ON "BuildingCamera"("buildingId");
ALTER TABLE "BuildingCamera" ADD CONSTRAINT "BuildingCamera_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CameraAccessLog" (
  "id" TEXT NOT NULL,
  "cameraId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CameraAccessLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CameraAccessLog_cameraId_reviewedAt_idx" ON "CameraAccessLog"("cameraId", "reviewedAt");
CREATE INDEX "CameraAccessLog_reviewerId_idx" ON "CameraAccessLog"("reviewerId");
ALTER TABLE "CameraAccessLog" ADD CONSTRAINT "CameraAccessLog_cameraId_fkey"
  FOREIGN KEY ("cameraId") REFERENCES "BuildingCamera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CameraAccessLog" ADD CONSTRAINT "CameraAccessLog_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 5d: arrears disclosure mode (NAIH) ──────────────────────────────────────
CREATE TYPE "ArrearsDisclosureMode" AS ENUM ('INTERNAL_ONLY', 'CLOSED_DELIVERY');
ALTER TABLE "Building" ADD COLUMN "arrearsDisclosureMode" "ArrearsDisclosureMode" NOT NULL DEFAULT 'INTERNAL_ONLY';

-- ── 5e: tenant contact consent (Tht. § 22(2) + GDPR Art. 6) ─────────────────
ALTER TABLE "UnitUser" ADD COLUMN "contactConsentAt" TIMESTAMP(3);
ALTER TABLE "UnitUser" ADD COLUMN "contactConsentMode" TEXT;
