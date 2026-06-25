-- CreateEnum
CREATE TYPE "MajorityType" AS ENUM ('SIMPLE_MAJORITY', 'TWO_THIRDS', 'FOUR_FIFTHS', 'UNANIMOUS', 'PLURALITY');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "isRepeated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "majorityType" "MajorityType" NOT NULL DEFAULT 'SIMPLE_MAJORITY';

-- CreateTable
CREATE TABLE "MeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT true,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingAttendance_meetingId_idx" ON "MeetingAttendance"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendance_meetingId_unitId_key" ON "MeetingAttendance"("meetingId", "unitId");

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
