-- CreateEnum
CREATE TYPE "ResidentRemovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Building" ALTER COLUMN "representativeRegistryDeadline" SET DEFAULT '2026-10-31 23:59:59+02'::timestamptz;

-- CreateTable
CREATE TABLE "ResidentRemovalRequest" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "targetUserBuildingId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ResidentRemovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidentRemovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResidentRemovalRequest_buildingId_status_idx" ON "ResidentRemovalRequest"("buildingId", "status");

-- CreateIndex
CREATE INDEX "ResidentRemovalRequest_targetUserBuildingId_idx" ON "ResidentRemovalRequest"("targetUserBuildingId");

-- AddForeignKey
ALTER TABLE "ResidentRemovalRequest" ADD CONSTRAINT "ResidentRemovalRequest_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentRemovalRequest" ADD CONSTRAINT "ResidentRemovalRequest_targetUserBuildingId_fkey" FOREIGN KEY ("targetUserBuildingId") REFERENCES "UserBuilding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
