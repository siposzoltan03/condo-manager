import { PrismaClient, Role, AccountType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Cleanup in correct order to respect foreign keys
  await prisma.budget.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.monthlyCharge.deleteMany();
  await prisma.account.deleteMany();
  await prisma.complaintNote.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.forumReply.deleteMany();
  await prisma.forumTopic.deleteMany();
  await prisma.forumCategory.deleteMany();
  await prisma.announcementRead.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();

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

  // Create chart of accounts
  await Promise.all([
    // EXPENSE accounts
    prisma.account.create({ data: { name: "Maintenance", type: AccountType.EXPENSE } }),
    prisma.account.create({ data: { name: "Utilities", type: AccountType.EXPENSE } }),
    prisma.account.create({ data: { name: "Insurance", type: AccountType.EXPENSE } }),
    prisma.account.create({ data: { name: "Reserve Fund Contribution", type: AccountType.EXPENSE } }),
    prisma.account.create({ data: { name: "Management Fees", type: AccountType.EXPENSE } }),
    prisma.account.create({ data: { name: "Security", type: AccountType.EXPENSE } }),
    // INCOME accounts
    prisma.account.create({ data: { name: "Common Charges", type: AccountType.INCOME } }),
    prisma.account.create({ data: { name: "Other Income", type: AccountType.INCOME } }),
    // ASSET accounts
    prisma.account.create({ data: { name: "Current Fund", type: AccountType.ASSET } }),
    prisma.account.create({ data: { name: "Reserve Fund", type: AccountType.ASSET } }),
    // LIABILITY accounts
    prisma.account.create({ data: { name: "Accounts Payable", type: AccountType.LIABILITY } }),
  ]);

  // Create forum categories
  await prisma.forumCategory.createMany({
    data: [
      { name: "General", description: "General discussion about the condo community", sortOrder: 0 },
      { name: "Noise Complaints", description: "Discuss and report noise-related issues", sortOrder: 1 },
      { name: "Suggestions", description: "Ideas and suggestions for improving the community", sortOrder: 2 },
      { name: "Maintenance Tips", description: "Share and discuss maintenance tips and tricks", sortOrder: 3 },
    ],
  });

  console.log("Seeding complete.");
  console.log("  - 5 units created");
  console.log("  - 8 users created (password: password123)");
  console.log("  - 11 chart of accounts created");
  console.log("  - 4 forum categories created");
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
