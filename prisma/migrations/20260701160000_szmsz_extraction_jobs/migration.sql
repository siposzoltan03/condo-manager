-- AlterTable
ALTER TABLE "Building" ALTER COLUMN "representativeRegistryDeadline" SET DEFAULT '2026-10-31 23:59:59+02'::timestamptz;

-- CreateTable
CREATE TABLE "SzmszExtractionJob" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SzmszExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SzmszExtractionJob_buildingId_status_idx" ON "SzmszExtractionJob"("buildingId", "status");

-- AddForeignKey
ALTER TABLE "SzmszExtractionJob" ADD CONSTRAINT "SzmszExtractionJob_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

