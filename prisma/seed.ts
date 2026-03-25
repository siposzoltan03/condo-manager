import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  // Create 5 units
  const unit1A = await prisma.unit.create({
    data: {
      number: "1A",
      floor: 0,
      ownershipShare: 0.2200,
      size: 65.50,
    },
  });

  const unit1B = await prisma.unit.create({
    data: {
      number: "1B",
      floor: 0,
      ownershipShare: 0.1800,
      size: 52.00,
    },
  });

  const unit2A = await prisma.unit.create({
    data: {
      number: "2A",
      floor: 1,
      ownershipShare: 0.2200,
      size: 65.50,
    },
  });

  const unit2B = await prisma.unit.create({
    data: {
      number: "2B",
      floor: 1,
      ownershipShare: 0.1800,
      size: 52.00,
    },
  });

  const unit3A = await prisma.unit.create({
    data: {
      number: "3A",
      floor: 2,
      ownershipShare: 0.2000,
      size: 78.30,
    },
  });

  // Create 8 users across all roles
  await prisma.user.createMany({
    data: [
      {
        email: "superadmin@condo.local",
        passwordHash,
        name: "Nagy István",
        role: Role.SUPER_ADMIN,
        unitId: unit1A.id,
        isPrimaryContact: true,
        language: "hu",
      },
      {
        email: "admin@condo.local",
        passwordHash,
        name: "Kovács Mária",
        role: Role.ADMIN,
        unitId: unit1B.id,
        isPrimaryContact: true,
        language: "hu",
      },
      {
        email: "board@condo.local",
        passwordHash,
        name: "Szabó Péter",
        role: Role.BOARD_MEMBER,
        unitId: unit2A.id,
        isPrimaryContact: true,
        language: "hu",
      },
      {
        email: "resident1@condo.local",
        passwordHash,
        name: "Tóth Anna",
        role: Role.RESIDENT,
        unitId: unit2B.id,
        isPrimaryContact: true,
        language: "hu",
      },
      {
        email: "resident2@condo.local",
        passwordHash,
        name: "Horváth László",
        role: Role.RESIDENT,
        unitId: unit3A.id,
        isPrimaryContact: true,
        language: "hu",
      },
      {
        email: "resident3@condo.local",
        passwordHash,
        name: "Varga Katalin",
        role: Role.RESIDENT,
        unitId: unit1A.id,
        isPrimaryContact: false,
        language: "hu",
      },
      {
        email: "tenant1@condo.local",
        passwordHash,
        name: "Molnár Gábor",
        role: Role.TENANT,
        unitId: unit2A.id,
        isPrimaryContact: false,
        language: "hu",
      },
      {
        email: "tenant2@condo.local",
        passwordHash,
        name: "Kiss Éva",
        role: Role.TENANT,
        unitId: unit2B.id,
        isPrimaryContact: false,
        language: "hu",
      },
    ],
  });

  console.log("Seeding complete.");
  console.log("  - 5 units created");
  console.log("  - 8 users created (password: password123)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
