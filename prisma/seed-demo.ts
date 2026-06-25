/**
 * Demo seed — Petőfi Sándor utca 23.
 *
 * One realistic-feeling building used for live customer demos / exec pitches.
 * Designed to look "lived-in" when a stranger clicks around for 60 seconds.
 *
 * Run:  npm run seed:demo
 *
 * Additive and idempotent: scoped to BUILDING_ID + the @petofi23.local email
 * domain. Re-running cleans up the previous demo and recreates it. Does NOT
 * touch the main `seed.ts` fixtures.
 *
 * Login as közös képviselő:
 *   kepviselo@petofi23.local / password123
 *
 * Scenario the demo tells:
 *   - 24-lakásos belvárosi társasház (Budapest V. kerület, 1923-as építésű)
 *   - Pending közgyűlés ~3 nap múlva, 2 előkészített DRAFT szavazással
 *   - Egy nemrég lezárt közgyűlés aláírt jegyzőkönyvvel
 *   - 3 aktív karbantartási jegy (1 CRITICAL lift, 1 ASSIGNED, 1 SUBMITTED)
 *   - Aktuális havi közös költség: 19/24 fizetve, 3 késedelmes, 2 nyitva
 *   - Hirdetőtábla + fórum aktivitás
 *   - Realisztikus dokumentumtár (házirend, SZMSZ, jegyzőkönyv, költségvetés)
 */

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
  VoteType,
  VoteStatus,
  MajorityType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  console.error("FATAL: refusing to seed demo data in production.");
  process.exit(1);
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BUILDING_ID = "demo_petofi_23";
const SUBSCRIPTION_ID = "demo_petofi_sub";
const EMAIL_DOMAIN = "@petofi23.local";
const PASSWORD = "password123";

// Anchor all relative dates off a single "now" so the seed produces a
// consistent timeline within one run.
const NOW = new Date();
const D = (offsetDays: number, hours = 12, minutes = 0): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const CURRENT_MONTH_STR = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

// ─── Unit / owner data ──────────────────────────────────────────────────────
// 24 units across 5 floors (I-V emelet). Sizes drive ownership shares.
// 1923-as polgári ház — első emeleti reprezentatív lakások, V. emelet tetőtér.

const UNIT_DEFS: Array<{ floor: number; positionOnFloor: number; size: number }> = [
  // I. emelet — 4 nagy reprezentatív lakás
  { floor: 1, positionOnFloor: 1, size: 95 },
  { floor: 1, positionOnFloor: 2, size: 105 },
  { floor: 1, positionOnFloor: 3, size: 88 },
  { floor: 1, positionOnFloor: 4, size: 110 },
  // II. emelet
  { floor: 2, positionOnFloor: 1, size: 72 },
  { floor: 2, positionOnFloor: 2, size: 80 },
  { floor: 2, positionOnFloor: 3, size: 68 },
  { floor: 2, positionOnFloor: 4, size: 78 },
  { floor: 2, positionOnFloor: 5, size: 92 },
  // III. emelet
  { floor: 3, positionOnFloor: 1, size: 70 },
  { floor: 3, positionOnFloor: 2, size: 76 },
  { floor: 3, positionOnFloor: 3, size: 65 },
  { floor: 3, positionOnFloor: 4, size: 82 },
  { floor: 3, positionOnFloor: 5, size: 88 },
  // IV. emelet
  { floor: 4, positionOnFloor: 1, size: 68 },
  { floor: 4, positionOnFloor: 2, size: 74 },
  { floor: 4, positionOnFloor: 3, size: 62 },
  { floor: 4, positionOnFloor: 4, size: 80 },
  { floor: 4, positionOnFloor: 5, size: 85 },
  // V. emelet — tetőtér beépítés, kisebb lakások
  { floor: 5, positionOnFloor: 1, size: 48 },
  { floor: 5, positionOnFloor: 2, size: 55 },
  { floor: 5, positionOnFloor: 3, size: 52 },
  { floor: 5, positionOnFloor: 4, size: 50 },
  { floor: 5, positionOnFloor: 5, size: 58 },
];

const OWNER_NAMES = [
  "Kovács József", "Nagy Éva", "Tóth László", "Szabó Anna",
  "Horváth Péter", "Varga Mária", "Kiss Gábor", "Molnár Krisztina",
  "Németh István", "Farkas Andrea", "Balogh Tamás", "Papp Erzsébet",
  "Takács Zoltán", "Juhász Beáta", "Lakatos Sándor", "Mészáros Judit",
  "Oláh Ferenc", "Simon Katalin", "Rácz György", "Fekete Ildikó",
  "Szilágyi Béla", "Török Gabriella", "Fehér Csaba", "Gál Margit",
];

// Indices into OWNER_NAMES that hold board roles. Owner 0 = elnök.
const BOARD_OWNER_INDICES = [0, 4, 10];

const MANAGER_NAME = "Kerekes Tamás";
const MANAGER_EMAIL = `kepviselo${EMAIL_DOMAIN}`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function emailFor(name: string, idx: number): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, ".");
  return `${slug}.${String(idx + 1).padStart(2, "0")}${EMAIL_DOMAIN}`;
}

function unitLabel(floor: number, position: number): string {
  const roman = ["I", "II", "III", "IV", "V"][floor - 1];
  return `${roman}/${position}`;
}

/**
 * Compute ownership shares from sizes such that they sum to exactly 1.0000.
 * The last unit absorbs rounding remainder.
 */
function computeShares(sizes: number[]): number[] {
  const total = sizes.reduce((a, b) => a + b, 0);
  const raw = sizes.map((s) => Math.round((s / total) * 10000) / 10000);
  const sum = raw.reduce((a, b) => a + b, 0);
  const drift = Math.round((1 - sum) * 10000) / 10000;
  raw[raw.length - 1] = Math.round((raw[raw.length - 1] + drift) * 10000) / 10000;
  return raw;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────
// Scoped delete: only touches rows tied to BUILDING_ID or @petofi23.local users.

async function cleanup(): Promise<void> {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: EMAIL_DOMAIN } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  // Votes + ballots
  await prisma.ballot.deleteMany({ where: { vote: { buildingId: BUILDING_ID } } });
  await prisma.voteOption.deleteMany({ where: { vote: { buildingId: BUILDING_ID } } });
  await prisma.vote.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Meetings + dependents
  await prisma.meetingMinutesSignature.deleteMany({
    where: { meeting: { buildingId: BUILDING_ID } },
  });
  await prisma.meetingAttendance.deleteMany({
    where: { meeting: { buildingId: BUILDING_ID } },
  });
  await prisma.meetingRsvp.deleteMany({
    where: { meeting: { buildingId: BUILDING_ID } },
  });
  await prisma.pendingAgendaItem.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.meeting.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Documents
  await prisma.documentVersion.deleteMany({
    where: { document: { category: { buildingId: BUILDING_ID } } },
  });
  await prisma.document.deleteMany({
    where: { category: { buildingId: BUILDING_ID } },
  });
  await prisma.documentCategory.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Maintenance
  await prisma.scheduledMaintenance.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.contractorRating.deleteMany({
    where: { ticket: { buildingId: BUILDING_ID } },
  });
  await prisma.ticketAttachment.deleteMany({
    where: { ticket: { buildingId: BUILDING_ID } },
  });
  await prisma.ticketComment.deleteMany({
    where: { ticket: { buildingId: BUILDING_ID } },
  });
  await prisma.maintenanceTicket.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Finance
  await prisma.budget.deleteMany({ where: { account: { buildingId: BUILDING_ID } } });
  await prisma.ledgerEntry.deleteMany({
    where: {
      OR: [
        { debitAccount: { buildingId: BUILDING_ID } },
        { creditAccount: { buildingId: BUILDING_ID } },
      ],
    },
  });
  await prisma.account.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.monthlyCharge.deleteMany({
    where: { unit: { buildingId: BUILDING_ID } },
  });

  // Complaints
  await prisma.complaintNote.deleteMany({
    where: { complaint: { buildingId: BUILDING_ID } },
  });
  await prisma.complaintStatusEvent.deleteMany({
    where: { complaint: { buildingId: BUILDING_ID } },
  });
  await prisma.complaint.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.complaintCategory.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Communication
  await prisma.messageMention.deleteMany({
    where: { message: { channel: { buildingId: BUILDING_ID } } },
  });
  await prisma.messageReaction.deleteMany({
    where: { message: { channel: { buildingId: BUILDING_ID } } },
  });
  await prisma.pollVote.deleteMany({
    where: { poll: { message: { channel: { buildingId: BUILDING_ID } } } },
  });
  await prisma.pollOption.deleteMany({
    where: { poll: { message: { channel: { buildingId: BUILDING_ID } } } },
  });
  await prisma.poll.deleteMany({
    where: { message: { channel: { buildingId: BUILDING_ID } } },
  });
  await prisma.messageRead.deleteMany({
    where: { message: { channel: { buildingId: BUILDING_ID } } },
  });
  await prisma.messageAttachment.deleteMany({
    where: { message: { channel: { buildingId: BUILDING_ID } } },
  });
  await prisma.channelMessage.deleteMany({
    where: { channel: { buildingId: BUILDING_ID } },
  });
  await prisma.channelMember.deleteMany({
    where: { channel: { buildingId: BUILDING_ID } },
  });
  await prisma.channel.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Tasks + audit + invitations + reports
  await prisma.task.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.auditLog.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.invitation.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.generatedReport.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Memberships
  await prisma.unitUser.deleteMany({ where: { unit: { buildingId: BUILDING_ID } } });
  await prisma.userBuildingPermission.deleteMany({
    where: { userBuilding: { buildingId: BUILDING_ID } },
  });
  await prisma.boardResignation.deleteMany({
    where: { userBuilding: { buildingId: BUILDING_ID } },
  });
  await prisma.userBuilding.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Units + building + subscription
  await prisma.unit.deleteMany({ where: { buildingId: BUILDING_ID } });
  await prisma.building.deleteMany({ where: { id: BUILDING_ID } });
  await prisma.subscription.deleteMany({ where: { id: SUBSCRIPTION_ID } });

  // Demo users (only those scoped to @petofi23.local)
  if (demoUserIds.length > 0) {
    await prisma.userSession.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.backupCode.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Seeding demo: Petőfi Sándor utca 23.");
  console.log("  Cleaning previous demo data…");
  await cleanup();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // ─── Plan + Subscription ──────────────────────────────────────────────────

  // Use existing "pro" plan if present; otherwise upsert it.
  let proPlan = await prisma.plan.findUnique({ where: { slug: "pro" } });
  if (!proPlan) {
    proPlan = await prisma.plan.create({
      data: {
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
  }

  // ─── Building ─────────────────────────────────────────────────────────────

  const building = await prisma.building.create({
    data: {
      id: BUILDING_ID,
      name: "Petőfi Sándor utca 23. Társasház",
      address: "Petőfi Sándor utca 23.",
      city: "Budapest",
      zipCode: "1052",
    },
  });

  // ─── Manager user (közös képviselő) ───────────────────────────────────────

  const manager = await prisma.user.create({
    data: {
      id: "demo_user_kepviselo",
      email: MANAGER_EMAIL,
      passwordHash,
      name: MANAGER_NAME,
      language: "hu",
      emailVerifiedAt: new Date(),
      phone: "+36 30 222 4488",
    },
  });

  // ─── Subscription (owned by the manager) ──────────────────────────────────

  const subscription = await prisma.subscription.create({
    data: {
      id: SUBSCRIPTION_ID,
      name: "Petőfi 23. — Kerekes Tamás",
      email: MANAGER_EMAIL,
      planId: proPlan.id,
      subscriptionStatus: "ACTIVE",
      ownerId: manager.id,
    },
  });

  await prisma.building.update({
    where: { id: building.id },
    data: { subscriptionId: subscription.id },
  });

  // ─── Owners (24 users) ────────────────────────────────────────────────────

  const owners: Array<{ id: string; name: string; email: string }> = [];
  for (let i = 0; i < OWNER_NAMES.length; i++) {
    const name = OWNER_NAMES[i];
    const email = emailFor(name, i);
    const u = await prisma.user.create({
      data: {
        id: `demo_user_owner_${String(i + 1).padStart(2, "0")}`,
        email,
        passwordHash,
        name,
        language: "hu",
        emailVerifiedAt: new Date(),
      },
    });
    owners.push({ id: u.id, name, email });
  }

  // ─── Units (24) ───────────────────────────────────────────────────────────

  const shares = computeShares(UNIT_DEFS.map((u) => u.size));
  const units: Array<{ id: string; floor: number; position: number; share: number; size: number }> = [];
  for (let i = 0; i < UNIT_DEFS.length; i++) {
    const def = UNIT_DEFS[i];
    const number = unitLabel(def.floor, def.positionOnFloor);
    const u = await prisma.unit.create({
      data: {
        id: `demo_unit_${String(i + 1).padStart(2, "0")}`,
        number,
        floor: def.floor,
        positionOnFloor: def.positionOnFloor,
        ownershipShare: shares[i],
        size: def.size,
        buildingId: building.id,
      },
    });
    units.push({
      id: u.id,
      floor: def.floor,
      position: def.positionOnFloor,
      share: shares[i],
      size: def.size,
    });
  }

  // ─── UserBuilding — roles ─────────────────────────────────────────────────

  await prisma.userBuilding.create({
    data: { userId: manager.id, buildingId: building.id, role: BuildingRole.ADMIN },
  });
  for (let i = 0; i < owners.length; i++) {
    const role = BOARD_OWNER_INDICES.includes(i)
      ? BuildingRole.BOARD_MEMBER
      : BuildingRole.OWNER;
    await prisma.userBuilding.create({
      data: { userId: owners[i].id, buildingId: building.id, role },
    });
  }

  // ─── UnitUser — each owner owns the unit at their index ───────────────────

  for (let i = 0; i < owners.length; i++) {
    await prisma.unitUser.create({
      data: {
        userId: owners[i].id,
        unitId: units[i].id,
        relationship: UnitRelationship.OWNER,
        isPrimaryContact: true,
      },
    });
  }

  // ─── Board permissions catalog + grants ──────────────────────────────────

  await seedBoardPermissionsForBuilding(building.id);

  // ─── Accounts (chart of accounts) ─────────────────────────────────────────

  await prisma.account.createMany({
    data: [
      { name: "Közös költség bevétel", type: AccountType.INCOME, buildingId: building.id },
      { name: "Egyéb bevétel", type: AccountType.INCOME, buildingId: building.id },
      { name: "Üzemeltetés", type: AccountType.EXPENSE, buildingId: building.id },
      { name: "Karbantartás", type: AccountType.EXPENSE, buildingId: building.id },
      { name: "Közüzemi díjak", type: AccountType.EXPENSE, buildingId: building.id },
      { name: "Biztosítás", type: AccountType.EXPENSE, buildingId: building.id },
      { name: "Tartalékalap befizetés", type: AccountType.EXPENSE, buildingId: building.id },
      { name: "Folyószámla", type: AccountType.ASSET, buildingId: building.id },
      { name: "Tartalékalap számla", type: AccountType.ASSET, buildingId: building.id },
      { name: "Szállítói tartozás", type: AccountType.LIABILITY, buildingId: building.id },
    ],
  });

  // ─── Monthly charges — current month, mostly paid ─────────────────────────
  // 350 Ft/m² benchmark for V. kerület 2026. 19 paid, 3 overdue, 2 unpaid.

  const overdueIdx = new Set([2, 13, 18]); // szándékos: szétszórt egyenetlenség
  const unpaidIdx = new Set([7, 21]);
  for (let i = 0; i < units.length; i++) {
    const amount = Math.round(units[i].size * 350);
    let status: ChargeStatus;
    if (overdueIdx.has(i)) status = ChargeStatus.OVERDUE;
    else if (unpaidIdx.has(i)) status = ChargeStatus.UNPAID;
    else status = ChargeStatus.PAID;
    await prisma.monthlyCharge.create({
      data: {
        unitId: units[i].id,
        month: CURRENT_MONTH_STR,
        amount,
        status,
        paidAt: status === ChargeStatus.PAID ? D(-7, 9, 0) : null,
      },
    });
  }

  // Two prior months of charges, all paid — gives the finance view context.
  for (const offset of [1, 2]) {
    const d = new Date(NOW);
    d.setMonth(d.getMonth() - offset);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (let i = 0; i < units.length; i++) {
      const amount = Math.round(units[i].size * 350);
      await prisma.monthlyCharge.create({
        data: {
          unitId: units[i].id,
          month,
          amount,
          status: ChargeStatus.PAID,
          paidAt: new Date(d.getFullYear(), d.getMonth(), 8, 10, 0, 0),
        },
      });
    }
  }

  // ─── Communication channels ───────────────────────────────────────────────

  const allMemberIds = [manager.id, ...owners.map((o) => o.id)];

  const announceChannel = await prisma.channel.create({
    data: {
      buildingId: building.id,
      kind: "ANNOUNCEMENT",
      name: "Hirdetőtábla",
      isOfficial: true,
      members: { create: allMemberIds.map((id) => ({ userId: id })) },
    },
  });

  const generalChannel = await prisma.channel.create({
    data: {
      buildingId: building.id,
      kind: "TOPIC",
      name: "Általános",
      description: "Általános beszélgetés a házzal kapcsolatban",
      members: { create: allMemberIds.map((id) => ({ userId: id })) },
    },
  });

  const boardChannel = await prisma.channel.create({
    data: {
      buildingId: building.id,
      kind: "BOARD",
      name: "Igazgatótanács",
      description: "Csak igazgatótanácsi tagok",
      isPrivate: true,
      isOfficial: true,
      members: {
        create: [
          manager.id,
          ...BOARD_OWNER_INDICES.map((i) => owners[i].id),
        ].map((id) => ({ userId: id })),
      },
    },
  });

  // Announcements
  await prisma.channelMessage.create({
    data: {
      channelId: announceChannel.id,
      authorId: manager.id,
      kind: "POST",
      title: "Vízóra leolvasás — május 20–21.",
      body:
        "Tisztelt Lakók!\n\n" +
        "Tájékoztatom Önöket, hogy a féléves vízóra leolvasás 2026. május 20–21-én (szerda–csütörtök) történik, 08:00–18:00 között.\n\n" +
        "Kérem, hogy ezen időszakban legalább egy felnőtt személy tartózkodjon otthon, vagy adjon át kulcsot egy lakónak.\n\n" +
        "Köszönöm együttműködésüket!\n\n" +
        "Kerekes Tamás\nKözös képviselő",
      audience: { type: "all" },
      isPinned: true,
      createdAt: D(-2, 10, 0),
    },
  });

  await prisma.channelMessage.create({
    data: {
      channelId: announceChannel.id,
      authorId: manager.id,
      kind: "POST",
      title: "Közgyűlési meghívó — napirend",
      body:
        "Kedves Tulajdonostársak!\n\n" +
        `Ezúton hívom meg Önöket a Petőfi Sándor utca 23. társasház soron következő közgyűlésére, melynek időpontja: ${D(3, 18, 0).toLocaleDateString("hu-HU")}, 18:00.\n\n` +
        "Helyszín: tetőtéri közösségi szoba\n\n" +
        "Napirendi pontok:\n" +
        "1. Megnyitó, határozatképesség megállapítása\n" +
        "2. 2027. évi közös költség mértékének megállapítása (javaslat: +8%)\n" +
        "3. Lépcsőházi festési ajánlatok ismertetése (3 árajánlat érkezett)\n" +
        "4. Régi kapuvideófon csere — beruházási döntés (~2,4 M Ft)\n" +
        "5. Fenntartási alap szabályzat módosítása\n" +
        "6. Egyéb kérdések, javaslatok\n\n" +
        "Akadályoztatás esetén meghatalmazást a meghívóhoz csatolt formanyomtatványon lehet adni.\n\n" +
        "Üdvözlettel,\nKerekes Tamás",
      audience: { type: "all" },
      createdAt: D(-7, 9, 0),
    },
  });

  await prisma.channelMessage.create({
    data: {
      channelId: announceChannel.id,
      authorId: manager.id,
      kind: "POST",
      title: "Lépcsőházi festési árajánlatok beérkeztek",
      body:
        "Tájékoztatás: a három megkért árajánlat (Festőházak Bt., Faltükör Kft., Színhordó Kft.) megérkezett. " +
        "A részletes összehasonlító táblát a Dokumentumtár → Pénzügyi anyagok mappában megtekinthetik. " +
        "Döntés a közgyűlésen.",
      audience: { type: "all" },
      createdAt: D(-5, 14, 0),
    },
  });

  await prisma.channelMessage.create({
    data: {
      channelId: announceChannel.id,
      authorId: owners[BOARD_OWNER_INDICES[0]].id,
      kind: "POST",
      title: "IT — 2026. áprilisi belső megbeszélés összefoglaló",
      body:
        "Belső igazgatótanácsi összefoglaló a közgyűlés előtti egyeztetésről. " +
        "Részletes jegyzet a BOARD csatornán olvasható.",
      audience: { type: "board_only" },
      createdAt: D(-10, 19, 0),
    },
  });

  // Forum topic — Kapuvideófon vélemények
  const topic = await prisma.channelMessage.create({
    data: {
      channelId: generalChannel.id,
      authorId: owners[6].id, // Kiss Gábor
      kind: "POST",
      title: "Új kapuvideófon — vélemények, márkák?",
      body:
        "Sziasztok!\n\nA közgyűlésen szavazunk a kapuvideófon cseréről. Van valakinek tapasztalata a 2N, " +
        "Akuvox vagy Hikvision rendszerekkel? A jelenlegi 12 éves, már nem mindig kapcsol be reggelente. " +
        "Érdekel, hogy van-e olyan modell, amit telefonra is át lehet kapcsolni.",
      createdAt: D(-6, 20, 15),
    },
  });

  await prisma.channelMessage.createMany({
    data: [
      {
        channelId: generalChannel.id,
        authorId: owners[2].id, // Tóth László (board)
        kind: "CHAT",
        body:
          "Mi a régi lakásunkban Hikvision-t használtunk, megbízható. A telefonos átkapcsolás külön app-on " +
          "ment, de stabil volt. A három ajánlat közül kettő Hikvision-os, ha jól emlékszem.",
        parentId: topic.id,
        createdAt: D(-6, 21, 30),
      },
      {
        channelId: generalChannel.id,
        authorId: owners[15].id,
        kind: "CHAT",
        body:
          "Én inkább 2N-t javasolnék — drágább, de a vandálbiztos kivitel a kapunál fontos. Tavaly a " +
          "Tátra utcában cseréltek 2N-re, beszélgettem velük, nagyon elégedettek.",
        parentId: topic.id,
        createdAt: D(-5, 8, 45),
      },
      {
        channelId: generalChannel.id,
        authorId: owners[8].id,
        kind: "CHAT",
        body: "Engem inkább az árkülönbség érdekel. Van valakinél a táblázat link?",
        parentId: topic.id,
        createdAt: D(-5, 12, 10),
      },
      {
        channelId: generalChannel.id,
        authorId: manager.id,
        kind: "CHAT",
        body:
          "A részletes ajánlat-összehasonlítás a Dokumentumtárban: " +
          "Pénzügyi anyagok → 'Kapuvideófon árajánlatok 2026'. A közgyűlésen átfutom.",
        parentId: topic.id,
        createdAt: D(-5, 13, 0),
      },
    ],
  });

  // Board channel message
  await prisma.channelMessage.create({
    data: {
      channelId: boardChannel.id,
      authorId: manager.id,
      kind: "CHAT",
      body:
        "Holnap közgyűlés előtt 17:30-kor rövid egyeztetés a tetőtéri szobában. " +
        "Az árajánlatok rangsorát átfutjuk.",
      createdAt: D(2, 11, 0),
    },
  });

  // ─── Complaint categories + 1 active complaint ────────────────────────────

  const COMPLAINT_DEFAULTS = [
    { slug: "noise", name: "Zaj", icon: "🔊", sortOrder: 0 },
    { slug: "parking", name: "Parkolás", icon: "🚗", sortOrder: 1 },
    { slug: "smoking", name: "Dohányzás", icon: "🚬", sortOrder: 2 },
    { slug: "pets", name: "Állattartás", icon: "🐕", sortOrder: 3 },
    { slug: "common_area", name: "Közös területek", icon: "🏛️", sortOrder: 4 },
    { slug: "behavior", name: "Magatartás", icon: "👥", sortOrder: 5 },
    { slug: "other", name: "Egyéb", icon: "📝", sortOrder: 6 },
  ];
  for (const c of COMPLAINT_DEFAULTS) {
    await prisma.complaintCategory.create({
      data: { buildingId: building.id, isDefault: true, ...c },
    });
  }
  const noiseCat = await prisma.complaintCategory.findUniqueOrThrow({
    where: { buildingId_slug: { buildingId: building.id, slug: "noise" } },
  });

  await prisma.complaint.create({
    data: {
      authorId: owners[12].id, // Takács Zoltán
      categoryId: noiseCat.id,
      title: "Hétvégi hangos zene a IV/4-ből",
      description:
        "Az utóbbi három hétvégén többször előfordult, hogy a felettem lévő lakásból (IV/4) " +
        "péntek és szombat este 23 óra után erős zenét és kiabálást hallottam. Kérem szíves intézkedését.",
      isPrivate: true,
      trackingNumber: "CMP-DEMO-001",
      status: ComplaintStatus.ACKNOWLEDGED,
      buildingId: building.id,
      createdAt: D(-4, 9, 30),
      updatedAt: D(-3, 11, 0),
      statusEvents: {
        create: [
          {
            fromStatus: null,
            toStatus: ComplaintStatus.REPORTED,
            actorId: owners[12].id,
            createdAt: D(-4, 9, 30),
          },
          {
            fromStatus: ComplaintStatus.REPORTED,
            toStatus: ComplaintStatus.ACKNOWLEDGED,
            actorId: manager.id,
            note: "Felvettem a kapcsolatot a IV/4 tulajdonosával, a hétvégére egyeztetést kértem.",
            createdAt: D(-3, 11, 0),
          },
        ],
      },
    },
  });

  // ─── Scheduled maintenance ────────────────────────────────────────────────

  await prisma.scheduledMaintenance.createMany({
    data: [
      {
        title: "Lift éves felülvizsgálat",
        description: "Hatóságilag kötelező éves lift biztonsági felülvizsgálat.",
        date: D(45, 9, 0),
        isRecurring: true,
        recurrenceMonths: 12,
        leadTimeDays: 14,
        buildingId: building.id,
      },
      {
        title: "Tűzcsap- és tűzoltókészülék-ellenőrzés",
        description: "Kötelező féléves tűzvédelmi felülvizsgálat (lépcsőházi tűzcsapok + készülékek).",
        date: D(60, 10, 0),
        isRecurring: true,
        recurrenceMonths: 6,
        leadTimeDays: 7,
        buildingId: building.id,
      },
      {
        title: "Kéménysepri ellenőrzés",
        description: "Éves kéményseprő-ipari közszolgáltatás.",
        date: D(120, 8, 0),
        isRecurring: true,
        recurrenceMonths: 12,
        leadTimeDays: 21,
        buildingId: building.id,
      },
    ],
  });

  // ─── Contractors (shared/global) — upsert by name ─────────────────────────

  const liftProfi = await prisma.contractor.upsert({
    where: { id: "demo_contractor_lift" },
    update: {},
    create: {
      id: "demo_contractor_lift",
      name: "Lift-Profi Zrt.",
      specialty: "Lift karbantartás",
      contactInfo: "+36 1 555 0140, info@liftprofi.hu",
      taxId: "34567890-2-43",
    },
  });
  const festohazak = await prisma.contractor.upsert({
    where: { id: "demo_contractor_festo" },
    update: {},
    create: {
      id: "demo_contractor_festo",
      name: "Festőházak Bt.",
      specialty: "Festés, mázolás",
      contactInfo: "+36 70 444 0011, festohazak@gmail.com",
      taxId: "22113344-1-42",
    },
  });

  // ─── Maintenance tickets ──────────────────────────────────────────────────

  const ticketLift = await prisma.maintenanceTicket.create({
    data: {
      title: "Lift váratlanul megáll a IV. emeleten",
      description:
        "Az utóbbi két napban már háromszor előfordult, hogy a lift a IV. és V. emelet között " +
        "rövid időre megáll, majd magától továbbmegy. Tegnap az egyik lakó 5 percre beragadt. " +
        "Sürgős vizsgálatot kérek.",
      category: MaintenanceCategory.ELEVATOR,
      location: "Főlift, IV/V. emelet között",
      urgency: Urgency.CRITICAL,
      status: TicketStatus.ACKNOWLEDGED,
      trackingNumber: "TKT-DEMO-001",
      reporterId: owners[18].id, // Rácz György
      buildingId: building.id,
      slaHours: 24,
      createdAt: D(-1, 7, 45),
      updatedAt: D(-1, 9, 30),
    },
  });

  await prisma.ticketComment.createMany({
    data: [
      {
        ticketId: ticketLift.id,
        authorId: manager.id,
        body:
          "A Lift-Profi Zrt.-t értesítettem, mai napon délután kiszállnak helyszíni vizsgálatra. " +
          "A lift ideiglenes korlátozás alá kerül (V. emeletig nem közlekedik) a beragadási kockázat miatt.",
        createdAt: D(-1, 9, 30),
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      entityType: "MaintenanceTicket",
      entityId: ticketLift.id,
      action: "UPDATE",
      userId: manager.id,
      buildingId: building.id,
      oldValue: { status: "SUBMITTED" },
      newValue: { status: "ACKNOWLEDGED" },
      createdAt: D(-1, 9, 30),
    },
  });

  await prisma.maintenanceTicket.create({
    data: {
      title: "II. emeleti lépcső csempe meglazult",
      description:
        "A II. emeleti pihenőnél két csempe szembetűnően meglazult, az egyik kissé el is mozdul " +
        "rálépéskor. Botlásveszély, főleg idősebb lakóknak.",
      category: MaintenanceCategory.COMMON_AREA,
      location: "II. emeleti lépcsőpihenő",
      urgency: Urgency.MEDIUM,
      status: TicketStatus.ASSIGNED,
      trackingNumber: "TKT-DEMO-002",
      reporterId: owners[3].id, // Szabó Anna
      assignedContractorId: festohazak.id,
      buildingId: building.id,
      slaHours: 168,
      createdAt: D(-5, 16, 20),
      updatedAt: D(-4, 10, 0),
    },
  });

  await prisma.maintenanceTicket.create({
    data: {
      title: "Földszinti folyosó — villanyégő csere",
      description:
        "A bejárati folyosó hátsó lámpája kiégett. Egyszerű égőcsere.",
      category: MaintenanceCategory.ELECTRICAL,
      location: "Földszinti bejárati folyosó",
      urgency: Urgency.LOW,
      status: TicketStatus.COMPLETED,
      trackingNumber: "TKT-DEMO-003",
      reporterId: owners[20].id,
      buildingId: building.id,
      createdAt: D(-14, 18, 0),
      updatedAt: D(-13, 14, 0),
    },
  });

  await prisma.maintenanceTicket.create({
    data: {
      title: "Pincei csőtörés — befejezve",
      description:
        "A pincei melléktároló feletti hideg vizes ág megrepedt, a Lift-Profi Zrt. " +
        "vízszerelő részlege orvosolta. Helyreállítás megtörtént, számla beérkezett.",
      category: MaintenanceCategory.PLUMBING,
      location: "Pince, 4. melléktároló",
      urgency: Urgency.HIGH,
      status: TicketStatus.VERIFIED,
      trackingNumber: "TKT-DEMO-004",
      reporterId: manager.id,
      assignedContractorId: liftProfi.id,
      buildingId: building.id,
      createdAt: D(-22, 8, 0),
      updatedAt: D(-19, 16, 0),
    },
  });

  // ─── Document categories + documents ──────────────────────────────────────

  const docCatRules = await prisma.documentCategory.create({
    data: { name: "Szabályzatok", icon: "📜", sortOrder: 0, buildingId: building.id },
  });
  const docCatMinutes = await prisma.documentCategory.create({
    data: { name: "Közgyűlési jegyzőkönyvek", icon: "📋", sortOrder: 1, buildingId: building.id },
  });
  const docCatFinance = await prisma.documentCategory.create({
    data: { name: "Pénzügyi anyagok", icon: "💰", sortOrder: 2, buildingId: building.id },
  });
  const docCatContracts = await prisma.documentCategory.create({
    data: { name: "Szerződések", icon: "📝", sortOrder: 3, buildingId: building.id },
  });

  await createDocument({
    title: "Házirend (érvényes)",
    description: "A Petőfi Sándor utca 23. társasház hatályos házirendje (2024. évi módosítás).",
    categoryId: docCatRules.id,
    uploaderId: manager.id,
    fileName: "Hazirend_2024.pdf",
    visibility: DocumentVisibility.PUBLIC,
    tags: ["házirend", "szabályok"],
    isPinned: true,
    createdAt: D(-180, 10, 0),
  });

  await createDocument({
    title: "Szervezeti és Működési Szabályzat (SZMSZ)",
    description: "Az alapító okiratot kiegészítő SZMSZ.",
    categoryId: docCatRules.id,
    uploaderId: manager.id,
    fileName: "SZMSZ_v3.pdf",
    visibility: DocumentVisibility.PUBLIC,
    tags: ["SZMSZ", "alapító okirat"],
    createdAt: D(-365, 10, 0),
  });

  await createDocument({
    title: "2026. évi költségvetés",
    description: "Az idei éves költségvetés és tartalékalap-terv.",
    categoryId: docCatFinance.id,
    uploaderId: manager.id,
    fileName: "Koltsegvetes_2026.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    visibility: DocumentVisibility.PUBLIC,
    tags: ["költségvetés", "2026"],
    createdAt: D(-120, 9, 0),
  });

  await createDocument({
    title: "2025. évi pénzügyi beszámoló",
    description: "Az előző évi pénzügyi zárszámadás.",
    categoryId: docCatFinance.id,
    uploaderId: manager.id,
    fileName: "Beszamolo_2025.pdf",
    visibility: DocumentVisibility.PUBLIC,
    tags: ["beszámoló", "2025"],
    createdAt: D(-100, 9, 0),
  });

  await createDocument({
    title: "Kapuvideófon árajánlatok 2026",
    description: "Három árajánlat összehasonlítása a kapuvideófon cseréhez.",
    categoryId: docCatFinance.id,
    uploaderId: manager.id,
    fileName: "Kapuvideofon_ajanlatok_2026.pdf",
    visibility: DocumentVisibility.PUBLIC,
    tags: ["árajánlat", "kapuvideófon", "közgyűlés"],
    createdAt: D(-5, 14, 0),
  });

  await createDocument({
    title: "Lépcsőházi festés — 3 árajánlat",
    description: "Festőházak Bt., Faltükör Kft., Színhordó Kft. összehasonlítása.",
    categoryId: docCatFinance.id,
    uploaderId: manager.id,
    fileName: "Festes_ajanlatok_2026.pdf",
    visibility: DocumentVisibility.PUBLIC,
    tags: ["árajánlat", "festés", "közgyűlés"],
    createdAt: D(-5, 14, 15),
  });

  await createDocument({
    title: "Lift karbantartási szerződés (Lift-Profi Zrt.)",
    description: "Hatályos lift karbantartási szerződés, 2024–2027.",
    categoryId: docCatContracts.id,
    uploaderId: manager.id,
    fileName: "Lift_szerzodes_2024-2027.pdf",
    visibility: DocumentVisibility.BOARD_ONLY,
    tags: ["szerződés", "lift", "karbantartás"],
    expiresAt: D(540, 0, 0),
    createdAt: D(-400, 10, 0),
  });

  // ─── Past meeting (closed, with vote + minutes signatures) ────────────────

  const pastMeeting = await prisma.meeting.create({
    data: {
      title: "Rendkívüli közgyűlés — Lift modernizáció",
      description:
        "Rendkívüli közgyűlés a régi lift modernizációs ajánlatainak megtárgyalására és a kivitelező " +
        "kiválasztására.",
      date: D(-32, 18, 0),
      time: "18:00",
      location: "Tetőtéri közösségi szoba",
      agenda: [
        "1. Megnyitó, határozatképesség megállapítása",
        "2. Lift modernizációs árajánlatok ismertetése",
        "3. Szavazás a kivitelezőről",
        "4. Egyéb ügyek",
      ],
      createdById: manager.id,
      buildingId: building.id,
      createdAt: D(-50, 10, 0),
      updatedAt: D(-32, 22, 0),
      minutes:
        "JEGYZŐKÖNYV\n" +
        "Petőfi Sándor utca 23. társasház rendkívüli közgyűlése\n\n" +
        `Időpont: ${D(-32, 18, 0).toLocaleString("hu-HU")}\n` +
        "Helyszín: Tetőtéri közösségi szoba\n\n" +
        "1. Megnyitó:\n" +
        "Kerekes Tamás közös képviselő megnyitja a közgyűlést. A jelenléti ív alapján 19 lakás " +
        "tulajdoni hányad szerint 79,2%-os képviselete biztosított. A közgyűlés határozatképes.\n\n" +
        "2. Lift modernizációs ajánlatok:\n" +
        "Kerekes Tamás bemutatja a három beérkezett ajánlatot (Lift-Profi Zrt. 11,8 M Ft, " +
        "LiftLogic Kft. 13,4 M Ft, EuroLift Zrt. 12,9 M Ft). A részletes összehasonlító táblát " +
        "a tulajdonosok megkapták.\n\n" +
        "3. Szavazás:\n" +
        "1/2026. számú határozat: A közgyűlés elfogadja a Lift-Profi Zrt. 11,8 M Ft + áfa " +
        "összegű ajánlatát a lift teljes modernizációjára.\n" +
        "Szavazás eredménye: 75,6% IGEN, 1,8% NEM, fennmaradó hányad távollévő. " +
        "A határozat megfelel a kétharmados többségi követelménynek, ELFOGADVA.\n\n" +
        "4. Egyéb:\n" +
        "Kerekes Tamás tájékoztat a vízóra leolvasás közelgő időpontjáról.\n\n" +
        "A közgyűlést Kerekes Tamás 19:35-kor berekeszti.",
      minutesUpdatedAt: D(-31, 11, 0),
      minutesUpdatedById: manager.id,
    },
  });

  // Past meeting attendance — 19 of 24 units checked in
  const attendedUnitIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14, 15, 16, 18, 19, 21, 23];
  for (const i of attendedUnitIndices) {
    await prisma.meetingAttendance.create({
      data: {
        meetingId: pastMeeting.id,
        unitId: units[i].id,
        checkedIn: true,
        checkedInAt: D(-32, 17, 50 + (i % 10)),
        checkedOutAt: D(-32, 19, 35),
      },
    });
  }

  // Past meeting RSVPs (mirror attendance roughly)
  await prisma.meetingRsvp.createMany({
    data: attendedUnitIndices.map((i) => ({
      meetingId: pastMeeting.id,
      userId: owners[i].id,
      status: RsvpStatus.ATTENDING,
    })),
  });

  // Past vote — closed, passed
  const pastVote = await prisma.vote.create({
    data: {
      title: "1/2026. — Lift modernizáció: Lift-Profi Zrt. ajánlata",
      description:
        "Elfogadjuk-e a Lift-Profi Zrt. 11,8 M Ft + áfa összegű ajánlatát a főlift " +
        "teljes modernizációjára (új vezérlés, ajtóautomatika, kabin-felújítás)?",
      voteType: VoteType.YES_NO,
      status: VoteStatus.CLOSED,
      isSecret: false,
      majorityType: MajorityType.TWO_THIRDS,
      quorumRequired: 0.5,
      deadline: D(-32, 19, 30),
      buildingId: building.id,
      meetingId: pastMeeting.id,
      createdById: manager.id,
      createdAt: D(-32, 18, 30),
      updatedAt: D(-32, 19, 30),
    },
  });
  const pastYesOption = await prisma.voteOption.create({
    data: { voteId: pastVote.id, label: "Igen, elfogadom", sortOrder: 0 },
  });
  const pastNoOption = await prisma.voteOption.create({
    data: { voteId: pastVote.id, label: "Nem", sortOrder: 1 },
  });

  // Ballots: most of the attending units voted YES; unit 6 voted NO.
  const yesUnitIndices = attendedUnitIndices.filter((i) => i !== 6);
  for (const i of yesUnitIndices) {
    await prisma.ballot.create({
      data: {
        voteId: pastVote.id,
        optionId: pastYesOption.id,
        unitId: units[i].id,
        userId: owners[i].id,
        weight: units[i].share,
        createdAt: D(-32, 18, 50 + (i % 10)),
      },
    });
  }
  await prisma.ballot.create({
    data: {
      voteId: pastVote.id,
      optionId: pastNoOption.id,
      unitId: units[6].id,
      userId: owners[6].id,
      weight: units[6].share,
      createdAt: D(-32, 19, 5),
    },
  });

  // Minutes signatures — chair + 2 hitelesítő
  await prisma.meetingMinutesSignature.createMany({
    data: [
      {
        meetingId: pastMeeting.id,
        signerId: manager.id,
        role: "CHAIR",
        signedAt: D(-31, 11, 5),
      },
      {
        meetingId: pastMeeting.id,
        signerId: owners[BOARD_OWNER_INDICES[0]].id,
        role: "AUTHENTICATOR_1",
        signedAt: D(-31, 11, 15),
      },
      {
        meetingId: pastMeeting.id,
        signerId: owners[BOARD_OWNER_INDICES[1]].id,
        role: "AUTHENTICATOR_2",
        signedAt: D(-31, 11, 30),
      },
    ],
  });

  // Past meeting jegyzőkönyv as a document too (for the documents page)
  await createDocument({
    title: "Rendkívüli közgyűlés jegyzőkönyv — lift modernizáció",
    description: "Az aláírt jegyzőkönyv PDF-je (1/2026. határozat).",
    categoryId: docCatMinutes.id,
    uploaderId: manager.id,
    fileName: "Jegyzokonyv_2026_rendkivuli.pdf",
    visibility: DocumentVisibility.PUBLIC,
    tags: ["jegyzőkönyv", "2026", "lift"],
    createdAt: D(-31, 12, 0),
  });

  // ─── Upcoming meeting (in 3 days) + DRAFT votes ───────────────────────────

  const upcomingMeeting = await prisma.meeting.create({
    data: {
      title: "2026. évi rendes közgyűlés",
      description:
        "A 2003. évi CXXXIII. tv. szerinti évi rendes közgyűlés. Napirenden a 2027. évi közös " +
        "költség, lépcsőházi festés, kapuvideófon csere és fenntartási alap szabályzat.",
      date: D(3, 18, 0),
      time: "18:00",
      location: "Tetőtéri közösségi szoba",
      agenda: [
        "1. Megnyitó, határozatképesség megállapítása",
        "2. 2027. évi közös költség mértékének megállapítása (+8% javaslat)",
        "3. Lépcsőházi festési ajánlatok ismertetése (3 árajánlat)",
        "4. Régi kapuvideófon csere — beruházási döntés (~2,4 M Ft)",
        "5. Fenntartási alap szabályzat módosítása",
        "6. Egyéb kérdések, javaslatok",
      ],
      createdById: manager.id,
      buildingId: building.id,
      createdAt: D(-14, 10, 0),
      updatedAt: D(-7, 9, 0),
    },
  });

  // RSVPs — a healthy mix, demoing the dashboard
  const attending = [0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20];
  const notAttending = [7, 17];
  const proxy = [9, 22];
  // remaining indices (21, 23) are pending — no RSVP yet
  await prisma.meetingRsvp.createMany({
    data: [
      ...attending.map((i) => ({
        meetingId: upcomingMeeting.id,
        userId: owners[i].id,
        status: RsvpStatus.ATTENDING,
      })),
      ...notAttending.map((i) => ({
        meetingId: upcomingMeeting.id,
        userId: owners[i].id,
        status: RsvpStatus.NOT_ATTENDING,
      })),
      ...proxy.map((i) => ({
        meetingId: upcomingMeeting.id,
        userId: owners[i].id,
        status: RsvpStatus.PROXY,
      })),
    ],
  });

  // DRAFT vote 1 — 2027 közös költség 8% emelés (simple majority)
  const draftVote1 = await prisma.vote.create({
    data: {
      title: "2/2026. — 2027. évi közös költség emelése +8%",
      description:
        "A 2027. évre javasolt közös költség 8%-os emelése a tartalékalap erősítése és a " +
        "működési költségek inflációkövetése érdekében. Részletes előterjesztés a " +
        "dokumentumtárban (2026 költségvetés melléklet).",
      voteType: VoteType.YES_NO,
      status: VoteStatus.DRAFT,
      isSecret: false,
      majorityType: MajorityType.SIMPLE_MAJORITY,
      quorumRequired: 0.5,
      deadline: D(3, 19, 30),
      buildingId: building.id,
      meetingId: upcomingMeeting.id,
      createdById: manager.id,
      createdAt: D(-7, 9, 0),
      updatedAt: D(-7, 9, 0),
    },
  });
  await prisma.voteOption.createMany({
    data: [
      { voteId: draftVote1.id, label: "Igen, elfogadom a 8%-os emelést", sortOrder: 0 },
      { voteId: draftVote1.id, label: "Nem", sortOrder: 1 },
    ],
  });

  // DRAFT vote 2 — Kapuvideófon csere (two-thirds, major investment)
  const draftVote2 = await prisma.vote.create({
    data: {
      title: "3/2026. — Kapuvideófon csere (~2,4 M Ft beruházás)",
      description:
        "A jelenlegi (12 éves) kapuvideófon-rendszer cseréje. Beérkezett három árajánlat " +
        "1,9–2,4 M Ft között (lásd dokumentumtár). A kétharmados szavazás a 2,4 M Ft " +
        "felső limit jóváhagyására vonatkozik.",
      voteType: VoteType.YES_NO,
      status: VoteStatus.DRAFT,
      isSecret: true, // titkos szavazás demonstrálására
      majorityType: MajorityType.TWO_THIRDS,
      quorumRequired: 0.5,
      deadline: D(3, 19, 45),
      buildingId: building.id,
      meetingId: upcomingMeeting.id,
      createdById: manager.id,
      createdAt: D(-7, 9, 15),
      updatedAt: D(-7, 9, 15),
    },
  });
  await prisma.voteOption.createMany({
    data: [
      { voteId: draftVote2.id, label: "Igen, jóváhagyom a 2,4 M Ft beruházást", sortOrder: 0 },
      { voteId: draftVote2.id, label: "Nem", sortOrder: 1 },
    ],
  });

  // ─── Tasks ────────────────────────────────────────────────────────────────

  await prisma.task.createMany({
    data: [
      {
        buildingId: building.id,
        title: "Közgyűlés napirend véglegesítés",
        body: "Igazgatótanácsi egyeztetés után a napirend végleges sorrendje.",
        dueDate: D(2, 17, 0),
        priority: "HIGH",
        status: "OPEN",
        createdById: manager.id,
        assigneeId: manager.id,
      },
      {
        buildingId: building.id,
        title: "Lift-Profi Zrt. — modernizáció ütemterv egyeztetés",
        body: "A jegyzőkönyv aláírása után a kivitelezővel egyeztetni a munkakezdést.",
        dueDate: D(5, 12, 0),
        priority: "NORMAL",
        status: "OPEN",
        createdById: manager.id,
        assigneeId: manager.id,
      },
      {
        buildingId: building.id,
        title: "Késedelmes közös költség — felszólító levelek",
        body: "3 érintett lakás (III/3, IV/5, V/4) — 30 napon túli tartozás.",
        dueDate: D(7, 12, 0),
        priority: "NORMAL",
        status: "OPEN",
        createdById: manager.id,
        assigneeId: manager.id,
      },
    ],
  });

  console.log("\nDemo seed complete.");
  console.log(`  Building: Petőfi Sándor utca 23. (${BUILDING_ID})`);
  console.log(`  Units: ${units.length}`);
  console.log(`  Owners: ${owners.length}`);
  console.log(`  Manager login: ${MANAGER_EMAIL} / ${PASSWORD}`);
  console.log(`  Upcoming közgyűlés: ${D(3, 18, 0).toLocaleString("hu-HU")}`);
  console.log(`  Past meeting (closed + signed): ${D(-32, 18, 0).toLocaleString("hu-HU")}`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createDocument(args: {
  title: string;
  description: string;
  categoryId: string;
  uploaderId: string;
  fileName: string;
  mimeType?: string;
  visibility: DocumentVisibility;
  tags: string[];
  isPinned?: boolean;
  expiresAt?: Date | null;
  createdAt: Date;
}): Promise<void> {
  const mimeType = args.mimeType ?? "application/pdf";
  const doc = await prisma.document.create({
    data: {
      title: args.title,
      description: args.description,
      categoryId: args.categoryId,
      visibility: args.visibility,
      tags: args.tags,
      isPinned: args.isPinned ?? false,
      expiresAt: args.expiresAt ?? null,
      uploadedById: args.uploaderId,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    },
  });
  await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      versionNumber: 1,
      fileUrl: `/documents/${args.fileName}`,
      fileName: args.fileName,
      fileSize: 200000 + Math.floor(Math.random() * 100000),
      mimeType,
      uploadedById: args.uploaderId,
      uploadedAt: args.createdAt,
    },
  });
}

const BOARD_PERM_KEYS = [
  "financial_full",
  "invoice_signoff",
  "board_post",
  "vote_create",
  "edit_resident_contact",
  "maintenance_orders",
];

async function seedBoardPermissionsForBuilding(buildingId: string): Promise<void> {
  // Catalog rows are seeded by the main `seed.ts`. If they're missing
  // (someone running demo seed standalone), upsert the keys we use.
  const permIds: Record<string, string> = {};
  for (let i = 0; i < BOARD_PERM_KEYS.length; i++) {
    const key = BOARD_PERM_KEYS[i];
    const row = await prisma.boardPermission.upsert({
      where: { key },
      update: {},
      create: {
        id: `seed_perm_${key}`,
        key,
        labelKey: `perm.${key}.label`,
        descriptionKey: `perm.${key}.desc`,
        sortOrder: i,
      },
    });
    permIds[key] = row.id;
  }

  const ubs = await prisma.userBuilding.findMany({
    where: {
      buildingId,
      role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] },
      isActive: true,
    },
    select: { id: true },
  });
  for (const ub of ubs) {
    for (const key of BOARD_PERM_KEYS) {
      await prisma.userBuildingPermission.upsert({
        where: {
          userBuildingId_permissionId: {
            userBuildingId: ub.id,
            permissionId: permIds[key],
          },
        },
        update: {},
        create: { userBuildingId: ub.id, permissionId: permIds[key] },
      });
    }
  }
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
