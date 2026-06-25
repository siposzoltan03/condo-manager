-- Two-factor authentication: TOTP secret + enrollment marker + backup codes.

ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnrolledAt" TIMESTAMP(3);

CREATE TABLE "BackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BackupCode_codeHash_key" ON "BackupCode"("codeHash");
CREATE INDEX "BackupCode_userId_idx" ON "BackupCode"("userId");
ALTER TABLE "BackupCode"
  ADD CONSTRAINT "BackupCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
