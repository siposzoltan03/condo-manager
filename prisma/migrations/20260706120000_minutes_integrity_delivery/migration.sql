-- CreateTable
CREATE TABLE "MeetingMinutesVersion" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sealedById" TEXT NOT NULL,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingMinutesVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinutesDelivery" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "AnnouncementChannel" NOT NULL,
    "externalId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinutesDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingMinutesVersion_meetingId_idx" ON "MeetingMinutesVersion"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingMinutesVersion_meetingId_versionNumber_key" ON "MeetingMinutesVersion"("meetingId", "versionNumber");

-- CreateIndex
CREATE INDEX "MinutesDelivery_meetingId_status_idx" ON "MinutesDelivery"("meetingId", "status");

-- CreateIndex
CREATE INDEX "MinutesDelivery_userId_idx" ON "MinutesDelivery"("userId");

-- AddForeignKey
ALTER TABLE "MeetingMinutesVersion" ADD CONSTRAINT "MeetingMinutesVersion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMinutesVersion" ADD CONSTRAINT "MeetingMinutesVersion_sealedById_fkey" FOREIGN KEY ("sealedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinutesDelivery" ADD CONSTRAINT "MinutesDelivery_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinutesDelivery" ADD CONSTRAINT "MinutesDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
