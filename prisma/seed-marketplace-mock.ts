import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  console.error("FATAL: refusing to seed marketplace mock in production.");
  process.exit(1);
}

/**
 * Marketplace mock data — builds a rich state around `Lift-Profi Zrt.`
 * (the PREMIUM contractor) so every contractor-side surface has
 * something to render: open publications matching their specialties,
 * submitted/won/rejected bids, ratings, message threads, and
 * city-match history for the district-expert trust badge.
 *
 * Idempotent — re-running upserts existing rows. Use:
 *   npm run seed:marketplace-mock
 */

const SEED_PREFIX = "mp-mock";

async function main() {
  // Find the orgs + building + board user from prior seeds.
  const liftProfi = await prisma.contractorOrg.findUnique({
    where: { taxId: "34567890-2-43" },
    select: { id: true },
  });
  const plumber = await prisma.contractorOrg.findUnique({
    where: { taxId: "12345678-1-42" },
    select: { id: true },
  });
  const electrician = await prisma.contractorOrg.findUnique({
    where: { taxId: "23456789-2-41" },
    select: { id: true },
  });
  const building = await prisma.building.findFirst({
    select: { id: true, name: true, city: true, zipCode: true },
  });
  const board = await prisma.user.findUnique({
    where: { email: "board@condo.local" },
    select: { id: true, name: true, email: true },
  });
  if (!liftProfi || !plumber || !electrician || !building || !board) {
    throw new Error(
      "Missing prerequisites — run `npm run seed && npm run seed:contractors` first.",
    );
  }

  // Patch Lift-Profi's regions to include the building city so the
  // district-expert badge can fire.
  await prisma.contractorOrg.update({
    where: { id: liftProfi.id },
    data: {
      regions: ["BP-01", "BP-02", "BP-13", "PE"],
      specialties: ["elevator", "lighting", "electrical"],
    },
  });

  // ── Tickets + publications ────────────────────────────────────────
  // We create six publication scenarios:
  //   1. OPEN, no bids — Lift-Profi can bid
  //   2. OPEN, Lift-Profi already SUBMITTED — they can edit
  //   3. OPEN, plumber SUBMITTED, Lift-Profi can outbid
  //   4. AWARDED to Lift-Profi, ticket IN_PROGRESS (active project)
  //   5. AWARDED to Lift-Profi, ticket COMPLETED (rated)
  //   6. AWARDED to Lift-Profi, ticket COMPLETED (rated, older)

  const scenarios: Array<{
    key: string;
    title: string;
    description: string;
    category: string;
    specialty: string;
    urgency: "URGENT" | "MEDIUM" | "PLANNED";
    budget: string;
    ticketStatus:
      | "ACKNOWLEDGED"
      | "ASSIGNED"
      | "IN_PROGRESS"
      | "COMPLETED";
    publicationStatus: "OPEN" | "AWARDED";
    liftProfiBid?: {
      amount: number;
      etaDays: number;
      notes: string;
      status: "SUBMITTED" | "WON";
    };
    otherBids?: Array<{
      bidderId: string;
      amount: number;
      etaDays: number;
      status: "SUBMITTED" | "REJECTED";
    }>;
    rating?: { stars: number; notes: string; daysAgo: number };
    completedDaysAgo?: number;
  }> = [
    {
      key: "open-1",
      title: "Lépcsőházi LED-világítás cseréje, 4 emelet",
      description:
        "32 db lépcsőházi lámpatest cseréje LED-re, fényerő-szabályozás bekötése. Tervezett karbantartás, hétvégén is végezhető.",
      category: "ELECTRICAL",
      specialty: "lighting",
      urgency: "PLANNED",
      budget: "500K_2M",
      ticketStatus: "ACKNOWLEDGED",
      publicationStatus: "OPEN",
    },
    {
      key: "open-2-self-bid",
      title: "Lift karbantartási szerződés meghosszabbítása",
      description:
        "Az éves karbantartási szerződés lejárt. 1998-as OTIS lift, EBÜ-vizsgálat is esedékes. Árajánlatot várunk éves díjra.",
      category: "ELEVATOR",
      specialty: "elevator",
      urgency: "MEDIUM",
      budget: "100K_500K",
      ticketStatus: "ACKNOWLEDGED",
      publicationStatus: "OPEN",
      liftProfiBid: {
        amount: 220000,
        etaDays: 365,
        notes:
          "Éves karbantartási szerződés + EBÜ vizsgálat. Hétvégi készenlét bevonva, 24/7 hibaelhárítás.",
        status: "SUBMITTED",
      },
    },
    {
      key: "open-3-competitor",
      title: "Liftvezérlő panel javítás vagy csere",
      description:
        "A vezérlőpanel ismétlődő hibákat dob. Felmérés szükséges arról, javítható-e vagy cserélni kell. Maximum 5 napos kiesés.",
      category: "ELEVATOR",
      specialty: "elevator",
      urgency: "URGENT",
      budget: "500K_2M",
      ticketStatus: "ACKNOWLEDGED",
      publicationStatus: "OPEN",
      otherBids: [
        {
          bidderId: plumber.id,
          amount: 380000,
          etaDays: 4,
          status: "SUBMITTED",
        },
      ],
    },
    {
      key: "won-1-active",
      title: "Lift ajtószenzor csere — sürgős",
      description:
        "Az ajtószenzor szivárványt mutat, lakók fent rekedtek. Azonnali kiszállás szükséges. EBÜ-naplóba bekerül.",
      category: "ELEVATOR",
      specialty: "elevator",
      urgency: "URGENT",
      budget: "LT_100K",
      ticketStatus: "ASSIGNED",
      publicationStatus: "AWARDED",
      liftProfiBid: {
        amount: 89000,
        etaDays: 2,
        notes:
          "Eredeti OTIS alkatrész raktáron. Holnap reggel kiszállás, max. 4 óra alatt megvan.",
        status: "WON",
      },
      otherBids: [
        {
          bidderId: electrician.id,
          amount: 110000,
          etaDays: 3,
          status: "REJECTED",
        },
      ],
    },
    {
      key: "won-2-completed",
      title: "Lift éves felülvizsgálat + olajcsere",
      description:
        "Esedékes éves felülvizsgálat. Hidraulikaolaj cseréje, csúszórugó ellenőrzése, vezetőlöket utánállítás.",
      category: "ELEVATOR",
      specialty: "elevator",
      urgency: "MEDIUM",
      budget: "100K_500K",
      ticketStatus: "COMPLETED",
      publicationStatus: "AWARDED",
      completedDaysAgo: 21,
      liftProfiBid: {
        amount: 165000,
        etaDays: 1,
        notes: "Helyszíni ellenőrzés + olajcsere egy nap alatt elkészül.",
        status: "WON",
      },
      rating: {
        stars: 5,
        notes:
          "Pontosak voltak, tiszta munka. A liftnapló is precízen kitöltve.",
        daysAgo: 18,
      },
    },
    {
      key: "won-3-completed-older",
      title: "Garázs-lift vezérlés modernizálása",
      description:
        "Régi relés vezérlés cseréje SPS-re. 2-szintes garázs-lift. Üzemen kívüli idő alatt elvégezhető (hétvégén).",
      category: "ELEVATOR",
      specialty: "elevator",
      urgency: "PLANNED",
      budget: "GT_2M",
      ticketStatus: "COMPLETED",
      publicationStatus: "AWARDED",
      completedDaysAgo: 95,
      liftProfiBid: {
        amount: 2250000,
        etaDays: 12,
        notes:
          "Allen Bradley CompactLogix vezérlés, 24V relék, távfelügyelet GSM-en. Régi panel cseréje + új grafikus kijelző.",
        status: "WON",
      },
      rating: {
        stars: 4,
        notes:
          "Megbízható, csak a dokumentációval lehetett volna jobb. A munka kifogástalan.",
        daysAgo: 90,
      },
    },
  ];

  for (const s of scenarios) {
    const ticketKey = `${SEED_PREFIX}-${s.key}`;
    const trackingNumber = `MP-MOCK-${s.key.toUpperCase()}`;

    const ticket = await prisma.maintenanceTicket.upsert({
      where: { trackingNumber },
      update: {
        title: s.title,
        description: s.description,
        category: s.category as never,
        urgency:
          s.urgency === "URGENT"
            ? "HIGH"
            : s.urgency === "MEDIUM"
              ? "MEDIUM"
              : "LOW",
        status: s.ticketStatus as never,
        location: "Lépcsőház · közös terület",
        awardedContractorId:
          s.liftProfiBid?.status === "WON" ? liftProfi.id : null,
        updatedAt: new Date(),
      },
      create: {
        trackingNumber,
        buildingId: building.id,
        reporterId: board.id,
        title: s.title,
        description: s.description,
        category: s.category as never,
        urgency:
          s.urgency === "URGENT"
            ? "HIGH"
            : s.urgency === "MEDIUM"
              ? "MEDIUM"
              : "LOW",
        status: s.ticketStatus as never,
        location: "Lépcsőház · közös terület",
        awardedContractorId:
          s.liftProfiBid?.status === "WON" ? liftProfi.id : null,
      },
      select: { id: true },
    });

    // ── Publication ─────────────────────────────────────────────────
    const publishedAt =
      s.publicationStatus === "AWARDED" && s.completedDaysAgo
        ? new Date(Date.now() - (s.completedDaysAgo + 10) * 24 * 60 * 60 * 1000)
        : s.publicationStatus === "AWARDED"
          ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() - Math.floor(Math.random() * 5 + 1) * 24 * 60 * 60 * 1000);
    const awardedAt =
      s.publicationStatus === "AWARDED"
        ? s.completedDaysAgo
          ? new Date(
              Date.now() - (s.completedDaysAgo + 5) * 24 * 60 * 60 * 1000,
            )
          : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        : null;
    const deadlineAt =
      s.publicationStatus === "OPEN"
        ? new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
        : null;

    const pub = await prisma.marketplacePublication.upsert({
      where: { ticketId: ticket.id },
      update: {
        scrubbedTitle: s.title,
        scrubbedDescription: s.description,
        status: s.publicationStatus,
        urgency: s.urgency,
        budgetBand: s.budget,
        specialties: [s.specialty],
        deadlineAt,
        awardedAt,
      },
      create: {
        ticketId: ticket.id,
        status: s.publicationStatus,
        scrubbedTitle: s.title,
        scrubbedDescription: s.description,
        category: s.category,
        urgency: s.urgency,
        city: building.city,
        zip: building.zipCode,
        budgetBand: s.budget,
        deadlineAt,
        specialties: [s.specialty],
        revealAddressOnAward: true,
        revealUnitOnAward: true,
        revealOwnerPhoneOnAward: false,
        boardContactEmail: board.email,
        boardContactPhone: "+36 1 555 0101",
        publishedById: board.id,
        publisherDisplayName: board.name,
        publishedAt,
        awardedAt,
      },
      select: { id: true },
    });

    // ── Lift-Profi's bid ────────────────────────────────────────────
    if (s.liftProfiBid) {
      const decidedAt =
        s.liftProfiBid.status === "WON" ? awardedAt : null;
      await prisma.marketplaceBid.upsert({
        where: {
          publicationId_bidderId: {
            publicationId: pub.id,
            bidderId: liftProfi.id,
          },
        },
        update: {
          amount: s.liftProfiBid.amount,
          etaDays: s.liftProfiBid.etaDays,
          notes: s.liftProfiBid.notes,
          status: s.liftProfiBid.status,
          decidedAt,
          decidedById: s.liftProfiBid.status === "WON" ? board.id : null,
        },
        create: {
          publicationId: pub.id,
          bidderId: liftProfi.id,
          amount: s.liftProfiBid.amount,
          etaDays: s.liftProfiBid.etaDays,
          notes: s.liftProfiBid.notes,
          status: s.liftProfiBid.status,
          decidedAt,
          decidedById: s.liftProfiBid.status === "WON" ? board.id : null,
        },
      });

      // Mark the publication awarded → winningBidId
      if (s.liftProfiBid.status === "WON") {
        const bid = await prisma.marketplaceBid.findFirst({
          where: { publicationId: pub.id, bidderId: liftProfi.id },
          select: { id: true },
        });
        if (bid) {
          await prisma.marketplacePublication.update({
            where: { id: pub.id },
            data: { awardedBidId: bid.id },
          });
        }
      }
    }

    // ── Other bids on this publication ──────────────────────────────
    for (const ob of s.otherBids ?? []) {
      await prisma.marketplaceBid.upsert({
        where: {
          publicationId_bidderId: {
            publicationId: pub.id,
            bidderId: ob.bidderId,
          },
        },
        update: {
          amount: ob.amount,
          etaDays: ob.etaDays,
          status: ob.status,
          decisionReason:
            ob.status === "REJECTED"
              ? "Másik ajánlat lett kiválasztva"
              : null,
          decidedAt: ob.status === "REJECTED" ? awardedAt : null,
          decidedById: ob.status === "REJECTED" ? board.id : null,
        },
        create: {
          publicationId: pub.id,
          bidderId: ob.bidderId,
          amount: ob.amount,
          etaDays: ob.etaDays,
          notes: "Mock bid — másik kivitelező versenytársként.",
          status: ob.status,
          decisionReason:
            ob.status === "REJECTED"
              ? "Másik ajánlat lett kiválasztva"
              : null,
          decidedAt: ob.status === "REJECTED" ? awardedAt : null,
          decidedById: ob.status === "REJECTED" ? board.id : null,
        },
      });
    }

    // ── Rating on completed jobs ────────────────────────────────────
    if (s.rating) {
      const existing = await prisma.contractorRating.findFirst({
        where: {
          ticketId: ticket.id,
          raterId: board.id,
          contractorOrgId: liftProfi.id,
        },
        select: { id: true },
      });
      const createdAt = new Date(
        Date.now() - s.rating.daysAgo * 24 * 60 * 60 * 1000,
      );
      if (existing) {
        await prisma.contractorRating.update({
          where: { id: existing.id },
          data: { rating: s.rating.stars, notes: s.rating.notes },
        });
      } else {
        await prisma.contractorRating.create({
          data: {
            ticketId: ticket.id,
            raterId: board.id,
            contractorOrgId: liftProfi.id,
            rating: s.rating.stars,
            notes: s.rating.notes,
            createdAt,
          },
        });
      }
    }

    console.log(
      `  ✓ ${s.key.padEnd(22)} ${s.publicationStatus.padEnd(8)} ${s.liftProfiBid?.status ?? "—"}`,
    );
  }

  // ── A message thread on the active project ──────────────────────────
  const wonActiveTicket = await prisma.maintenanceTicket.findUnique({
    where: { trackingNumber: "MP-MOCK-WON-1-ACTIVE" },
    select: { publication: { select: { id: true } } },
  });
  if (wonActiveTicket?.publication) {
    const pubId = wonActiveTicket.publication.id;
    const existing = await prisma.marketplaceMessage.findFirst({
      where: { publicationId: pubId, bidderId: liftProfi.id },
      select: { id: true },
    });
    if (!existing) {
      await prisma.marketplaceMessage.create({
        data: {
          publicationId: pubId,
          bidderId: liftProfi.id,
          senderSide: "BOARD",
          senderId: board.id,
          body:
            "Köszönöm, hogy elvállalták! Holnap reggel 8-tól lesz szabad a lift. A liftgépházat a házmester nyitja, telefonszáma a kapuban.",
          createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
        },
      });
      await prisma.marketplaceMessage.create({
        data: {
          publicationId: pubId,
          bidderId: liftProfi.id,
          senderSide: "CONTRACTOR",
          senderId: "mp-mock-sender",
          body:
            "Rendben, 8:00-ra ott vagyunk. Hozok cserealkatrészt is — ha más probléma kiderül, helyben tudjuk megoldani.",
          createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log("\n  Lift-Profi premium contractor now has:");
  console.log("  · 3 OPEN publications they can bid on");
  console.log("  · 1 active won job (IN_PROGRESS)");
  console.log("  · 2 completed won jobs with ratings (4★, 5★)");
  console.log("  · 1 rejected competitor bid recorded");
  console.log("  · Message thread on the active project\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
