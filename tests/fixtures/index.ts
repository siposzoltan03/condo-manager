import { prisma } from "@/lib/prisma";
import type {
  BuildingRole,
  ContractorOrg,
  ContractorUserRole,
  MaintenanceCategory,
  MarketplacePublication,
  TicketStatus,
  Urgency,
} from "@prisma/client";
import { hash } from "bcryptjs";

/**
 * Counter for unique-but-stable fixture values within a test run.
 * Reset is implicit via the per-test TRUNCATE — counters can drift safely.
 */
let seq = 0;
const nextId = () => `${Date.now()}-${++seq}`;

/**
 * Paired-tenant building factory. Returns the primary `building` and a
 * sibling `otherBuilding` — every Phase 0 test that touches building-scoped
 * data should also assert the *other* building sees nothing or 403s. See
 * tests/README.md and the refactor plan §3 Phase 0.
 */
export async function makeBuilding(overrides: { name?: string } = {}) {
  const tag = nextId();
  const [building, otherBuilding] = await Promise.all([
    prisma.building.create({
      data: {
        name: overrides.name ?? `Test Building ${tag}`,
        address: `1 Test St #${tag}`,
        city: "Budapest",
        zipCode: "1011",
      },
    }),
    prisma.building.create({
      data: {
        name: `Other Building ${tag}`,
        address: `2 Other Ave #${tag}`,
        city: "Budapest",
        zipCode: "1012",
      },
    }),
  ]);
  return { building, otherBuilding };
}

/**
 * Paired-tenant contractor-org factory. Defaults to ACTIVE status and a
 * single matching specialty ("plumbing") so the marketplace flows work
 * out-of-the-box; override for ORG_NOT_ACTIVE / SPECIALTY_MISMATCH tests.
 */
export async function makeContractorOrg(overrides: {
  name?: string;
  status?: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
  specialties?: string[];
} = {}) {
  const tag = nextId();
  const [org, otherOrg] = await Promise.all([
    prisma.contractorOrg.create({
      data: {
        name: overrides.name ?? `Test Org ${tag}`,
        taxId: `1${tag.replace(/-/g, "").slice(-9).padStart(9, "0")}`,
        status: overrides.status ?? "ACTIVE",
        specialties: overrides.specialties ?? ["plumbing"],
      },
    }),
    prisma.contractorOrg.create({
      data: {
        name: `Other Org ${tag}`,
        taxId: `2${tag.replace(/-/g, "").slice(-9).padStart(9, "0")}`,
        status: overrides.status ?? "ACTIVE",
        specialties: overrides.specialties ?? ["plumbing"],
      },
    }),
  ]);
  return { org, otherOrg };
}

/**
 * Create a user attached to a building with the given role. Default role is
 * RESIDENT. The returned user has `userBuildings` populated.
 */
export async function makeUser(opts: {
  buildingId: string;
  email?: string;
  name?: string;
  role?: BuildingRole;
  password?: string;
}) {
  const tag = nextId();
  const passwordHash = await hash(opts.password ?? "test-password-12345", 10);
  return prisma.user.create({
    data: {
      email: opts.email ?? `user-${tag}@test.local`,
      name: opts.name ?? `Test User ${tag}`,
      passwordHash,
      userBuildings: {
        create: {
          buildingId: opts.buildingId,
          role: opts.role ?? "OWNER",
        },
      },
    },
    include: { userBuildings: true },
  });
}

/**
 * Create a user with no building attachment — for fixtures like Subscription
 * owners or the placeholder user before they accept an invitation.
 */
export async function makeStandaloneUser(opts: { email?: string; name?: string } = {}) {
  const tag = nextId();
  const passwordHash = await hash("test-password-12345", 10);
  return prisma.user.create({
    data: {
      email: opts.email ?? `user-${tag}@test.local`,
      name: opts.name ?? `Test User ${tag}`,
      passwordHash,
    },
  });
}

/**
 * Create a Plan row. Defaults reflect a small condo plan; override individual
 * fields to test downgrade / unlimited scenarios.
 */
export async function makePlan(overrides: {
  slug?: string;
  name?: string;
  stripePriceId?: string | null;
  maxBuildings?: number;
  maxUnitsPerBuilding?: number;
  trialDays?: number;
} = {}) {
  const tag = nextId();
  return prisma.plan.create({
    data: {
      slug: overrides.slug ?? `plan-${tag}`,
      name: overrides.name ?? `Test Plan ${tag}`,
      stripePriceId: overrides.stripePriceId ?? `price_${tag}`,
      maxBuildings: overrides.maxBuildings ?? 1,
      maxUnitsPerBuilding: overrides.maxUnitsPerBuilding ?? 50,
      priceMonthly: 9.99,
      priceYearly: 99.99,
      trialDays: overrides.trialDays ?? 14,
    },
  });
}

/**
 * Create a ContractorUser inside an existing ContractorOrg. Defaults to the
 * OWNER role, which is what the marketplace flows (winner email, notify)
 * target.
 */
export async function makeContractorUser(opts: {
  orgId: string;
  email?: string;
  name?: string;
  role?: ContractorUserRole;
}) {
  const tag = nextId();
  const passwordHash = await hash("test-password-12345", 10);
  return prisma.contractorUser.create({
    data: {
      orgId: opts.orgId,
      email: opts.email ?? `cuser-${tag}@test.local`,
      name: opts.name ?? `Test Contractor User ${tag}`,
      passwordHash,
      role: opts.role ?? "OWNER",
    },
  });
}

/**
 * Create a MaintenanceTicket on a building. The reporter is created
 * implicitly if not provided.
 */
export async function makeMaintenanceTicket(opts: {
  buildingId: string;
  reporterId?: string;
  title?: string;
  status?: TicketStatus;
  category?: MaintenanceCategory;
  urgency?: Urgency;
  location?: string;
}) {
  const tag = nextId();
  let reporterId = opts.reporterId;
  if (!reporterId) {
    const reporter = await makeUser({ buildingId: opts.buildingId });
    reporterId = reporter.id;
  }
  return prisma.maintenanceTicket.create({
    data: {
      buildingId: opts.buildingId,
      reporterId,
      title: opts.title ?? `Test Ticket ${tag}`,
      description: `Test description ${tag}`,
      category: opts.category ?? "PLUMBING",
      urgency: opts.urgency ?? "MEDIUM",
      status: opts.status ?? "SUBMITTED",
      location: opts.location ?? null,
      trackingNumber: `T-${tag}`,
    },
  });
}

/**
 * Create a MarketplacePublication on an existing ticket. The publisher is
 * created if not provided.
 */
export async function makePublication(opts: {
  ticketId: string;
  buildingId: string;
  publishedById?: string;
  status?: MarketplacePublication["status"];
  scrubbedTitle?: string;
  specialties?: string[];
}): Promise<MarketplacePublication> {
  const tag = nextId();
  let publishedById = opts.publishedById;
  if (!publishedById) {
    const publisher = await makeUser({
      buildingId: opts.buildingId,
      role: "BOARD_MEMBER",
    });
    publishedById = publisher.id;
  }
  return prisma.marketplacePublication.create({
    data: {
      ticketId: opts.ticketId,
      status: opts.status ?? "OPEN",
      scrubbedTitle: opts.scrubbedTitle ?? `Pub ${tag}`,
      scrubbedDescription: `Scrubbed description ${tag}`,
      category: "PLUMBING",
      urgency: "MEDIUM",
      city: "Budapest",
      zip: "1011",
      specialties: opts.specialties ?? ["plumbing"],
      boardContactEmail: "board@test.local",
      publishedById,
      publisherDisplayName: "Test Board",
    },
  });
}

/**
 * Create a MarketplaceBid on a publication.
 */
export async function makeBid(opts: {
  publicationId: string;
  bidderOrgId: string;
  amount?: number;
  etaDays?: number;
  status?: "SUBMITTED" | "WON" | "REJECTED" | "WITHDRAWN";
}) {
  return prisma.marketplaceBid.create({
    data: {
      publicationId: opts.publicationId,
      bidderId: opts.bidderOrgId,
      amount: opts.amount ?? 100000,
      etaDays: opts.etaDays ?? 7,
      status: opts.status ?? "SUBMITTED",
    },
  });
}

export type SeededContractorOrg = ContractorOrg;
