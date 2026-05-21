import { prisma } from "@/lib/prisma";

/**
 * Contractor Data Access Layer.
 *
 * Every function that operates on a contractor org's data takes `orgId`
 * as its first parameter — the route's job is to obtain the right
 * `orgId` from `requireContractorOwner()` / `requireContractor()`, and
 * the DAL's job is to scope every query by it. This collapses the
 * problem-#7 surface (ad-hoc `where: { id: orgId }` scattered across
 * routes) into one boundary.
 *
 * Functions that look up a *resource* by id (e.g. a document) take
 * `orgId` AND the resource id and return null if the resource doesn't
 * belong to that org — cross-tenant access can't succeed even with a
 * leaked id.
 *
 * Public/non-org-scoped operations (signup, email-verify by token,
 * tax-id uniqueness) are NOT in this file — they live in their own
 * service flows. The constraint "orgId first" doesn't fit those.
 */

// ────────────────────────────────────────────────────────────────────────
// ContractorOrg reads (org-scoped)
// ────────────────────────────────────────────────────────────────────────

export async function getOrgStatus(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: { status: true },
  });
}

/**
 * Public uniqueness check for the inline signup-form tax-id check.
 * Not org-scoped — there's no session at this point.
 */
export async function findOrgByTaxId(taxId: string) {
  return prisma.contractorOrg.findUnique({
    where: { taxId },
    select: { id: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Pre-auth flows (signup, email verification) — not org-scoped
// ────────────────────────────────────────────────────────────────────────

export async function findContractorUserById(id: string) {
  return prisma.contractorUser.findUnique({
    where: { id },
    select: { id: true, emailVerifiedAt: true },
  });
}

export async function setContractorUserEmailVerified(id: string, at: Date) {
  return prisma.contractorUser.update({
    where: { id },
    data: { emailVerifiedAt: at },
  });
}

export async function findContractorUserByEmail(email: string) {
  return prisma.contractorUser.findUnique({
    where: { email },
    select: { id: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Activation flow (lib/contractor/activation.ts)
// ────────────────────────────────────────────────────────────────────────

export async function getOrgForReadiness(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: {
      navConfirmedAt: true,
      dpaSignedAt: true,
      specialties: true,
      regions: true,
      documents: { select: { kind: true } },
    },
  });
}

export async function getOrgForActivation(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: {
      status: true,
      name: true,
      users: {
        where: { role: "OWNER" },
        select: { email: true, name: true },
        take: 1,
      },
    },
  });
}

export async function setOrgStatusActive(orgId: string) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: { status: "ACTIVE" },
  });
}

/**
 * Atomically create a contractor org + its owner ContractorUser. Used
 * by the signup route; everything in `input` is validated upstream.
 */
export async function createContractorOrgWithOwner(input: {
  org: {
    name: string;
    taxId: string;
    status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
    plan: "FREE" | "PRO" | "PREMIUM";
    planStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
    trialEndsAt: Date | null;
  };
  owner: {
    email: string;
    passwordHash: string;
    name: string;
    phone?: string;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.contractorOrg.create({ data: input.org });
    const user = await tx.contractorUser.create({
      data: {
        orgId: org.id,
        email: input.owner.email,
        passwordHash: input.owner.passwordHash,
        name: input.owner.name,
        phone: input.owner.phone,
        role: "OWNER",
      },
    });
    return { org, user };
  });
}

export async function getOrgName(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
}

export async function getOrgSpecialties(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: { specialties: true },
  });
}

export async function getOrgForBillingPage(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: {
      status: true,
      currentPeriodEndsAt: true,
      specialties: true,
      regions: true,
    },
  });
}

export async function getOrgForBillingCheckout(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      users: {
        where: { role: "OWNER" },
        select: { email: true },
        take: 1,
      },
    },
  });
}

export async function getOrgForOnboardingWizard(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      taxId: true,
      description: true,
      websiteUrl: true,
      logoUrl: true,
      specialties: true,
      regions: true,
      status: true,
      plan: true,
      navConfirmedAt: true,
      dpaSignedAt: true,
      documents: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          validUntil: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getOrgForFinalize(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      taxId: true,
      navConfirmedAt: true,
      dpaSignedAt: true,
    },
  });
}

/**
 * GDPR Article 15 export — everything the marketplace stores about an
 * org. OWNER-only at the route layer; the DAL just returns the data.
 */
export async function getOrgForGdprExport(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          emailVerifiedAt: true,
          isActive: true,
          notificationPreferences: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      documents: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          validUntil: true,
          createdAt: true,
        },
      },
      ratings: {
        select: {
          id: true,
          rating: true,
          notes: true,
          createdAt: true,
          ticketId: true,
        },
      },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// ContractorOrg writes (org-scoped)
// ────────────────────────────────────────────────────────────────────────

export async function updateOrgProfile(
  orgId: string,
  data: {
    name?: string;
    description?: string | null;
    websiteUrl?: string | null;
  },
) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      description: data.description || null,
      websiteUrl: data.websiteUrl || null,
    },
  });
}

export async function updateOrgSpecialties(orgId: string, specialties: string[]) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: { specialties },
  });
}

export async function updateOrgRegions(orgId: string, regions: string[]) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: { regions },
  });
}

export async function setOrgDpaSigned(orgId: string, signedAt: Date) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: { dpaSignedAt: signedAt },
  });
}

export async function setOrgNavConfirmed(orgId: string, confirmedAt: Date) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: { navConfirmedAt: confirmedAt },
  });
}

export async function activateOrgViaDevCheckout(
  orgId: string,
  plan: "FREE" | "PRO" | "PREMIUM",
  periodEnd: Date,
) {
  return prisma.contractorOrg.update({
    where: { id: orgId },
    data: {
      plan,
      planStatus: "ACTIVE",
      trialEndsAt: null,
      currentPeriodEndsAt: periodEnd,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// ContractorDocument (org-scoped; cross-tenant safe)
// ────────────────────────────────────────────────────────────────────────

export async function listOrgDocuments(orgId: string) {
  return prisma.contractorDocument.findMany({
    where: { orgId },
    select: {
      id: true,
      kind: true,
      fileName: true,
      validUntil: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOrgDocument(
  orgId: string,
  data: {
    kind: string;
    fileName: string;
    storageKey: string;
    validUntil: Date | null;
  },
) {
  return prisma.contractorDocument.create({
    data: { orgId, ...data },
    select: {
      id: true,
      kind: true,
      fileName: true,
      validUntil: true,
      createdAt: true,
    },
  });
}

/**
 * Cross-tenant safe: returns null when `docId` doesn't belong to `orgId`,
 * even if the document exists.
 */
export async function getOrgDocument(orgId: string, docId: string) {
  return prisma.contractorDocument.findFirst({
    where: { id: docId, orgId },
    select: { id: true, orgId: true, storageKey: true },
  });
}

/**
 * Cross-tenant safe: deletes only if the document belongs to `orgId`.
 * Returns the count of rows deleted (0 = cross-tenant attempt or not
 * found).
 */
export async function deleteOrgDocument(orgId: string, docId: string) {
  const r = await prisma.contractorDocument.deleteMany({
    where: { id: docId, orgId },
  });
  return r.count;
}
