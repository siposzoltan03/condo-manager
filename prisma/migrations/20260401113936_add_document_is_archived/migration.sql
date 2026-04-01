-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Document_isArchived_idx" ON "Document"("isArchived");
