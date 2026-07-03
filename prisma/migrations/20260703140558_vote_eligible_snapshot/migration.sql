-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "eligibleSnapshotAt" TIMESTAMP(3),
ADD COLUMN     "eligibleUnitCount" INTEGER,
ADD COLUMN     "eligibleUnitsHash" TEXT;
