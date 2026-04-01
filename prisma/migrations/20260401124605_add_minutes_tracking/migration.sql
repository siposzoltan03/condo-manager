-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "minutesUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "minutesUpdatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_minutesUpdatedById_fkey" FOREIGN KEY ("minutesUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
