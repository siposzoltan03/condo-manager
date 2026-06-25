import { createAuditLog } from "@/lib/audit";

/**
 * Finance domain events. Mirror of `lib/marketplace/events.ts` and
 * `lib/maintenance/events.ts`. Thin wrappers around audit (notify is
 * rare on the finance surface today — most events are board-internal).
 */

export async function ledgerEntryCreated(opts: {
  entryId: string;
  createdByUserId: string;
  buildingId: string;
  date: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  description: string;
}) {
  await createAuditLog({
    entityType: "LedgerEntry",
    entityId: opts.entryId,
    action: "CREATE",
    userId: opts.createdByUserId,
    buildingId: opts.buildingId,
    newValue: {
      date: opts.date,
      debitAccountId: opts.debitAccountId,
      creditAccountId: opts.creditAccountId,
      amount: opts.amount,
      description: opts.description,
    },
  });
}

export async function chargesBulkCreated(opts: {
  createdByUserId: string;
  buildingId: string;
  count: number;
  charges: unknown;
}) {
  await createAuditLog({
    entityType: "MonthlyCharge",
    entityId: "bulk",
    action: "CREATE",
    userId: opts.createdByUserId,
    buildingId: opts.buildingId,
    newValue: {
      count: opts.count,
      charges: opts.charges as Record<string, unknown>,
    },
  });
}

export async function budgetUpdated(opts: {
  year: number;
  updatedByUserId: string;
  buildingId: string;
  itemCount: number;
  items: unknown;
}) {
  await createAuditLog({
    entityType: "Budget",
    entityId: `year-${opts.year}`,
    action: "UPDATE",
    userId: opts.updatedByUserId,
    buildingId: opts.buildingId,
    newValue: {
      year: opts.year,
      itemCount: opts.itemCount,
      items: opts.items as Record<string, unknown>,
    },
  });
}

export async function chargeMarkedPaid(opts: {
  chargeId: string;
  paidByUserId: string;
  buildingId: string;
  oldStatus: string;
  oldPaidAt: Date | null;
  newPaidAt: Date;
}) {
  await createAuditLog({
    entityType: "MonthlyCharge",
    entityId: opts.chargeId,
    action: "UPDATE",
    userId: opts.paidByUserId,
    buildingId: opts.buildingId,
    oldValue: { status: opts.oldStatus, paidAt: opts.oldPaidAt },
    newValue: { status: "PAID", paidAt: opts.newPaidAt },
  });
}
