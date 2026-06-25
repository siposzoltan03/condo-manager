-- Phase 2 — Tht. § 27(3) audit committee + § 51/A registered auditor.

-- Add the new role + kind enums.
ALTER TYPE "BuildingRole" ADD VALUE 'AUDITOR';

CREATE TYPE "AuditorKind" AS ENUM ('COMMITTEE_MEMBER', 'COMMITTEE_CHAIR', 'REGISTERED_AUDITOR');

-- New table.
CREATE TABLE "AuditorMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "kind" "AuditorKind" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditorMembership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditorMembership_buildingId_kind_idx" ON "AuditorMembership"("buildingId", "kind");
CREATE INDEX "AuditorMembership_userId_idx" ON "AuditorMembership"("userId");

ALTER TABLE "AuditorMembership" ADD CONSTRAINT "AuditorMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditorMembership" ADD CONSTRAINT "AuditorMembership_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tht. § 27(3) — at most one active COMMITTEE_CHAIR per building.
-- Partial unique index keyed off (buildingId) restricted to active
-- (endedAt IS NULL) committee-chair rows.
CREATE UNIQUE INDEX "AuditorMembership_buildingId_committeeChair_unique"
  ON "AuditorMembership" ("buildingId")
  WHERE "kind" = 'COMMITTEE_CHAIR' AND "endedAt" IS NULL;
