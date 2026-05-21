-- DropForeignKey
ALTER TABLE "ContractorRating" DROP CONSTRAINT "ContractorRating_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_contractorUserId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropIndex
DROP INDEX "MaintenanceTicket_awardedContractorId_idx";

-- AlterTable
ALTER TABLE "ComplaintCategory" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ComplaintStatusEvent" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PendingAgendaItem" ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserBuilding" ADD COLUMN     "accreditationDocumentId" TEXT,
ADD COLUMN     "accreditationVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "accreditationVerifiedById" TEXT,
ADD COLUMN     "isChair" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProfessional" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "UserBuilding" ADD CONSTRAINT "UserBuilding_accreditationVerifiedById_fkey" FOREIGN KEY ("accreditationVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contractorUserId_fkey" FOREIGN KEY ("contractorUserId") REFERENCES "ContractorUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorRating" ADD CONSTRAINT "ContractorRating_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tht. § 27(2)–(3) — at most one chair per building. Partial unique index
-- (Prisma DSL doesn't express this natively; ships as raw SQL).
CREATE UNIQUE INDEX "UserBuilding_buildingId_chair_unique"
  ON "UserBuilding" ("buildingId")
  WHERE "isChair" = true;
