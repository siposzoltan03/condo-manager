import {
  PrismaClient,
  AccountType,
  BuildingRole,
  UnitRelationship,
  MaintenanceCategory,
  Urgency,
  TicketStatus,
  ChargeStatus,
  ComplaintStatus,
  RsvpStatus,
  DocumentVisibility,
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
  await prisma.complaintStatusEvent.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.complaintCategory.deleteMany();
  await prisma.messageMention.deleteMany();
  await prisma.messageReaction.deleteMany();
  await prisma.pollVote.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.messageRead.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.channelMessage.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
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

  // Stable IDs across reseeds so JWT sessions don't become invalid when the
  // database is repopulated.
  const building1 = await prisma.building.create({
    data: {
      id: "seed_building_1",
      name: "Duna Residence",
      address: "Fő utca 12",
      city: "Budapest",
      zipCode: "1011",
    },
  });

  const building2 = await prisma.building.create({
    data: {
      id: "seed_building_2",
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
      floor: 1,
      stairwell: "A",
      positionOnFloor: 1,
      ownershipShare: 0.022,
      size: 65.5,
      buildingId: building1.id,
    },
  });

  const b1_unit1B = await prisma.unit.create({
    data: {
      number: "1B",
      floor: 1,
      stairwell: "A",
      positionOnFloor: 2,
      ownershipShare: 0.018,
      size: 52.0,
      buildingId: building1.id,
    },
  });

  const b1_unit2A = await prisma.unit.create({
    data: {
      number: "2A",
      floor: 2,
      stairwell: "A",
      positionOnFloor: 1,
      ownershipShare: 0.022,
      size: 65.5,
      buildingId: building1.id,
    },
  });

  const b1_unit2B = await prisma.unit.create({
    data: {
      number: "2B",
      floor: 2,
      stairwell: "A",
      positionOnFloor: 2,
      ownershipShare: 0.018,
      size: 52.0,
      buildingId: building1.id,
    },
  });

  const b1_unit3A = await prisma.unit.create({
    data: {
      number: "3A",
      floor: 3,
      stairwell: "A",
      positionOnFloor: 1,
      ownershipShare: 0.020,
      size: 78.3,
      buildingId: building1.id,
    },
  });

  // ─── Units — Building 2 (3 units) ──────────────────────────────────────────

  const b2_unit1A = await prisma.unit.create({
    data: {
      number: "1A",
      floor: 1,
      stairwell: "A",
      positionOnFloor: 1,
      ownershipShare: 0.35,
      size: 70.0,
      buildingId: building2.id,
    },
  });

  const b2_unit1B = await prisma.unit.create({
    data: {
      number: "1B",
      floor: 1,
      stairwell: "A",
      positionOnFloor: 2,
      ownershipShare: 0.3,
      size: 60.0,
      buildingId: building2.id,
    },
  });

  const b2_unit2A = await prisma.unit.create({
    data: {
      number: "2A",
      floor: 2,
      stairwell: "A",
      positionOnFloor: 1,
      ownershipShare: 0.35,
      size: 70.0,
      buildingId: building2.id,
    },
  });

  // ─── Users ──────────────────────────────────────────────────────────────────
  // Roles and unit assignments are now via UserBuilding and UnitUser tables

  // Super admin — in BOTH buildings. Stable id keeps JWT sessions valid
  // across reseeds.
  const superAdmin = await prisma.user.create({
    data: {
      id: "seed_user_superadmin",
      email: "superadmin@condo.local",
      passwordHash,
      name: "Nagy István",
      language: "hu",
      emailVerifiedAt: new Date(),
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

  // Assign both buildings to the legacy subscription.
  // Phase 4 (Tht. § 55/A–D): mark Building 1 as already registered with
  // the földhivatal so it doesn't show the deadline banner — useful for
  // testing the "compliant" path. Building 2 is left null so the banner
  // is visible in dev.
  await prisma.building.update({
    where: { id: building1.id },
    data: {
      subscriptionId: legacySubscription.id,
      representativeRegisteredAt: new Date(),
    },
  });
  await prisma.building.update({
    where: { id: building2.id },
    data: { subscriptionId: legacySubscription.id },
  });

  // Admin — building 1 only
  const admin = await prisma.user.create({
    data: {
      id: "seed_user_admin",
      email: "admin@condo.local",
      passwordHash,
      name: "Kovács Mária",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  // Board member — building 1
  const boardMember1 = await prisma.user.create({
    data: {
      id: "seed_user_board1",
      email: "board@condo.local",
      passwordHash,
      name: "Szabó Péter",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  // 3 residents — building 1
  const resident1 = await prisma.user.create({
    data: {
      id: "seed_user_resident1",
      email: "resident1@condo.local",
      passwordHash,
      name: "Tóth Anna",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  const resident2 = await prisma.user.create({
    data: {
      id: "seed_user_resident2",
      email: "resident2@condo.local",
      passwordHash,
      name: "Horváth László",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  const resident3 = await prisma.user.create({
    data: {
      id: "seed_user_resident3",
      email: "resident3@condo.local",
      passwordHash,
      name: "Varga Katalin",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  // 2 tenants — building 1
  const tenant1 = await prisma.user.create({
    data: {
      id: "seed_user_tenant1",
      email: "tenant1@condo.local",
      passwordHash,
      name: "Molnár Gábor",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  const tenant2 = await prisma.user.create({
    data: {
      id: "seed_user_tenant2",
      email: "tenant2@condo.local",
      passwordHash,
      name: "Kiss Éva",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  // 2 residents — building 2
  const b2_resident1 = await prisma.user.create({
    data: {
      id: "seed_user_b2resident1",
      email: "b2resident1@condo.local",
      passwordHash,
      name: "Fekete Zoltán",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  const b2_resident2 = await prisma.user.create({
    data: {
      id: "seed_user_b2resident2",
      email: "b2resident2@condo.local",
      passwordHash,
      name: "Balogh Eszter",
      language: "hu",
      emailVerifiedAt: new Date(),
    },
  });

  // 1 board member — building 2
  const b2_boardMember = await prisma.user.create({
    data: {
      id: "seed_user_b2board",
      email: "b2board@condo.local",
      passwordHash,
      name: "Farkas Tamás",
      language: "hu",
      emailVerifiedAt: new Date(),
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
      // Phase 1 (Tht. § 27, § 43): boardMember1 is the chair of Building 1.
      // Marking isProfessional = true here to test the professional-manager
      // flag without requiring a verified accreditation document.
      { userId: boardMember1.id, buildingId: building1.id, role: BuildingRole.BOARD_MEMBER, isChair: true, isProfessional: true },
      { userId: resident1.id, buildingId: building1.id, role: BuildingRole.OWNER },
      { userId: resident2.id, buildingId: building1.id, role: BuildingRole.OWNER },
      { userId: resident3.id, buildingId: building1.id, role: BuildingRole.OWNER },
      { userId: tenant1.id, buildingId: building1.id, role: BuildingRole.TENANT },
      { userId: tenant2.id, buildingId: building1.id, role: BuildingRole.TENANT },
      // Building 2 users
      { userId: b2_resident1.id, buildingId: building2.id, role: BuildingRole.OWNER },
      { userId: b2_resident2.id, buildingId: building2.id, role: BuildingRole.OWNER },
      // Phase 1: chair of Building 2 (non-professional, sole közös képviselő).
      { userId: b2_boardMember.id, buildingId: building2.id, role: BuildingRole.BOARD_MEMBER, isChair: true },
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

  // ─── Phase 2 — Tht. § 27(3) audit committee ─────────────────────────────────
  // Building 1 has >25 demo units (75 after demo seeding), so the law
  // requires a számvizsgáló bizottság. Wire up a chair + two members from
  // owner users so `hasActiveAuditCommittee()` returns true and the
  // Phase 4 banner stays hidden for the compliant test path.
  await prisma.auditorMembership.createMany({
    data: [
      { userId: resident1.id, buildingId: building1.id, kind: "COMMITTEE_CHAIR" },
      { userId: resident2.id, buildingId: building1.id, kind: "COMMITTEE_MEMBER" },
      { userId: resident3.id, buildingId: building1.id, kind: "COMMITTEE_MEMBER" },
    ],
  });

  // ─── Forum Categories — per building ────────────────────────────────────────

  // Communication channels are seeded together with messages further below
  // (after announcements/forum data is wired in).

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
        recurrenceMonths: 12,
        leadTimeDays: 14,
        buildingId: building1.id,
      },
      {
        title: "Fire extinguisher check",
        description: "Inspect and certify all fire extinguishers in common areas.",
        date: new Date("2026-05-01T10:00:00Z"),
        isRecurring: true,
        recurrenceMonths: 6,
        leadTimeDays: 7,
        buildingId: building1.id,
      },
      // Building 2
      {
        title: "Elevator annual inspection",
        description: "Mandatory annual safety inspection of the elevator.",
        date: new Date("2026-04-20T09:00:00Z"),
        isRecurring: true,
        recurrenceMonths: 12,
        leadTimeDays: 14,
        buildingId: building2.id,
      },
      {
        title: "Heating system maintenance",
        description: "Annual heating system check and maintenance.",
        date: new Date("2026-09-15T08:00:00Z"),
        isRecurring: true,
        recurrenceMonths: 12,
        leadTimeDays: 30,
        buildingId: building2.id,
      },
    ],
  });

  // ─── Communication channels — Building 1 ────────────────────────────────────
  // Each building gets a Hirdetőtábla (ANNOUNCEMENT) plus a couple of TOPIC
  // channels. All active members are subscribed.

  async function seedCommunicationFor(buildingId: string) {
    const members = await prisma.userBuilding.findMany({
      where: { buildingId, isActive: true },
      select: { userId: true },
    });

    const announceChannel = await prisma.channel.create({
      data: {
        buildingId,
        kind: "ANNOUNCEMENT",
        name: "Hirdetőtábla",
        isOfficial: true,
        isPrivate: false,
        members: { create: members.map((m) => ({ userId: m.userId })) },
      },
    });

    const generalChannel = await prisma.channel.create({
      data: {
        buildingId,
        kind: "TOPIC",
        name: "Általános",
        description: "Általános beszélgetés a közösségről",
        isOfficial: false,
        isPrivate: false,
        members: { create: members.map((m) => ({ userId: m.userId })) },
      },
    });

    return { announceChannel, generalChannel };
  }

  const b1Channels = await seedCommunicationFor(building1.id);
  await seedCommunicationFor(building2.id);

  await prisma.channelMessage.createMany({
    data: [
      {
        channelId: b1Channels.announceChannel.id,
        authorId: admin.id,
        kind: "POST",
        title: "Éves Közgyűlés — március 15.",
        body: "Tisztelt Lakók!\n\nEzúton értesítjük Önöket, hogy az éves közgyűlésre 2026. március 15-én, 18:00 órakor kerül sor a Duna Residence közösségi termében (fszt. 3.).\n\nNapirendi pontok:\n1. Az elmúlt év pénzügyi beszámolója\n2. 2026-os éves költségvetés jóváhagyása\n3. Közös területek felújítási terve\n4. Egyéb ügyek\n\nKérjük, hogy szavazati jogukat személyesen vagy meghatalmazott útján gyakorolják. A meghatalmazási nyomtatvány a portán átvehető.\n\nUdvariasan kérjük szíves megjelenésüket!\n\nKovács Mária\nHázkezelő",
        audience: { type: "all" },
        isPinned: true,
        createdAt: new Date("2026-03-01T09:00:00Z"),
      },
      {
        channelId: b1Channels.announceChannel.id,
        authorId: boardMember1.id,
        kind: "POST",
        title: "Vízvezeték-csere az északi szárnyban",
        body: "Kedves Lakók!\n\nTájékoztatjuk Önöket, hogy 2026. március 18–20. között (hétfőtől szerdáig) az északi szárny fővezetékének cseréjét végzik el a Kovács Kft. szakemberei.\n\nA munkálatok ideje alatt (08:00–17:00) a hideg vízszolgáltatás az érintett szárnyban szünetel.",
        audience: { type: "all" },
        createdAt: new Date("2026-03-10T11:30:00Z"),
      },
      {
        channelId: b1Channels.announceChannel.id,
        authorId: admin.id,
        kind: "POST",
        title: "Q1 Pénzügyi Audit Eredményei",
        body: "Kedves Igazgatótanács!\n\nAz I. negyedéves belső pénzügyi audit lezárult. Részletes riport a dokumentumtárban elérhető.",
        audience: { type: "board_only" },
        createdAt: new Date("2026-03-25T14:00:00Z"),
      },
      {
        channelId: b1Channels.announceChannel.id,
        authorId: boardMember1.id,
        kind: "POST",
        title: "Nyári Tetőterasz Összejövetel — június 21.",
        body: "Kedves Szomszédok!\n\nÖrömmel értesítjük Önöket, hogy idén is megrendezzük a hagyományos nyári tetőterasz bulit!\n\nIdőpont: 2026. június 21. (vasárnap), 17:00-tól\nHelyszín: Tetőterasz (4. emelet)",
        audience: { type: "all" },
        createdAt: new Date("2026-03-28T10:00:00Z"),
      },
    ],
  });

  // A small forum-style thread on the General TOPIC channel.
  const topicPost = await prisma.channelMessage.create({
    data: {
      channelId: b1Channels.generalChannel.id,
      authorId: resident1.id,
      kind: "POST",
      title: "Erkélyláda szabályok?",
      body: "Sziasztok!\n\nSzeretnék virágládákat kirakni az erkélykorlát külső oldalára, de nem vagyok biztos benne, hogy ez megengedett-e.",
      createdAt: new Date("2026-03-18T09:15:00Z"),
    },
  });
  await prisma.channelMessage.createMany({
    data: [
      {
        channelId: b1Channels.generalChannel.id,
        authorId: resident2.id,
        kind: "CHAT",
        body: "Érdeklődtem korábban a házkezelőnél — a korlát külső oldalán nem szabad, mert esővízzel lecsöpöghet az alattad lévők teraszára. Belső oldalon igen.",
        parentId: topicPost.id,
        createdAt: new Date("2026-03-18T11:30:00Z"),
      },
      {
        channelId: b1Channels.generalChannel.id,
        authorId: admin.id,
        kind: "CHAT",
        body: "Megerősítem. Az SZMSZ 4.3-as pontja szerint kültéri erkélykorlát külső felületén semmilyen tárgy nem rögzíthető tartósan.",
        parentId: topicPost.id,
        createdAt: new Date("2026-03-20T16:45:00Z"),
      },
    ],
  });

  // ─── Maintenance Tickets — Building 1 ───────────────────────────────────────

  const contractorKovacs = await prisma.contractor.findFirst({
    where: { name: "Kovács Kft." },
  });
  const contractorElektrofix = await prisma.contractor.findFirst({
    where: { name: "ElektroFix Bt." },
  });

  const ticket1 = await prisma.maintenanceTicket.create({
    data: {
      title: "Csöpögő csap a 2A lakásban",
      description:
        "A konyhai csap folyamatosan csöpög, az előző napi vízszámla is megemelkedett. Kérjük mielőbbi javítást, mivel a 2A alatti 1A lakásba is szivároghat.",
      category: MaintenanceCategory.PLUMBING,
      location: "2A lakás, konyha",
      urgency: Urgency.HIGH,
      status: TicketStatus.IN_PROGRESS,
      trackingNumber: "TKT-2026-001",
      reporterId: boardMember1.id,
      assignedContractorId: contractorKovacs?.id,
      buildingId: building1.id,
      createdAt: new Date("2026-03-15T10:00:00Z"),
      updatedAt: new Date("2026-03-17T14:30:00Z"),
    },
  });

  // Audit logs for ticket1 status transitions
  await prisma.auditLog.create({
    data: {
      entityType: "MaintenanceTicket",
      entityId: ticket1.id,
      action: "UPDATE",
      userId: admin.id,
      oldValue: { status: "SUBMITTED" },
      newValue: { status: "IN_PROGRESS" },
      createdAt: new Date("2026-03-16T09:00:00Z"),
    },
  });

  await prisma.ticketComment.createMany({
    data: [
      {
        ticketId: ticket1.id,
        authorId: admin.id,
        body: "Kovács Kft.-t értesítettük, helyszíni szemlét szerdára kértek be.",
        isInternal: false,
        createdAt: new Date("2026-03-16T09:00:00Z"),
      },
      {
        ticketId: ticket1.id,
        authorId: boardMember1.id,
        body: "A szerelő megérkezett, az alkatrészt meg kellett rendelni. 3–5 munkanapot mondott.",
        isInternal: false,
        createdAt: new Date("2026-03-17T14:30:00Z"),
      },
    ],
  });

  const ticket2 = await prisma.maintenanceTicket.create({
    data: {
      title: "B lift zörgő hangot ad",
      description:
        "A B lépcsőházi lift indításkor és megálláskor erős zörgő, kattogó hangot ad. Az utóbbi napokban már lassabban indul és megáll a szintek között egy másodpercre. Biztonságossági szempontból azonnali vizsgálatot kérünk.",
      category: MaintenanceCategory.ELEVATOR,
      location: "B lépcsőházi lift",
      urgency: Urgency.CRITICAL,
      status: TicketStatus.ACKNOWLEDGED,
      trackingNumber: "TKT-2026-002",
      reporterId: resident1.id,
      buildingId: building1.id,
      createdAt: new Date("2026-03-20T08:45:00Z"),
      updatedAt: new Date("2026-03-20T11:00:00Z"),
    },
  });

  // Audit log for ticket2 status transition
  await prisma.auditLog.create({
    data: {
      entityType: "MaintenanceTicket",
      entityId: ticket2.id,
      action: "UPDATE",
      userId: admin.id,
      oldValue: { status: "SUBMITTED" },
      newValue: { status: "ACKNOWLEDGED" },
      createdAt: new Date("2026-03-20T11:00:00Z"),
    },
  });

  const ticket3 = await prisma.maintenanceTicket.create({
    data: {
      title: "Villogó lámpa az előcsarnokban",
      description:
        "Az első emeleti folyosó egyik lámpateste villog, és már néhányszor kialudt teljesen. Valószínűleg a fogyasztó cseréje elegendő lesz.",
      category: MaintenanceCategory.ELECTRICAL,
      location: "1. emeleti folyosó, előcsarnok",
      urgency: Urgency.LOW,
      status: TicketStatus.COMPLETED,
      trackingNumber: "TKT-2026-003",
      reporterId: tenant2.id,
      assignedContractorId: contractorElektrofix?.id,
      buildingId: building1.id,
      createdAt: new Date("2026-03-05T15:20:00Z"),
      updatedAt: new Date("2026-03-08T12:00:00Z"),
    },
  });

  await prisma.ticketComment.createMany({
    data: [
      {
        ticketId: ticket3.id,
        authorId: admin.id,
        body: "ElektroFix Bt. elvégezte a fogyasztócsere munkálatait. A lámpa megfelelően működik.",
        isInternal: false,
        createdAt: new Date("2026-03-08T12:00:00Z"),
      },
    ],
  });

  // Audit logs for ticket3 status transitions
  await prisma.auditLog.createMany({
    data: [
      {
        entityType: "MaintenanceTicket",
        entityId: ticket3.id,
        action: "UPDATE",
        userId: admin.id,
        oldValue: { status: "SUBMITTED" },
        newValue: { status: "IN_PROGRESS" },
        createdAt: new Date("2026-03-06T09:00:00Z"),
      },
      {
        entityType: "MaintenanceTicket",
        entityId: ticket3.id,
        action: "UPDATE",
        userId: admin.id,
        oldValue: { status: "IN_PROGRESS" },
        newValue: { status: "COMPLETED" },
        createdAt: new Date("2026-03-08T12:00:00Z"),
      },
    ],
  });

  await prisma.maintenanceTicket.create({
    data: {
      title: "Folyosó festés szükséges (2. emelet)",
      description:
        "A 2. emeleti folyosó falai megkoptak és több helyen látható sérülés, karcolás. A festés elkezdett lehullani a sarok közelében. Kérjük az újrafestés felvételét a következő karbantartási tervbe.",
      category: MaintenanceCategory.COMMON_AREA,
      location: "2. emeleti folyosó",
      urgency: Urgency.MEDIUM,
      status: TicketStatus.SUBMITTED,
      trackingNumber: "TKT-2026-004",
      reporterId: resident2.id,
      buildingId: building1.id,
      createdAt: new Date("2026-03-28T17:00:00Z"),
      updatedAt: new Date("2026-03-28T17:00:00Z"),
    },
  });

  // ─── Monthly Charges — Building 1 (6 months, all 5 units) ───────────────────

  const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
  const unitChargeConfig: {
    unitId: string;
    amount: number;
    statuses: ChargeStatus[];
  }[] = [
    {
      unitId: b1_unit1A.id,
      amount: 28600,
      statuses: [
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.UNPAID,
      ],
    },
    {
      unitId: b1_unit1B.id,
      amount: 22800,
      statuses: [
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.OVERDUE,
        ChargeStatus.OVERDUE,
      ],
    },
    {
      unitId: b1_unit2A.id,
      amount: 28600,
      statuses: [
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
      ],
    },
    {
      unitId: b1_unit2B.id,
      amount: 22800,
      statuses: [
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.OVERDUE,
        ChargeStatus.OVERDUE,
        ChargeStatus.OVERDUE,
        ChargeStatus.OVERDUE,
      ],
    },
    {
      unitId: b1_unit3A.id,
      amount: 34200,
      statuses: [
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.PAID,
        ChargeStatus.UNPAID,
      ],
    },
  ];

  for (const cfg of unitChargeConfig) {
    for (let i = 0; i < months.length; i++) {
      await prisma.monthlyCharge.create({
        data: {
          unitId: cfg.unitId,
          month: months[i],
          amount: cfg.amount,
          status: cfg.statuses[i],
          paidAt:
            cfg.statuses[i] === ChargeStatus.PAID
              ? new Date(`${months[i]}-05T10:00:00Z`)
              : null,
        },
      });
    }
  }

  // ─── Complaint categories — defaults per building ──────────────────────────

  const COMPLAINT_DEFAULT_CATEGORIES = [
    { slug: "noise", name: "Zaj", icon: "🔊", sortOrder: 0 },
    { slug: "parking", name: "Parkolás", icon: "🚗", sortOrder: 1 },
    { slug: "smoking", name: "Dohányzás", icon: "🚬", sortOrder: 2 },
    { slug: "pets", name: "Állattartás", icon: "🐕", sortOrder: 3 },
    { slug: "common_area", name: "Közös területek", icon: "🏛️", sortOrder: 4 },
    { slug: "behavior", name: "Magatartás", icon: "👥", sortOrder: 5 },
    { slug: "other", name: "Egyéb", icon: "📝", sortOrder: 6 },
  ];

  async function seedComplaintCategories(buildingId: string) {
    for (const c of COMPLAINT_DEFAULT_CATEGORIES) {
      await prisma.complaintCategory.create({
        data: { buildingId, isDefault: true, ...c },
      });
    }
  }

  await seedComplaintCategories(building1.id);
  await seedComplaintCategories(building2.id);

  // ─── Complaints — Building 1 ─────────────────────────────────────────────────

  const b1NoiseCat = await prisma.complaintCategory.findUniqueOrThrow({
    where: { buildingId_slug: { buildingId: building1.id, slug: "noise" } },
  });
  const b1ParkingCat = await prisma.complaintCategory.findUniqueOrThrow({
    where: { buildingId_slug: { buildingId: building1.id, slug: "parking" } },
  });

  const complaint1 = await prisma.complaint.create({
    data: {
      authorId: tenant2.id,
      categoryId: b1NoiseCat.id,
      title: "Hangos zene a 3A lakásból",
      description:
        "A 3A lakásból rendszeresen késő este (23:00 után) nagyon hangos zene szól, amely megakadályoz az elalvásban. Múlt héten háromszor fordult elő, csütörtökön hajnal 1-ig tartott. Kérem a szükséges intézkedéseket.",
      isPrivate: true,
      trackingNumber: "CMP-2026-001",
      status: ComplaintStatus.WARNING_SENT,
      buildingId: building1.id,
      createdAt: new Date("2026-03-22T09:00:00Z"),
      updatedAt: new Date("2026-03-24T11:30:00Z"),
      statusEvents: {
        create: [
          {
            fromStatus: null,
            toStatus: ComplaintStatus.REPORTED,
            actorId: tenant2.id,
            createdAt: new Date("2026-03-22T09:00:00Z"),
          },
          {
            fromStatus: ComplaintStatus.REPORTED,
            toStatus: ComplaintStatus.ACKNOWLEDGED,
            actorId: admin.id,
            createdAt: new Date("2026-03-23T10:00:00Z"),
          },
          {
            fromStatus: ComplaintStatus.ACKNOWLEDGED,
            toStatus: ComplaintStatus.WARNING_SENT,
            actorId: admin.id,
            note: "Figyelmeztető levél kiküldve a 3A lakás tulajdonosának.",
            createdAt: new Date("2026-03-24T11:30:00Z"),
          },
        ],
      },
    },
  });

  await prisma.complaintNote.create({
    data: {
      complaintId: complaint1.id,
      authorId: admin.id,
      body: "A panaszt rögzítettük és a 3A lakás tulajdonosát levélben értesítettük a házirendben foglalt zajszabályokról. Kérjük a panaszost, hogy újabb előfordulás esetén jelezze.",
      isInternal: false,
      createdAt: new Date("2026-03-24T11:30:00Z"),
    },
  });

  const complaint2 = await prisma.complaint.create({
    data: {
      authorId: resident1.id,
      categoryId: b1ParkingCat.id,
      title: "Idegen jármű a 7-es parkolóhelyen",
      description:
        "Ismeretlen rendszámú szürke Ford Transit teherautó immár harmadik napja foglalja el a 7-es számú kijelölt parkolóhelyet, amely az én bérleti szerződésemben szereplő hely. A portás szerint nincs rögzítve az épület nyilvántartásában. Kérem az eltávolítást.",
      isPrivate: false,
      trackingNumber: "CMP-2026-002",
      status: ComplaintStatus.RESOLVED,
      buildingId: building1.id,
      createdAt: new Date("2026-03-10T13:15:00Z"),
      updatedAt: new Date("2026-03-12T16:00:00Z"),
      statusEvents: {
        create: [
          {
            fromStatus: null,
            toStatus: ComplaintStatus.REPORTED,
            actorId: resident1.id,
            createdAt: new Date("2026-03-10T13:15:00Z"),
          },
          {
            fromStatus: ComplaintStatus.REPORTED,
            toStatus: ComplaintStatus.ACKNOWLEDGED,
            actorId: admin.id,
            createdAt: new Date("2026-03-11T10:00:00Z"),
          },
          {
            fromStatus: ComplaintStatus.ACKNOWLEDGED,
            toStatus: ComplaintStatus.RESOLVED,
            actorId: admin.id,
            note: "Jármű elvitetve, parkolóhely felszabadult.",
            createdAt: new Date("2026-03-12T16:00:00Z"),
          },
        ],
      },
    },
  });

  await prisma.complaintNote.createMany({
    data: [
      {
        complaintId: complaint2.id,
        authorId: admin.id,
        body: "A rendszámot rögzítettük, a jármű tulajdonosát sikerült azonosítani — egy szomszéd vendége volt. Értesítettük, hogy a jármű nem parkol kijelölt helyen, és azonnal elvitette.",
        isInternal: false,
        createdAt: new Date("2026-03-11T10:00:00Z"),
      },
      {
        complaintId: complaint2.id,
        authorId: admin.id,
        body: "A parkolóhely felszabadult, a panaszos visszajelzése szerint az ügy lezárható.",
        isInternal: false,
        createdAt: new Date("2026-03-12T16:00:00Z"),
      },
    ],
  });

  // ─── Meeting — Building 1 ────────────────────────────────────────────────────

  const meeting1 = await prisma.meeting.create({
    data: {
      title: "Q1 Közgyűlés",
      description:
        "Az I. negyedéves rendes közgyűlés, amelyen a pénzügyi zárlat, a karbantartási tervek és az aktuális ügyek kerülnek tárgyalásra. A határozatképességhez a tulajdoni hányadok legalább 50%+1 szavazata szükséges.",
      date: new Date("2026-04-10T00:00:00Z"),
      time: "18:00",
      location: "Duna Residence — Közösségi terem (fszt. 3.)",
      agenda: [
        "1. Megnyitó és határozatképesség megállapítása",
        "2. 2026. I. negyedéves pénzügyi beszámoló",
        "3. Északi szárny vízvezeték-csere utókövetése",
        "4. B lift felújítási ajánlatok ismertetése",
        "5. Nyári tetőterasz rendezvény előkészítése",
        "6. Egyéb kérdések, javaslatok",
      ],
      createdById: admin.id,
      buildingId: building1.id,
      createdAt: new Date("2026-03-28T10:00:00Z"),
      updatedAt: new Date("2026-03-28T10:00:00Z"),
    },
  });

  await prisma.meetingRsvp.createMany({
    data: [
      { meetingId: meeting1.id, userId: admin.id, status: RsvpStatus.ATTENDING },
      { meetingId: meeting1.id, userId: boardMember1.id, status: RsvpStatus.ATTENDING },
      { meetingId: meeting1.id, userId: resident1.id, status: RsvpStatus.ATTENDING },
      { meetingId: meeting1.id, userId: resident2.id, status: RsvpStatus.NOT_ATTENDING },
      { meetingId: meeting1.id, userId: superAdmin.id, status: RsvpStatus.ATTENDING },
    ],
  });

  // Future Q2 meeting — used as the escalation target for active complaints.
  await prisma.meeting.create({
    data: {
      title: "Q2 Közgyűlés",
      description:
        "Az II. negyedéves rendes közgyűlés. Napirenden a folyó ügyek és az eszkalált házirend-megsértési ügyek tárgyalása.",
      date: new Date("2026-06-18T00:00:00Z"),
      time: "18:00",
      location: "Duna Residence — Közösségi terem (fszt. 3.)",
      agenda: [
        "1. Megnyitó és határozatképesség megállapítása",
        "2. 2026. II. negyedéves pénzügyi beszámoló",
        "3. Eszkalált házirend-megsértési ügyek megtárgyalása",
        "4. Nyári rendezvénynaptár",
        "5. Egyéb kérdések, javaslatok",
      ],
      createdById: admin.id,
      buildingId: building1.id,
      createdAt: new Date("2026-05-15T09:00:00Z"),
      updatedAt: new Date("2026-05-15T09:00:00Z"),
    },
  });

  // ─── Documents — Building 1 ──────────────────────────────────────────────────

  const rulesCategory = await prisma.documentCategory.findFirst({
    where: { buildingId: building1.id, name: "Rules & Regulations" },
  });

  const meetingMinutesCategory = await prisma.documentCategory.findFirst({
    where: { buildingId: building1.id, name: "Meeting Minutes" },
  });

  const financialReportsCategory = await prisma.documentCategory.findFirst({
    where: { buildingId: building1.id, name: "Financial Reports" },
  });

  if (rulesCategory) {
    const doc1 = await prisma.document.create({
      data: {
        title: "Házirend v2.1",
        description:
          "A Duna Residence társasház érvényes házirendje, beleértve a zajszabályokat, parkolási előírásokat és a közös területek használatára vonatkozó szabályokat.",
        categoryId: rulesCategory.id,
        visibility: DocumentVisibility.PUBLIC,
        tags: ["házirend", "szabályok", "közösség"],
        uploadedById: admin.id,
        createdAt: new Date("2026-01-15T10:00:00Z"),
        updatedAt: new Date("2026-01-15T10:00:00Z"),
      },
    });

    await prisma.documentVersion.createMany({
      data: [
        {
          documentId: doc1.id,
          versionNumber: 1,
          fileUrl: "/documents/hazirend-v2.0.pdf",
          fileName: "Hazirend_v2.0.pdf",
          fileSize: 245760,
          mimeType: "application/pdf",
          uploadedById: admin.id,
          uploadedAt: new Date("2025-10-01T09:00:00Z"),
        },
        {
          documentId: doc1.id,
          versionNumber: 2,
          fileUrl: "/documents/hazirend-v2.1.pdf",
          fileName: "Hazirend_v2.1.pdf",
          fileSize: 251904,
          mimeType: "application/pdf",
          uploadedById: admin.id,
          uploadedAt: new Date("2026-01-15T10:00:00Z"),
        },
      ],
    });

    const doc2 = await prisma.document.create({
      data: {
        title: "Igazgatótanács Etikai Kódexe",
        description:
          "A tulajdonosi közösség igazgatótanácsának etikai kódexe és összeférhetetlenségi szabályzata.",
        categoryId: rulesCategory.id,
        visibility: DocumentVisibility.BOARD_ONLY,
        tags: ["igazgatótanács", "etika", "összeférhetetlenség"],
        uploadedById: admin.id,
        createdAt: new Date("2026-02-01T11:00:00Z"),
        updatedAt: new Date("2026-02-01T11:00:00Z"),
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: doc2.id,
        versionNumber: 1,
        fileUrl: "/documents/etikai-kodex-v1.docx",
        fileName: "Etikai_Kodex_v1.docx",
        fileSize: 98304,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploadedById: admin.id,
        uploadedAt: new Date("2026-02-01T11:00:00Z"),
      },
    });
  }

  if (meetingMinutesCategory) {
    const doc3 = await prisma.document.create({
      data: {
        title: "2025. Q4 Közgyűlési Jegyzőkönyv",
        description:
          "A 2025. december 12-én megtartott negyedéves közgyűlés hivatalos jegyzőkönyve.",
        categoryId: meetingMinutesCategory.id,
        visibility: DocumentVisibility.PUBLIC,
        tags: ["közgyűlés", "jegyzőkönyv", "2025-Q4"],
        uploadedById: admin.id,
        createdAt: new Date("2025-12-20T14:00:00Z"),
        updatedAt: new Date("2025-12-20T14:00:00Z"),
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: doc3.id,
        versionNumber: 1,
        fileUrl: "/documents/kozgyules-jkv-2025-q4.pdf",
        fileName: "Kozgyules_Jegyzokonyv_2025_Q4.pdf",
        fileSize: 184320,
        mimeType: "application/pdf",
        uploadedById: admin.id,
        uploadedAt: new Date("2025-12-20T14:00:00Z"),
      },
    });
  }

  if (financialReportsCategory) {
    const doc4 = await prisma.document.create({
      data: {
        title: "2026 Q1 Pénzügyi Riport",
        description:
          "A Duna Residence társasház 2026. I. negyedéves pénzügyi összefoglalója: bevételek, kiadások, tartalékalap-egyenleg.",
        categoryId: financialReportsCategory.id,
        visibility: DocumentVisibility.BOARD_ONLY,
        tags: ["pénzügy", "riport", "2026-Q1"],
        uploadedById: admin.id,
        createdAt: new Date("2026-03-26T10:00:00Z"),
        updatedAt: new Date("2026-03-26T10:00:00Z"),
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: doc4.id,
        versionNumber: 1,
        fileUrl: "/documents/penzugyi-riport-2026-q1.xlsx",
        fileName: "Penzugyi_Riport_2026_Q1.xlsx",
        fileSize: 73728,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: admin.id,
        uploadedAt: new Date("2026-03-26T10:00:00Z"),
      },
    });
  }

  console.log("Seeding complete.");
  console.log("  - 4 plans created (Starter, Professional, Enterprise, Legacy)");
  console.log("  - 1 legacy subscription created (assigned to super admin)");
  console.log("  - 2 buildings created (Duna Residence, Margit Apartments)");
  console.log("  - 2 buildings linked to legacy subscription");
  console.log("  - 8 units created (5 in building 1, 3 in building 2)");
  console.log("  - 11 users created (password: password123)");
  console.log("  - 12 user-building assignments");
  console.log("  - 11 unit-user relationships");
  console.log("  - 4 communication channels (Hirdetőtábla + Általános per building)");
  console.log("  - 22 accounts (11 per building)");
  console.log("  - 3 contractors (global)");
  console.log("  - 14 document categories (7 per building)");
  console.log("  - 4 scheduled maintenance entries (2 per building)");
  console.log("  - 4 announcement posts + 1 topic thread with 2 replies (building 1)");
  console.log("  - 4 maintenance tickets (building 1)");
  console.log("  - 30 monthly charges (5 units × 6 months, building 1)");
  console.log("  - 2 complaints with notes (building 1)");
  console.log("  - 1 upcoming meeting with RSVPs (building 1)");
  console.log("  - 4 documents with versions (building 1)");

  // ─── Board permissions catalog + grant defaults to BOARD_MEMBER+ ─────────
  await seedBoardPermissions();

  // ─── Generative mock data: fill out building1 to multi-stairwell ─────────
  // Adds enough units + residents for the floor-map / directory views to look
  // populated. Existing units 1A..3A in stairwell A are kept untouched.
  await seedBuildingDemoData(building1.id);
}

const BOARD_PERMISSIONS = [
  { key: "financial_full", labelKey: "perm.financial_full.label", descriptionKey: "perm.financial_full.desc", default: true },
  { key: "invoice_signoff", labelKey: "perm.invoice_signoff.label", descriptionKey: "perm.invoice_signoff.desc", default: true },
  { key: "board_post", labelKey: "perm.board_post.label", descriptionKey: "perm.board_post.desc", default: true },
  { key: "vote_create", labelKey: "perm.vote_create.label", descriptionKey: "perm.vote_create.desc", default: true },
  { key: "maintenance_orders", labelKey: "perm.maintenance_orders.label", descriptionKey: "perm.maintenance_orders.desc", default: true },
  { key: "delete_resident", labelKey: "perm.delete_resident.label", descriptionKey: "perm.delete_resident.desc", default: false },
  { key: "modify_bylaws", labelKey: "perm.modify_bylaws.label", descriptionKey: "perm.modify_bylaws.desc", default: false },
];

async function seedBoardPermissions(): Promise<void> {
  // Catalog rows.
  const permRecords: Record<string, string> = {};
  for (let i = 0; i < BOARD_PERMISSIONS.length; i++) {
    const p = BOARD_PERMISSIONS[i];
    const row = await prisma.boardPermission.upsert({
      where: { key: p.key },
      update: { labelKey: p.labelKey, descriptionKey: p.descriptionKey, sortOrder: i },
      create: {
        id: `seed_perm_${p.key}`,
        key: p.key,
        labelKey: p.labelKey,
        descriptionKey: p.descriptionKey,
        sortOrder: i,
      },
    });
    permRecords[p.key] = row.id;
  }

  // Grant defaults to every board+ user.
  const boardMembers = await prisma.userBuilding.findMany({
    where: { role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true },
  });
  for (const ub of boardMembers) {
    for (const p of BOARD_PERMISSIONS) {
      if (!p.default) continue;
      await prisma.userBuildingPermission.upsert({
        where: {
          userBuildingId_permissionId: {
            userBuildingId: ub.id,
            permissionId: permRecords[p.key],
          },
        },
        update: {},
        create: {
          userBuildingId: ub.id,
          permissionId: permRecords[p.key],
        },
      });
    }
  }
  console.log(
    `  + ${BOARD_PERMISSIONS.length} board permissions · granted to ${boardMembers.length} board members`,
  );
}

const HU_FIRSTNAMES = [
  "Anna", "Bence", "Csaba", "Dóra", "Eszter", "Ferenc", "Gábor", "Hanna",
  "István", "Júlia", "Kálmán", "László", "Márta", "Nóra", "Olivér", "Petra",
  "Réka", "Sándor", "Tamás", "Viktor", "Zsófia", "Ákos", "Beáta", "Dániel",
  "Emese", "Gergő", "Helga", "Imre", "Krisztina", "Lilla",
];

const HU_LASTNAMES = [
  "Nagy", "Kovács", "Tóth", "Szabó", "Horváth", "Varga", "Kiss", "Molnár",
  "Németh", "Farkas", "Balogh", "Papp", "Takács", "Juhász", "Lakatos",
  "Mészáros", "Oláh", "Simon", "Rácz", "Fekete",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function seedBuildingDemoData(buildingId: string): Promise<void> {
  // Stairwells × floors × positions → units. Skip A floor 1+2+3 because those
  // are the existing seeded units (1A, 1B, 2A, 2B, 3A).
  const STAIRWELLS = ["A", "B"] as const;
  const FLOORS = [1, 2, 3, 4, 5, 6, 7];
  const POSITIONS = [1, 2, 3, 4, 5, 6];
  const SIZE_BY_POS = [54, 68, 68, 52, 72, 78];
  const TOPFLOOR_SIZES = [92, 88, 84, 95, 0, 0];
  const SHARE_PER_UNIT = 0.011; // keeps total reasonable

  const generatedUnits: Array<{
    id: string;
    number: string;
    stairwell: string;
    floor: number;
    position: number;
    size: number;
  }> = [];

  for (const stairwell of STAIRWELLS) {
    for (const floor of FLOORS) {
      for (const position of POSITIONS) {
        // Skip A-stairwell floor 1+2 positions 1+2 and floor 3 position 1
        // (already created earlier as 1A, 1B, 2A, 2B, 3A).
        const isExisting =
          stairwell === "A" &&
          ((floor === 1 && position <= 2) ||
            (floor === 2 && position <= 2) ||
            (floor === 3 && position === 1));
        if (isExisting) continue;

        // Top-floor (7) has only 4 units in A, 4 in B (5 and 6 are skipped).
        if (floor === 7 && position > 4) continue;

        const number = `${stairwell}-${floor}.${position}`;
        const size =
          floor === 7
            ? TOPFLOOR_SIZES[position - 1]
            : SIZE_BY_POS[position - 1];

        const unit = await prisma.unit.create({
          data: {
            number,
            floor,
            stairwell,
            positionOnFloor: position,
            ownershipShare: SHARE_PER_UNIT,
            size,
            buildingId,
          },
        });
        generatedUnits.push({
          id: unit.id,
          number,
          stairwell,
          floor,
          position,
          size,
        });
      }
    }
  }

  // ── Generate ~25 mock residents and assign them to units ───────────────
  const password = await bcrypt.hash("password123", 10);
  const residentCount = 25;
  const tenantCount = 8; // tenants come from a separate pool to mark TENANT
  const generatedUsers: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < residentCount + tenantCount; i++) {
    const last = pick(HU_LASTNAMES, i + 3);
    const first = pick(HU_FIRSTNAMES, i + 7);
    const name = `${last} ${first}`;
    const email = `${last.toLowerCase()}.${first.toLowerCase()}${i}@duna-residence.hu`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: password,
        name,
        language: "hu",
        emailVerifiedAt: new Date(),
      },
    });
    generatedUsers.push({ id: user.id, name });

    await prisma.userBuilding.create({
      data: {
        userId: user.id,
        buildingId,
        role:
          i < 3
            ? "BOARD_MEMBER" // 3 extra board members
            : i < residentCount
              ? "OWNER"
              : "TENANT",
        isActive: true,
      },
    });
  }

  // Distribute residents across generated units. Mostly OWNER, some TENANT,
  // some empty (vacant). Skip every ~12th unit to leave it vacant.
  let residentIdx = 0;
  for (let i = 0; i < generatedUnits.length; i++) {
    if (i % 12 === 11) continue; // ~8% vacant
    const unit = generatedUnits[i];
    const isTenantUnit = i % 5 === 0; // ~20% tenant-occupied
    const user = generatedUsers[residentIdx % generatedUsers.length];
    residentIdx++;

    await prisma.unitUser.create({
      data: {
        userId: user.id,
        unitId: unit.id,
        relationship: isTenantUnit
          ? UnitRelationship.TENANT
          : UnitRelationship.OWNER,
        isPrimaryContact: true,
      },
    });
  }

  console.log(`  + ${generatedUnits.length} demo units (stairwells A+B)`);
  console.log(`  + ${generatedUsers.length} demo residents`);

  // Phase 4 — refresh Building.totalUnits + threshold flags so the
  // banners + admin officer-registry page have correct data. The helper
  // counts units and recomputes the four flags from Tht. thresholds.
  const { refreshBuildingThresholds } = await import("../src/lib/thresholds");
  const allBuildings = await prisma.building.findMany({ select: { id: true } });
  for (const b of allBuildings) {
    await refreshBuildingThresholds(prisma, b.id);
  }
  console.log(`  + Refreshed thresholds for ${allBuildings.length} buildings`);
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
