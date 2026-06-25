-- AlterTable
ALTER TABLE "Ballot" ADD COLUMN     "castById" TEXT;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_castById_fkey" FOREIGN KEY ("castById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
