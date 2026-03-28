/*
  Warnings:

  - You are about to drop the column `isPrimaryContact` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `unitId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[buildingId,name]` on the table `ForumCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[buildingId,number]` on the table `Unit` will be added. If there are existing duplicate values, this will fail.
  - Made the column `buildingId` on table `Account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `Announcement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `Complaint` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `DocumentCategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `ForumCategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `MaintenanceTicket` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `Meeting` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `ScheduledMaintenance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `buildingId` on table `Unit` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "Complaint" DROP CONSTRAINT "Complaint_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentCategory" DROP CONSTRAINT "DocumentCategory_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "ForumCategory" DROP CONSTRAINT "ForumCategory_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceTicket" DROP CONSTRAINT "MaintenanceTicket_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledMaintenance" DROP CONSTRAINT "ScheduledMaintenance_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_unitId_fkey";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Announcement" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Complaint" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DocumentCategory" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ForumCategory" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MaintenanceTicket" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Meeting" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ScheduledMaintenance" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "buildingId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isPrimaryContact",
DROP COLUMN "role",
DROP COLUMN "unitId";

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE UNIQUE INDEX "ForumCategory_buildingId_name_key" ON "ForumCategory"("buildingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_buildingId_number_key" ON "Unit"("buildingId", "number");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMaintenance" ADD CONSTRAINT "ScheduledMaintenance_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategory" ADD CONSTRAINT "DocumentCategory_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
