import { PrismaClient, BuildingRole, UnitRelationship } from "@prisma/client";

/**
 * Data migration script: migrates existing single-building data to multi-building model.
 *
 * Creates a default building "Duna Residence" and assigns all existing entities to it.
 * Creates UserBuilding and UnitUser records from existing User.role/unitId/isPrimaryContact.
 *
 * Safe to run multiple times — checks if migration was already done.
 */

const prisma = new PrismaClient();

// Map old Role enum to BuildingRole
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
  console.log("Starting multi-building data migration...");

  // Check if a building already exists (idempotency guard)
  const existingBuilding = await prisma.building.findFirst();
  if (existingBuilding) {
    console.log("Migration already applied — buildings exist. Skipping.");
    return;
  }

  // 1. Create default building
  const building = await prisma.building.create({
    data: {
      name: "Duna Residence",
      address: "Fő utca 12",
      city: "Budapest",
      zipCode: "1011",
    },
  });
  console.log(`Created default building: ${building.name} (${building.id})`);

  // 2. Assign all existing units to the building
  const unitUpdateResult = await prisma.unit.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log(`Assigned ${unitUpdateResult.count} units to ${building.name}`);

  // 3. Create UnitUser and UserBuilding from existing users
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Create UserBuilding
    await prisma.userBuilding.create({
      data: {
        userId: user.id,
        buildingId: building.id,
        role: toBuildingRole(user.role),
        isActive: user.isActive,
      },
    });

    // Create UnitUser (only if user has a unitId)
    if (user.unitId) {
      const relationship =
        user.role === "TENANT" ? UnitRelationship.TENANT : UnitRelationship.OWNER;

      await prisma.unitUser.create({
        data: {
          userId: user.id,
          unitId: user.unitId,
          relationship,
          isPrimaryContact: user.isPrimaryContact,
        },
      });
    }
  }
  console.log(`Created UserBuilding + UnitUser for ${users.length} users`);

  // 4. Set buildingId on all scoped entities
  await prisma.announcement.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated announcements");

  await prisma.forumCategory.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated forum categories");

  await prisma.complaint.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated complaints");

  await prisma.account.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated accounts");

  await prisma.maintenanceTicket.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated maintenance tickets");

  await prisma.scheduledMaintenance.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated scheduled maintenance");

  await prisma.meeting.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated meetings");

  await prisma.documentCategory.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log("Updated document categories");

  console.log("Multi-building data migration complete.");
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
