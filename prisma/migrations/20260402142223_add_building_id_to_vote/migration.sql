-- AlterTable: add buildingId as nullable first
ALTER TABLE "Vote" ADD COLUMN "buildingId" TEXT;

-- Backfill: set buildingId from the linked meeting
UPDATE "Vote" SET "buildingId" = (
  SELECT "buildingId" FROM "Meeting" WHERE "Meeting"."id" = "Vote"."meetingId"
) WHERE "meetingId" IS NOT NULL;

-- Backfill: for standalone votes (no meeting), use the creator's active building
UPDATE "Vote" SET "buildingId" = (
  SELECT "buildingId" FROM "UserBuilding" WHERE "UserBuilding"."userId" = "Vote"."createdById" LIMIT 1
) WHERE "buildingId" IS NULL;

-- Now make it required
ALTER TABLE "Vote" ALTER COLUMN "buildingId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Vote_buildingId_idx" ON "Vote"("buildingId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
