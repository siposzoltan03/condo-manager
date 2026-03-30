import {
  PrismaClient,
  AccountType,
  BuildingRole,
  UnitRelationship,
} from "@prisma/client";
import bcrypt from "bcryptjs";

// Production guard: refuse to run seed in production
if (process.env.NODE_ENV === "production") {
  console.error("FATAL: Refusing to seed database in production environment.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database (multi-building)...");

  // Cleanup in correct FK order — new tables first, then existing
  await prisma.invitation.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.unitUser.deleteMany();
  await prisma.userBuilding.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.documentCategory.deleteMany();
  await prisma.scheduledMaintenance.deleteMany();
  await prisma.contractorRating.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.contractor.deleteMany();
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
  await prisma.proxyAssignment.deleteMany();
  await prisma.ballot.deleteMany();
  await prisma.voteOption.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.meetingRsvp.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.building.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 12);

  // ─── Plans ────────────────────────────────────────────────────────────────────

  const starterPlan = await prisma.plan.upsert({
    where: { slug: "starter" },
    update: {},
    create: {
      name: "Starter",
      slug: "starter",
      maxBuildings: 1,
      maxUnitsPerBuilding: 30,
      features: ["complaints", "announcements", "messaging", "documents"],
      priceMonthly: 9.99,
      priceYearly: 99.99,
      trialDays: 14,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { slug: "pro" },
    update: {},
    create: {
      name: "Professional",
      slug: "pro",
      maxBuildings: 5,
      maxUnitsPerBuilding: 100,
      features: [
        "complaints", "announcements", "messaging", "documents",
        "finance", "voting", "maintenance", "forum",
      ],
      priceMonthly: 29.99,
      priceYearly: 299.99,
      trialDays: 14,
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { slug: "enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      slug: "enterprise",
      maxBuildings: -1,
      maxUnitsPerBuilding: -1,
      features: [
        "complaints", "announcements", "messaging", "documents",
        "finance", "voting", "maintenance", "forum",
        "api_access", "custom_branding", "audit_exports",
      ],
      priceMonthly: 99.99,
      priceYearly: 999.99,
      trialDays: 14,
    },
  });

  const legacyPlan = await prisma.plan.upsert({
    where: { slug: "legacy" },
    update: {},
    create: {
      name: "Legacy",
      slug: "legacy",
      maxBuildings: -1,
      maxUnitsPerBuilding: -1,
      features: [
        "complaints", "announcements", "messaging", "documents",
        "finance", "voting", "maintenance", "forum",
        "api_access", "custom_branding", "audit_exports",
      ],
      priceMonthly: 0,
      priceYearly: 0,
      trialDays: 0,
      isActive: false,
    },
  });

  // ─── Buildings ──────────────────────────────────────────────────────────────

  const building1 = await prisma.building.create({
    data: {
      name: "Duna Residence",
      address: "Fő utca 12",
      city: "Budapest",
      zipCode: "1011",
    },
  });

  const building2 = await prisma.building.create({
    data: {
      name: "Margit Apartments",
      address: "Margit körút 45",
      city: "Budapest",
      zipCode: "1024",
    },
  });

  // ─── Units — Building 1 (5 units) ──────────────────────────────────────────

  const b1_unit1A = await prisma.unit.create({
    data: {
      number: "1A",
      floor: 0,
      ownershipShare: 0.22,
      size: 65.5,
      buildingId: building1.id,
    },
  });

  const b1_unit1B = await prisma.unit.create({
    data: {
      number: "1B",
      floor: 0,
      ownershipShare: 0.18,
      size: 52.0,
      buildingId: building1.id,
    },
  });

  const b1_unit2A = await prisma.unit.create({
    data: {
      number: "2A",
      floor: 1,
      ownershipShare: 0.22,
      size: 65.5,
      buildingId: building1.id,
    },
  });

  const b1_unit2B = await prisma.unit.create({
    data: {
      number: "2B",
      floor: 1,
      ownershipShare: 0.18,
      size: 52.0,
      buildingId: building1.id,
    },
  });

  const b1_unit3A = await prisma.unit.create({
    data: {
      number: "3A",
      floor: 2,
      ownershipShare: 0.2,
      size: 78.3,
      buildingId: building1.id,
    },
  });

  // ─── Units — Building 2 (3 units) ──────────────────────────────────────────

  const b2_unit1A = await prisma.unit.create({
    data: {
      number: "1A",
      floor: 0,
      ownershipShare: 0.35,
      size: 70.0,
      buildingId: building2.id,
    },
  });

  const b2_unit1B = await prisma.unit.create({
    data: {
      number: "1B",
      floor: 0,
      ownershipShare: 0.3,
      size: 60.0,
      buildingId: building2.id,
    },
  });

  const b2_unit2A = await prisma.unit.create({
    data: {
      number: "2A",
      floor: 1,
      ownershipShare: 0.35,
      size: 70.0,
      buildingId: building2.id,
    },
  });

  // ─── Users ──────────────────────────────────────────────────────────────────
  // Roles and unit assignments are now via UserBuilding and UnitUser tables

  // Super admin — in BOTH buildings
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@condo.local",
      passwordHash,
      name: "Nagy István",
      language: "hu",
    },
  });

  // ─── Legacy Subscription ──────────────────────────────────────────────────────

  const legacySubscription = await prisma.subscription.upsert({
    where: { id: "legacy-subscription" },
    update: {},
    create: {
      id: "legacy-subscription",
      name: "Legacy",
      email: superAdmin.email,
      planId: legacyPlan.id,
      subscriptionStatus: "ACTIVE",
      ownerId: superAdmin.id,
    },
  });

  // Assign both buildings to the legacy subscription
  await prisma.building.update({
    where: { id: building1.id },
    data: { subscriptionId: legacySubscription.id },
  });
  await prisma.building.update({
    where: { id: building2.id },
    data: { subscriptionId: legacySubscription.id },
  });

  // Admin — building 1 only
  const admin = await prisma.user.create({
    data: {
      email: "admin@condo.local",
      passwordHash,
      name: "Kovács Mária",
      language: "hu",
    },
  });

  // Board member — building 1
  const boardMember1 = await prisma.user.create({
    data: {
      email: "board@condo.local",
      passwordHash,
      name: "Szabó Péter",
      language: "hu",
    },
  });

  // 3 residents — building 1
  const resident1 = await prisma.user.create({
    data: {
      email: "resident1@condo.local",
      passwordHash,
      name: "Tóth Anna",
      language: "hu",
    },
  });

  const resident2 = await prisma.user.create({
    data: {
      email: "resident2@condo.local",
      passwordHash,
      name: "Horváth László",
      language: "hu",
    },
  });

  const resident3 = await prisma.user.create({
    data: {
      email: "resident3@condo.local",
      passwordHash,
      name: "Varga Katalin",
      language: "hu",
    },
  });

  // 2 tenants — building 1
  const tenant1 = await prisma.user.create({
    data: {
      email: "tenant1@condo.local",
      passwordHash,
      name: "Molnár Gábor",
      language: "hu",
    },
  });

  const tenant2 = await prisma.user.create({
    data: {
      email: "tenant2@condo.local",
      passwordHash,
      name: "Kiss Éva",
      language: "hu",
    },
  });

  // 2 residents — building 2
  const b2_resident1 = await prisma.user.create({
    data: {
      email: "b2resident1@condo.local",
      passwordHash,
      name: "Fekete Zoltán",
      language: "hu",
    },
  });

  const b2_resident2 = await prisma.user.create({
    data: {
      email: "b2resident2@condo.local",
      passwordHash,
      name: "Balogh Eszter",
      language: "hu",
    },
  });

  // 1 board member — building 2
  const b2_boardMember = await prisma.user.create({
    data: {
      email: "b2board@condo.local",
      passwordHash,
      name: "Farkas Tamás",
      language: "hu",
    },
  });

  // ─── UserBuilding — role per building ───────────────────────────────────────

  await prisma.userBuilding.createMany({
    data: [
      // Super admin in BOTH buildings
      { userId: superAdmin.id, buildingId: building1.id, role: BuildingRole.SUPER_ADMIN },
      { userId: superAdmin.id, buildingId: building2.id, role: BuildingRole.SUPER_ADMIN },
      // Building 1 users
      { userId: admin.id, buildingId: building1.id, role: BuildingRole.ADMIN },
      { userId: boardMember1.id, buildingId: building1.id, role: BuildingRole.BOARD_MEMBER },
      { userId: resident1.id, buildingId: building1.id, role: BuildingRole.RESIDENT },
      { userId: resident2.id, buildingId: building1.id, role: BuildingRole.RESIDENT },
      { userId: resident3.id, buildingId: building1.id, role: BuildingRole.RESIDENT },
      { userId: tenant1.id, buildingId: building1.id, role: BuildingRole.TENANT },
      { userId: tenant2.id, buildingId: building1.id, role: BuildingRole.TENANT },
      // Building 2 users
      { userId: b2_resident1.id, buildingId: building2.id, role: BuildingRole.RESIDENT },
      { userId: b2_resident2.id, buildingId: building2.id, role: BuildingRole.RESIDENT },
      { userId: b2_boardMember.id, buildingId: building2.id, role: BuildingRole.BOARD_MEMBER },
    ],
  });

  // ─── UnitUser — user-unit relationships ─────────────────────────────────────

  await prisma.unitUser.createMany({
    data: [
      // Building 1
      { userId: superAdmin.id, unitId: b1_unit1A.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
      { userId: admin.id, unitId: b1_unit1B.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
      { userId: boardMember1.id, unitId: b1_unit2A.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
      { userId: resident1.id, unitId: b1_unit2B.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
      { userId: resident2.id, unitId: b1_unit3A.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
      { userId: resident3.id, unitId: b1_unit1A.id, relationship: UnitRelationship.OWNER, isPrimaryContact: false },
      { userId: tenant1.id, unitId: b1_unit2A.id, relationship: UnitRelationship.TENANT, isPrimaryContact: false },
      { userId: tenant2.id, unitId: b1_unit2B.id, relationship: UnitRelationship.TENANT, isPrimaryContact: false },
      // Building 2
      { userId: b2_resident1.id, unitId: b2_unit1A.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
      { userId: b2_resident2.id, unitId: b2_unit1B.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
      { userId: b2_boardMember.id, unitId: b2_unit2A.id, relationship: UnitRelationship.OWNER, isPrimaryContact: true },
    ],
  });

  // ─── Forum Categories — per building ────────────────────────────────────────

  const forumCategoriesData = [
    { name: "General", description: "General discussion about the condo community", sortOrder: 0 },
    { name: "Noise Complaints", description: "Discuss and report noise-related issues", sortOrder: 1 },
    { name: "Suggestions", description: "Ideas and suggestions for improving the community", sortOrder: 2 },
    { name: "Maintenance Tips", description: "Share and discuss maintenance tips and tricks", sortOrder: 3 },
  ];

  await prisma.forumCategory.createMany({
    data: [
      ...forumCategoriesData.map((c) => ({ ...c, buildingId: building1.id })),
      ...forumCategoriesData.map((c) => ({ ...c, buildingId: building2.id })),
    ],
  });

  // ─── Chart of Accounts — per building ───────────────────────────────────────

  const accountsData = [
    // EXPENSE accounts
    { name: "Maintenance", type: AccountType.EXPENSE },
    { name: "Utilities", type: AccountType.EXPENSE },
    { name: "Insurance", type: AccountType.EXPENSE },
    { name: "Reserve Fund Contribution", type: AccountType.EXPENSE },
    { name: "Management Fees", type: AccountType.EXPENSE },
    { name: "Security", type: AccountType.EXPENSE },
    // INCOME accounts
    { name: "Common Charges", type: AccountType.INCOME },
    { name: "Other Income", type: AccountType.INCOME },
    // ASSET accounts
    { name: "Current Fund", type: AccountType.ASSET },
    { name: "Reserve Fund", type: AccountType.ASSET },
    // LIABILITY accounts
    { name: "Accounts Payable", type: AccountType.LIABILITY },
  ];

  await prisma.account.createMany({
    data: [
      ...accountsData.map((a) => ({ ...a, buildingId: building1.id })),
      ...accountsData.map((a) => ({ ...a, buildingId: building2.id })),
    ],
  });

  // ─── Contractors — global (no buildingId) ───────────────────────────────────

  await prisma.contractor.createMany({
    data: [
      {
        name: "Kovács Kft.",
        specialty: "Plumbing",
        contactInfo: "+36 30 123 4567, kovacs@plumbing.hu",
        taxId: "12345678-2-41",
      },
      {
        name: "ElektroFix Bt.",
        specialty: "Electrical",
        contactInfo: "+36 20 987 6543, info@elektrofix.hu",
        taxId: "87654321-1-42",
      },
      {
        name: "MasterBuild Zrt.",
        specialty: "Structural",
        contactInfo: "+36 1 555 0100, office@masterbuild.hu",
        taxId: "11223344-2-43",
      },
    ],
  });

  // ─── Document Categories — per building ─────────────────────────────────────

  for (const bId of [building1.id, building2.id]) {
    const contractsCategory = await prisma.documentCategory.create({
      data: { name: "Contracts", sortOrder: 1, buildingId: bId },
    });
    await prisma.documentCategory.create({
      data: { name: "Rules & Regulations", sortOrder: 0, buildingId: bId },
    });
    await prisma.documentCategory.createMany({
      data: [
        { name: "Vendor Agreements", parentId: contractsCategory.id, sortOrder: 0, buildingId: bId },
        { name: "Staff Contracts", parentId: contractsCategory.id, sortOrder: 1, buildingId: bId },
      ],
    });
    await prisma.documentCategory.createMany({
      data: [
        { name: "Meeting Minutes", sortOrder: 2, buildingId: bId },
        { name: "Financial Reports", sortOrder: 3, buildingId: bId },
        { name: "Insurance", sortOrder: 4, buildingId: bId },
        { name: "Other", sortOrder: 5, buildingId: bId },
      ],
    });
  }

  // ─── Scheduled Maintenance — per building ───────────────────────────────────

  await prisma.scheduledMaintenance.createMany({
    data: [
      // Building 1
      {
        title: "Elevator annual inspection",
        description: "Mandatory annual safety inspection of both elevators.",
        date: new Date("2026-04-15T09:00:00Z"),
        isRecurring: true,
        recurrenceRule: "Every 12 months",
        buildingId: building1.id,
      },
      {
        title: "Fire extinguisher check",
        description: "Inspect and certify all fire extinguishers in common areas.",
        date: new Date("2026-05-01T10:00:00Z"),
        isRecurring: true,
        recurrenceRule: "Every 6 months",
        buildingId: building1.id,
      },
      // Building 2
      {
        title: "Elevator annual inspection",
        description: "Mandatory annual safety inspection of the elevator.",
        date: new Date("2026-04-20T09:00:00Z"),
        isRecurring: true,
        recurrenceRule: "Every 12 months",
        buildingId: building2.id,
      },
      {
        title: "Heating system maintenance",
        description: "Annual heating system check and maintenance.",
        date: new Date("2026-09-15T08:00:00Z"),
        isRecurring: true,
        recurrenceRule: "Every 12 months",
        buildingId: building2.id,
      },
    ],
  });

  console.log("Seeding complete.");
  console.log("  - 4 plans created (Starter, Professional, Enterprise, Legacy)");
  console.log("  - 1 legacy subscription created (assigned to super admin)");
  console.log("  - 2 buildings created (Duna Residence, Margit Apartments)");
  console.log("  - 2 buildings linked to legacy subscription");
  console.log("  - 8 units created (5 in building 1, 3 in building 2)");
  console.log("  - 11 users created (password: password123)");
  console.log("  - 12 user-building assignments");
  console.log("  - 11 unit-user relationships");
  console.log("  - 8 forum categories (4 per building)");
  console.log("  - 22 accounts (11 per building)");
  console.log("  - 3 contractors (global)");
  console.log("  - 14 document categories (7 per building)");
  console.log("  - 4 scheduled maintenance entries (2 per building)");
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
