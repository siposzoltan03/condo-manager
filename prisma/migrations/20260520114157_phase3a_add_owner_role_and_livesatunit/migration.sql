-- AlterEnum
ALTER TYPE "BuildingRole" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "Building" ALTER COLUMN "representativeRegistryDeadline" SET DEFAULT '2026-10-31 23:59:59+02'::timestamptz;

-- AlterTable
ALTER TABLE "UnitUser" ADD COLUMN     "livesAtUnit" BOOLEAN NOT NULL DEFAULT false;
