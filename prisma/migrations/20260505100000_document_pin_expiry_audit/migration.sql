-- Add pinning, expiry, and audit counters to Document.
ALTER TABLE "Document" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "lastAccessedAt" TIMESTAMP(3);

CREATE INDEX "Document_isPinned_idx" ON "Document"("isPinned");
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");
