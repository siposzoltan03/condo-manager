/**
 * @deprecated This migration script was used during the transition from single-building
 * to multi-building schema (Phase 2). It is no longer applicable since the old columns
 * (User.role, User.unitId, User.isPrimaryContact) and nullable buildingId fields have
 * been removed in Phase 4. Kept for historical reference only.
 */

import { PrismaClient, BuildingRole, UnitRelationship } from "@prisma/client";

const prisma = new PrismaClient();

function toBuildingRole(role: string): BuildingRole {
  switch (role) {
    case "SUPER_ADMIN":
      return BuildingRole.SUPER_ADMIN;
    case "ADMIN":
      return BuildingRole.ADMIN;
    case "BOARD_MEMBER":
      return BuildingRole.BOARD_MEMBER;
    case "RESIDENT":
      return BuildingRole.RESIDENT;
    case "TENANT":
      return BuildingRole.TENANT;
    default:
      return BuildingRole.RESIDENT;
  }
}

async function main() {
  console.log("This migration script is deprecated (Phase 4 complete).");
  console.log("The old columns have been removed. Use the seed script instead.");
  process.exit(0);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Migration failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
