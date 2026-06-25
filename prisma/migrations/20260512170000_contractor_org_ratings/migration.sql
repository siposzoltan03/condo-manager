-- Phase 5 step 1: allow ratings on ContractorOrg (marketplace contractors)
-- while preserving legacy Contractor ratings. Exactly one of
-- contractorId / contractorOrgId must be set in app code.

ALTER TABLE "ContractorRating"
  ALTER COLUMN "contractorId" DROP NOT NULL;

ALTER TABLE "ContractorRating"
  ADD COLUMN "contractorOrgId" TEXT;

ALTER TABLE "ContractorRating"
  ADD CONSTRAINT "ContractorRating_contractorOrgId_fkey"
  FOREIGN KEY ("contractorOrgId") REFERENCES "ContractorOrg"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContractorRating_contractorOrgId_idx"
  ON "ContractorRating" ("contractorOrgId");
