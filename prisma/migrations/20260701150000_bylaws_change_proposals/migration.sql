-- CreateEnum
CREATE TYPE "BylawsProposalStatus" AS ENUM ('PENDING_VOTE', 'APPLIED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Building" ALTER COLUMN "representativeRegistryDeadline" SET DEFAULT '2026-10-31 23:59:59+02'::timestamptz;

-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "linkedBylawsProposalId" TEXT;

-- CreateTable
CREATE TABLE "BylawsChangeProposal" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "reserveTargetHUF" BIGINT,
    "defaultMajority" "MajorityType",
    "costAllocationBasis" "CostAllocationBasis",
    "status" "BylawsProposalStatus" NOT NULL DEFAULT 'PENDING_VOTE',
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BylawsChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BylawsChangeProposal_buildingId_status_idx" ON "BylawsChangeProposal"("buildingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_linkedBylawsProposalId_key" ON "Vote"("linkedBylawsProposalId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_linkedBylawsProposalId_fkey" FOREIGN KEY ("linkedBylawsProposalId") REFERENCES "BylawsChangeProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BylawsChangeProposal" ADD CONSTRAINT "BylawsChangeProposal_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

