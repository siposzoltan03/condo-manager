-- CreateEnum
CREATE TYPE "CostAllocationBasis" AS ENUM ('OWNERSHIP_SHARE', 'EQUAL', 'AREA');

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "costAllocationBasis" "CostAllocationBasis" NOT NULL DEFAULT 'OWNERSHIP_SHARE',
ADD COLUMN     "defaultMajority" "MajorityType" NOT NULL DEFAULT 'SIMPLE_MAJORITY',
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "reserveTargetHUF" BIGINT NOT NULL DEFAULT 0,
ALTER COLUMN "representativeRegistryDeadline" SET DEFAULT '2026-10-31 23:59:59+02'::timestamptz;
