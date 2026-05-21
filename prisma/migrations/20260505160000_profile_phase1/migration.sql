-- Phase 1 of profile redesign: extra contact fields, soft-delete tombstone,
-- board permissions table, board resignation workflow.

-- User: contact + identity + soft-delete
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "secondaryEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "secondaryEmailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "permanentAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "mailingAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- Board permissions catalog
CREATE TABLE "BoardPermission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "descriptionKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BoardPermission_key_key" ON "BoardPermission"("key");

-- Per-user-per-building permission grants
CREATE TABLE "UserBuildingPermission" (
    "id" TEXT NOT NULL,
    "userBuildingId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBuildingPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserBuildingPermission_userBuildingId_permissionId_key" ON "UserBuildingPermission"("userBuildingId", "permissionId");
CREATE INDEX "UserBuildingPermission_userBuildingId_idx" ON "UserBuildingPermission"("userBuildingId");
ALTER TABLE "UserBuildingPermission"
  ADD CONSTRAINT "UserBuildingPermission_userBuildingId_fkey"
  FOREIGN KEY ("userBuildingId") REFERENCES "UserBuilding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBuildingPermission"
  ADD CONSTRAINT "UserBuildingPermission_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "BoardPermission"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Resignation workflow
CREATE TYPE "ResignationStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'WITHDRAWN');

CREATE TABLE "BoardResignation" (
    "id" TEXT NOT NULL,
    "userBuildingId" TEXT NOT NULL,
    "status" "ResignationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "meetingId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardResignation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BoardResignation_userBuildingId_idx" ON "BoardResignation"("userBuildingId");
CREATE INDEX "BoardResignation_status_idx" ON "BoardResignation"("status");
ALTER TABLE "BoardResignation"
  ADD CONSTRAINT "BoardResignation_userBuildingId_fkey"
  FOREIGN KEY ("userBuildingId") REFERENCES "UserBuilding"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoardResignation"
  ADD CONSTRAINT "BoardResignation_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
