-- CreateEnum
CREATE TYPE "MinutesSignatureRole" AS ENUM ('CHAIR', 'AUTHENTICATOR_1', 'AUTHENTICATOR_2');

-- CreateTable
CREATE TABLE "MeetingMinutesSignature" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "role" "MinutesSignatureRole" NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "MeetingMinutesSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingMinutesSignature_meetingId_role_key" ON "MeetingMinutesSignature"("meetingId", "role");

-- CreateIndex
CREATE INDEX "MeetingMinutesSignature_signerId_idx" ON "MeetingMinutesSignature"("signerId");

-- AddForeignKey
ALTER TABLE "MeetingMinutesSignature" ADD CONSTRAINT "MeetingMinutesSignature_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMinutesSignature" ADD CONSTRAINT "MeetingMinutesSignature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
