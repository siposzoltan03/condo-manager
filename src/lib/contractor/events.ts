import { createAuditLog } from "@/lib/audit";

/**
 * Contractor domain events. Wraps audit (and notify, when needed) for
 * the contractor-side flows. Today just `contractorOrgCreated` — more
 * events will land as the contractor surface grows.
 */

export async function contractorOrgCreated(opts: {
  orgId: string;
  ownerUserId: string;
  name: string;
  taxId: string;
}) {
  await createAuditLog({
    entityType: "ContractorOrg",
    entityId: opts.orgId,
    action: "CREATE",
    userId: opts.ownerUserId,
    newValue: { name: opts.name, taxId: opts.taxId },
  }).catch(() => undefined);
}
