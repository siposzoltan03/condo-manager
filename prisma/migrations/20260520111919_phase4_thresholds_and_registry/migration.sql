-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "annualCashflowHUF" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "representativeRegisteredAt" TIMESTAMP(3),
ADD COLUMN     "representativeRegistryDeadline" TIMESTAMP(3) NOT NULL DEFAULT '2026-10-31 23:59:59+02'::timestamptz,
ADD COLUMN     "requiresAuditCommittee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresExternalAuditor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresProfessionalManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "szmszRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalUnits" INTEGER NOT NULL DEFAULT 0;
