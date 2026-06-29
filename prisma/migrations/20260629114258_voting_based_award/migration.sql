-- Voting-based contractor award: link a Vote to a marketplace publication,
-- map each VoteOption to a bid, and add a PENDING_VOTE publication state.

-- AlterEnum
ALTER TYPE "MarketplacePublishStatus" ADD VALUE 'PENDING_VOTE';

-- AlterTable
ALTER TABLE "Vote" ADD COLUMN "linkedPublicationId" TEXT;

-- AlterTable
ALTER TABLE "VoteOption" ADD COLUMN "bidId" TEXT;

-- CreateIndex
CREATE INDEX "Vote_linkedPublicationId_idx" ON "Vote"("linkedPublicationId");

-- CreateIndex
CREATE INDEX "VoteOption_bidId_idx" ON "VoteOption"("bidId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_linkedPublicationId_fkey" FOREIGN KEY ("linkedPublicationId") REFERENCES "MarketplacePublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteOption" ADD CONSTRAINT "VoteOption_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "MarketplaceBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
