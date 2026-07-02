-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "ownershipShareSourceVersionId" TEXT;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_ownershipShareSourceVersionId_fkey" FOREIGN KEY ("ownershipShareSourceVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
