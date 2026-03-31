import {
  PrismaClient,
  AccountType,
  BuildingRole,
  UnitRelationship,
  TargetAudience,
  MaintenanceCategory,
  Urgency,
  TicketStatus,
  ChargeStatus,
  ComplaintCategory,
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

  // ─── Announcements — Building 1 ─────────────────────────────────────────────

  await prisma.announcement.createMany({
    data: [
      {
        title: "Éves Közgyűlés — március 15.",
        body: "Tisztelt Lakók!\n\nEzúton értesítjük Önöket, hogy az éves közgyűlésre 2026. március 15-én, 18:00 órakor kerül sor a Duna Residence közösségi termében (fszt. 3.).\n\nNapirendi pontok:\n1. Az elmúlt év pénzügyi beszámolója\n2. 2026-os éves költségvetés jóváhagyása\n3. Közös területek felújítási terve\n4. Egyéb ügyek\n\nKérjük, hogy szavazati jogukat személyesen vagy meghatalmazott útján gyakorolják. A meghatalmazási nyomtatvány a portán átvehető.\n\nUdvariasan kérjük szíves megjelenésüket!\n\nKovács Mária\nHázkezelő",
        authorId: admin.id,
        targetAudience: TargetAudience.ALL,
        buildingId: building1.id,
        createdAt: new Date("2026-03-01T09:00:00Z"),
        updatedAt: new Date("2026-03-01T09:00:00Z"),
      },
      {
        title: "Vízvezeték-csere az északi szárnyban",
        body: "Kedves Lakók!\n\nTájékoztatjuk Önöket, hogy 2026. március 18–20. között (hétfőtől szerdáig) az északi szárny fővezetékének cseréjét végzik el a Kovács Kft. szakemberei.\n\nA munkálatok ideje alatt (08:00–17:00) a hideg vízszolgáltatás az érintett szárnyban szünetel. Kérjük, hogy elegendő ivóvizet tároljanak el.\n\nAz északi szárny érintett lakásai: 1B, 2B, 3B.\n\nA kényelmetlenségért elnézést kérünk.\n\nSzabó Péter\nTulajdonosi közösség elnöke",
        authorId: boardMember1.id,
        targetAudience: TargetAudience.ALL,
        buildingId: building1.id,
        createdAt: new Date("2026-03-10T11:30:00Z"),
        updatedAt: new Date("2026-03-10T11:30:00Z"),
      },
      {
        title: "Q1 Pénzügyi Audit Eredményei",
        body: "Kedves Igazgatótanács!\n\nAz I. negyedéves belső pénzügyi audit lezárult. Az eredmények összefoglalója:\n\n- Közös költség befizetési arány: 94,3% (tervezett: 95%)\n- Tartalékalap egyenlege: 4 250 000 Ft (tervezett: 4 100 000 Ft)\n- Fő eltérés: az északi szárny vízvezeték-csere előre nem tervezett kiadása (+480 000 Ft)\n- Egyéb ügzemeltetési kiadások: a tervezett kereten belül\n\nRészletes riport a dokumentumtárban elérhető. Kérem, hogy átnézés után esetleges észrevételeiket a következő testületi ülésen jelezzék.\n\nKovács Mária\nHázkezelő",
        authorId: admin.id,
        targetAudience: TargetAudience.BOARD_ONLY,
        buildingId: building1.id,
        createdAt: new Date("2026-03-25T14:00:00Z"),
        updatedAt: new Date("2026-03-25T14:00:00Z"),
      },
      {
        title: "Nyári Tetőterasz Összejövetel — június 21.",
        body: "Kedves Szomszédok!\n\nÖrömmel értesítjük Önöket, hogy idén is megrendezzük a hagyományos nyári tetőterasz bulit!\n\nIdőpont: 2026. június 21. (vasárnap), 17:00-tól\nHelyszín: Tetőterasz (4. emelet)\n\nA közösség biztosít: alkoholmentes italokat, papírtányérokat és evőeszközöket.\nMindenkit szeretettel várunk saját fogással, italokkal!\n\nKérjük, jelezzék részvételi szándékukat május 31-ig a házkezelőnek, hogy megfelelően tudjunk előkészíteni.\n\nSzabó Péter\nTulajdonosi közösség elnöke",
        authorId: boardMember1.id,
        targetAudience: TargetAudience.ALL,
        buildingId: building1.id,
        createdAt: new Date("2026-03-28T10:00:00Z"),
        updatedAt: new Date("2026-03-28T10:00:00Z"),
      },
    ],
  });

  // ─── Forum Topics & Replies — Building 1, "General" category ────────────────

  const b1GeneralCategory = await prisma.forumCategory.findFirst({
    where: { buildingId: building1.id, name: "General" },
  });

  if (b1GeneralCategory) {
    const topic1 = await prisma.forumTopic.create({
      data: {
        title: "Erkélyláda szabályok?",
        body: "Sziasztok!\n\nSzeretnék virágládákat kirakni az erkélykorlát külső oldalára, de nem vagyok biztos benne, hogy ez megengedett-e. Valaki tud erről valamit? Az SZMSZ-ben nem találtam egyértelmű szabályt ezzel kapcsolatban.\n\nElőre is köszönöm!",
        categoryId: b1GeneralCategory.id,
        authorId: resident1.id,
        isPinned: false,
        lastActivityAt: new Date("2026-03-20T16:45:00Z"),
        createdAt: new Date("2026-03-18T09:15:00Z"),
        updatedAt: new Date("2026-03-20T16:45:00Z"),
      },
    });

    await prisma.forumReply.createMany({
      data: [
        {
          body: "Érdeklődtem korábban a házkezelőnél — a korlát külső oldalán nem szabad, mert esővízzel lecsöpöghet az alattad lévők teraszára. Belső oldalon igen, de 2 kg/fm-es korlátterhelési limitet ne lépd túl.",
          topicId: topic1.id,
          authorId: resident2.id,
          createdAt: new Date("2026-03-18T11:30:00Z"),
          updatedAt: new Date("2026-03-18T11:30:00Z"),
        },
        {
          body: "Megerősítem, amit Horváth úr írt. Az SZMSZ 4.3-as pontja szerint kültéri erkélykorlát külső felületén semmilyen tárgy nem rögzíthető tartósan. Ha belülre teszed, nincs gond, csak a csöpögést érdemes megoldani.",
          topicId: topic1.id,
          authorId: admin.id,
          createdAt: new Date("2026-03-20T16:45:00Z"),
          updatedAt: new Date("2026-03-20T16:45:00Z"),
        },
      ],
    });

    const topic2 = await prisma.forumTopic.create({
      data: {
        title: "Ablaktisztítóra ajánlás?",
        body: "Helló!\n\nTudna valaki megbízható ablaktisztítót ajánlani? Lehetőleg olyat, aki lakásablakokat is vállal, ne csak az épület egészét. Kb. 8 db kétszárnyú ablakot kellene kitakaríttatni a 3A-ban.\n\nÁr-érték arányban is örülnék véleménynek, ha van tapasztalatotok!",
        categoryId: b1GeneralCategory.id,
        authorId: resident2.id,
        isPinned: false,
        lastActivityAt: new Date("2026-03-22T14:20:00Z"),
        createdAt: new Date("2026-03-21T08:00:00Z"),
        updatedAt: new Date("2026-03-22T14:20:00Z"),
      },
    });

    await prisma.forumReply.createMany({
      data: [
        {
          body: "Én a Kristálytiszta Bt.-t ajánlom (+36 70 444 5566). Tavaly hívtam őket, pontosak, alaposak és nem horribilis az áruk. Kb. 3500–4500 Ft/ablak, mérettől függően.",
          topicId: topic2.id,
          authorId: resident1.id,
          createdAt: new Date("2026-03-21T10:15:00Z"),
          updatedAt: new Date("2026-03-21T10:15:00Z"),
        },
        {
          body: "Mi tavasszal és ősszel a Sparkle Clean-t szoktuk hívni (sparkle@clean.hu). Gyorsan reagálnak és a belső párkányokat is letörlik. Tóth Anna ajánlásával akár 10% kedvezmény is jár az első megrendelésre.",
          topicId: topic2.id,
          authorId: tenant1.id,
          createdAt: new Date("2026-03-22T14:20:00Z"),
          updatedAt: new Date("2026-03-22T14:20:00Z"),
        },
      ],
    });

    const topic3 = await prisma.forumTopic.create({
      data: {
        title: "Az edzőterem klímájával gond van?",
        body: "Sziasztok!\n\nMár néhány hete észreveszem, hogy az edzőteremben (fszt.) a légkondicionáló alig fúj, és nagyon bemelegel. Tegnap 28 fokot mutatott a hőmérő belül, kint 16 volt. Valaki más is tapasztalta? Érdemes jegyet beadni?",
        categoryId: b1GeneralCategory.id,
        authorId: resident3.id,
        isPinned: false,
        lastActivityAt: new Date("2026-03-29T18:00:00Z"),
        createdAt: new Date("2026-03-27T19:30:00Z"),
        updatedAt: new Date("2026-03-29T18:00:00Z"),
      },
    });

    await prisma.forumReply.createMany({
      data: [
        {
          body: "Igen, én is tapasztaltam múlt héten. Hétfőn és szerdán is brutálisan meleg volt. Valószínűleg a filter eltömött — ezt érdemes jelezni a kezelőnek.",
          topicId: topic3.id,
          authorId: tenant2.id,
          createdAt: new Date("2026-03-28T07:45:00Z"),
          updatedAt: new Date("2026-03-28T07:45:00Z"),
        },
        {
          body: "Karbantartási jegyet már leadtam tegnap. Az ElektroFix Bt. foglalkozik a klímarendszerekkel, a kezelő ígérte, hogy ezen a héten kinéznek rá.",
          topicId: topic3.id,
          authorId: boardMember1.id,
          createdAt: new Date("2026-03-29T09:10:00Z"),
          updatedAt: new Date("2026-03-29T09:10:00Z"),
        },
        {
          body: "Köszönöm a gyors intézkedést! Addig is, ha van valakinek hordozható ventilátora, amit be lehetne vinni, az nagyon jól jönne. 😅",
          topicId: topic3.id,
          authorId: resident3.id,
          createdAt: new Date("2026-03-29T18:00:00Z"),
          updatedAt: new Date("2026-03-29T18:00:00Z"),
        },
      ],
    });
  }

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

  await prisma.maintenanceTicket.create({
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

  // ─── Complaints — Building 1 ─────────────────────────────────────────────────

  const complaint1 = await prisma.complaint.create({
    data: {
      authorId: tenant2.id,
      category: ComplaintCategory.NOISE,
      description:
        "A 3A lakásból rendszeresen késő este (23:00 után) nagyon hangos zene szól, amely megakadályoz az elalvásban. Múlt héten háromszor fordult elő, csütörtökön hajnal 1-ig tartott. Kérem a szükséges intézkedéseket.",
      isPrivate: false,
      trackingNumber: "CMP-2026-001",
      status: ComplaintStatus.UNDER_REVIEW,
      buildingId: building1.id,
      createdAt: new Date("2026-03-22T09:00:00Z"),
      updatedAt: new Date("2026-03-24T11:30:00Z"),
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
      category: ComplaintCategory.PARKING,
      description:
        "Ismeretlen rendszámú szürke Ford Transit teherautó immár harmadik napja foglalja el a 7-es számú kijelölt parkolóhelyet, amely az én bérleti szerződésemben szereplő hely. A portás szerint nincs rögzítve az épület nyilvántartásában. Kérem az eltávolítást.",
      isPrivate: false,
      trackingNumber: "CMP-2026-002",
      status: ComplaintStatus.RESOLVED,
      buildingId: building1.id,
      createdAt: new Date("2026-03-10T13:15:00Z"),
      updatedAt: new Date("2026-03-12T16:00:00Z"),
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
  console.log("  - 8 forum categories (4 per building)");
  console.log("  - 22 accounts (11 per building)");
  console.log("  - 3 contractors (global)");
  console.log("  - 14 document categories (7 per building)");
  console.log("  - 4 scheduled maintenance entries (2 per building)");
  console.log("  - 4 announcements (building 1)");
  console.log("  - 3 forum topics with replies (building 1, General category)");
  console.log("  - 4 maintenance tickets (building 1)");
  console.log("  - 30 monthly charges (5 units × 6 months, building 1)");
  console.log("  - 2 complaints with notes (building 1)");
  console.log("  - 1 upcoming meeting with RSVPs (building 1)");
  console.log("  - 4 documents with versions (building 1)");
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
