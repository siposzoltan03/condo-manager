import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { generateTrackingNumber } from "@/lib/maintenance/tickets";
import { Prisma, MaintenanceCategory, Urgency } from "@prisma/client";

/**
 * Cron tick: scan ScheduledMaintenance entries and materialize tickets when
 * the lead-time window opens.
 *
 * Auth: Bearer token via CRON_SECRET env var. Run hourly (or daily) from
 * Vercel Cron / cron-job.org / a system cron. Idempotent — safe to run
 * multiple times in a row; entries that already fired for the current cycle
 * are skipped.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runTick();
}

/** Allow POST too — some schedulers prefer POST with empty body. */
export async function POST(request: NextRequest) {
  return GET(request);
}

const MAX_ADVANCE_ITERATIONS = 120;

async function runTick(): Promise<NextResponse> {
  const now = new Date();
  const entries = await prisma.scheduledMaintenance.findMany({
    include: {
      building: { select: { id: true } },
    },
  });

  const created: { entryId: string; ticketId: string; trackingNumber: string }[] = [];
  const skipped: { entryId: string; reason: string }[] = [];

  for (const entry of entries) {
    const fireAt = new Date(
      entry.date.getTime() - entry.leadTimeDays * 86_400_000,
    );

    // Already fired for this cycle?
    const alreadyFired =
      entry.materializedAt != null && entry.materializedAt >= fireAt;
    if (alreadyFired) {
      skipped.push({ entryId: entry.id, reason: "already_fired_this_cycle" });
      continue;
    }

    if (now < fireAt) {
      skipped.push({ entryId: entry.id, reason: "not_yet" });
      continue;
    }

    // Pick a reporter: first board+ user in this building. Skip otherwise.
    const reporter = await prisma.userBuilding.findFirst({
      where: {
        buildingId: entry.buildingId,
        role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] },
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });

    if (!reporter) {
      skipped.push({ entryId: entry.id, reason: "no_reporter_available" });
      continue;
    }

    // Materialize the ticket.
    let ticket;
    for (let attempt = 0; attempt < 5; attempt++) {
      const trackingNumber = await generateTrackingNumber();
      try {
        ticket = await prisma.maintenanceTicket.create({
          data: {
            trackingNumber,
            title: entry.title,
            description: entry.description ?? entry.title,
            category: MaintenanceCategory.OTHER,
            urgency: Urgency.MEDIUM,
            status: "SUBMITTED",
            // SLA = days until the actual due date.
            slaHours: Math.max(1, entry.leadTimeDays * 24),
            reporter: { connect: { id: reporter.userId } },
            building: { connect: { id: entry.buildingId } },
            scheduledMaintenance: { connect: { id: entry.id } },
          },
        });
        break;
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < 4
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!ticket) {
      skipped.push({ entryId: entry.id, reason: "ticket_create_failed" });
      continue;
    }

    // Advance state on the scheduled entry.
    let nextDate = entry.date;
    if (entry.isRecurring && entry.recurrenceMonths != null) {
      // Advance by recurrenceMonths repeatedly until next fire is in the future.
      let i = 0;
      while (i < MAX_ADVANCE_ITERATIONS) {
        nextDate = addMonths(nextDate, entry.recurrenceMonths);
        const nextFireAt = new Date(
          nextDate.getTime() - entry.leadTimeDays * 86_400_000,
        );
        if (nextFireAt > now) break;
        i++;
      }
    }

    await prisma.scheduledMaintenance.update({
      where: { id: entry.id },
      data: {
        materializedAt: now,
        date: entry.isRecurring ? nextDate : entry.date,
      },
    });

    await createAuditLog({
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      action: "CREATE",
      userId: reporter.userId,
      newValue: {
        trackingNumber: ticket.trackingNumber,
        source: "scheduled_maintenance",
        scheduledMaintenanceId: entry.id,
      },
    });

    created.push({
      entryId: entry.id,
      ticketId: ticket.id,
      trackingNumber: ticket.trackingNumber,
    });
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
  });
}

/** Add `months` calendar months to `d` (handles end-of-month sensibly). */
function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  const targetMonth = result.getUTCMonth() + months;
  result.setUTCMonth(targetMonth);
  return result;
}
