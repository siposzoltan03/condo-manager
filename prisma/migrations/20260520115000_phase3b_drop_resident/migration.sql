-- Phase 3b — drop the legacy RESIDENT enum value. All UserBuilding rows
-- with role = 'RESIDENT' were migrated to 'OWNER' in Phase 3a.
--
-- Postgres can't directly drop enum values, so we rebuild the enum:
-- rename old → create new without RESIDENT → cast every column that
-- uses the type → drop old.
--
-- Tables using BuildingRole: UserBuilding.role, Invitation.role.

ALTER TYPE "BuildingRole" RENAME TO "BuildingRole_old";

CREATE TYPE "BuildingRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BOARD_MEMBER', 'OWNER', 'TENANT');

ALTER TABLE "UserBuilding"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "BuildingRole" USING "role"::text::"BuildingRole",
  ALTER COLUMN "role" SET DEFAULT 'OWNER';

ALTER TABLE "Invitation"
  ALTER COLUMN "role" TYPE "BuildingRole" USING "role"::text::"BuildingRole";

DROP TYPE "BuildingRole_old";
