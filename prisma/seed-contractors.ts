import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  console.error("FATAL: refusing to seed contractors in production.");
  process.exit(1);
}

/**
 * Idempotent — re-running upserts the same orgs + owner users so it's
 * safe alongside the main `seed.ts`. Use:
 *   npm run seed:contractors
 */
async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);
  const now = new Date();

  const fixtures = [
    {
      orgName: "Kovács István E.V. – Vízvezeték",
      taxId: "12345678-1-42",
      plan: "FREE" as const,
      status: "ACTIVE" as const,
      specialties: ["plumbing"],
      regions: ["BP-13", "BP-14"],
      ownerEmail: "plumber@contractor.local",
      ownerName: "Kovács István",
      phone: "+36 20 123 4567",
    },
    {
      orgName: "Elektrofix Kft.",
      taxId: "23456789-2-41",
      plan: "PRO" as const,
      status: "ACTIVE" as const,
      specialties: ["electrical", "lighting"],
      regions: ["BP-11", "BP-12", "BP-13"],
      ownerEmail: "electrician@contractor.local",
      ownerName: "Szabó László",
      phone: "+36 30 987 6543",
    },
    {
      orgName: "Lift-Profi Zrt.",
      taxId: "34567890-2-43",
      plan: "PREMIUM" as const,
      status: "ACTIVE" as const,
      specialties: ["elevator"],
      regions: ["BP-01", "BP-02", "BP-13", "PE"],
      ownerEmail: "elevator@contractor.local",
      ownerName: "Nagy Tamás",
      phone: "+36 70 555 1212",
    },
  ];

  for (const f of fixtures) {
    const org = await prisma.contractorOrg.upsert({
      where: { taxId: f.taxId },
      update: {
        name: f.orgName,
        plan: f.plan,
        status: f.status,
        specialties: f.specialties,
        regions: f.regions,
        navConfirmedAt: now,
      },
      create: {
        name: f.orgName,
        taxId: f.taxId,
        plan: f.plan,
        status: f.status,
        specialties: f.specialties,
        regions: f.regions,
        navConfirmedAt: now,
        dpaSignedAt: now,
      },
    });

    await prisma.contractorUser.upsert({
      where: { email: f.ownerEmail },
      update: {
        passwordHash,
        name: f.ownerName,
        phone: f.phone,
        role: "OWNER",
        emailVerifiedAt: now,
        isActive: true,
      },
      create: {
        orgId: org.id,
        email: f.ownerEmail,
        passwordHash,
        name: f.ownerName,
        phone: f.phone,
        role: "OWNER",
        emailVerifiedAt: now,
        isActive: true,
      },
    });

    console.log(`  ✓ ${f.orgName}  (${f.ownerEmail} / password123)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
