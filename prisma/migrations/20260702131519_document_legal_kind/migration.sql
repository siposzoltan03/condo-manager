-- CreateEnum
CREATE TYPE "LegalDocKind" AS ENUM ('FOUNDING_DEED', 'SZMSZ', 'HOUSE_RULES', 'COMBINED', 'OTHER');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "kind" "LegalDocKind";

-- CreateIndex
CREATE INDEX "Document_kind_idx" ON "Document"("kind");
