-- CreateEnum
CREATE TYPE "BuildingRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BOARD_MEMBER', 'RESIDENT', 'TENANT');

-- CreateEnum
CREATE TYPE "UnitRelationship" AS ENUM ('OWNER', 'TENANT');

-- DropIndex
DROP INDEX "ForumCategory_name_key";

-- DropIndex
DROP INDEX "Unit_number_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "DocumentCategory" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "ForumCategory" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceTicket" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "ScheduledMaintenance" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "buildingId" TEXT;

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBuilding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "role" "BuildingRole" NOT NULL DEFAULT 'RESIDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "relationship" "UnitRelationship" NOT NULL DEFAULT 'OWNER',
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBuilding_buildingId_idx" ON "UserBuilding"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBuilding_userId_buildingId_key" ON "UserBuilding"("userId", "buildingId");

-- CreateIndex
CREATE INDEX "UnitUser_unitId_idx" ON "UnitUser"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitUser_userId_unitId_key" ON "UnitUser"("userId", "unitId");

-- CreateIndex
CREATE INDEX "Account_buildingId_idx" ON "Account"("buildingId");

-- CreateIndex
CREATE INDEX "Announcement_buildingId_idx" ON "Announcement"("buildingId");

-- CreateIndex
CREATE INDEX "Complaint_buildingId_idx" ON "Complaint"("buildingId");

-- CreateIndex
CREATE INDEX "DocumentCategory_buildingId_idx" ON "DocumentCategory"("buildingId");

-- CreateIndex
CREATE INDEX "ForumCategory_buildingId_idx" ON "ForumCategory"("buildingId");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_buildingId_idx" ON "MaintenanceTicket"("buildingId");

-- CreateIndex
CREATE INDEX "Meeting_buildingId_idx" ON "Meeting"("buildingId");

-- CreateIndex
CREATE INDEX "ScheduledMaintenance_buildingId_idx" ON "ScheduledMaintenance"("buildingId");

-- AddForeignKey
ALTER TABLE "UserBuilding" ADD CONSTRAINT "UserBuilding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBuilding" ADD CONSTRAINT "UserBuilding_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitUser" ADD CONSTRAINT "UnitUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitUser" ADD CONSTRAINT "UnitUser_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMaintenance" ADD CONSTRAINT "ScheduledMaintenance_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategory" ADD CONSTRAINT "DocumentCategory_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
