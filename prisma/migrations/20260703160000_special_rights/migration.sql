-- CreateEnum
CREATE TYPE "SpecialRightKind" AS ENUM ('EXCLUSIVE_USE', 'PRE_EMPTION', 'PARKING', 'STORAGE', 'OTHER');

-- CreateTable
CREATE TABLE "SpecialRight" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitId" TEXT,
    "kind" "SpecialRightKind" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "areaSize" DOUBLE PRECISION,
    "sourceVersionId" TEXT,
    "sourceSection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialRight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialRight_buildingId_idx" ON "SpecialRight"("buildingId");

-- CreateIndex
CREATE INDEX "SpecialRight_unitId_idx" ON "SpecialRight"("unitId");

-- AddForeignKey
ALTER TABLE "SpecialRight" ADD CONSTRAINT "SpecialRight_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialRight" ADD CONSTRAINT "SpecialRight_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialRight" ADD CONSTRAINT "SpecialRight_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
