import { auth } from "@/lib/auth";

/**
 * Require an authenticated contractor session. Returns the org-scoped
 * identity or throws `Unauthorized` — API routes catch and convert to
 * a 401. `kind === "contractor"` is enforced so condo sessions can't
 * reach contractor endpoints even if they somehow guess the URL.
 */
export interface ContractorContext {
  userId: string;
  orgId: string;
  role: string;
  orgStatus: string;
  orgPlan: string;
  orgName: string;
}

export async function requireContractor(): Promise<ContractorContext> {
  const session = await auth();
  const u = session?.user;
  if (!u || u.kind !== "contractor" || !u.contractorOrgId) {
    throw new Error("Unauthorized");
  }
  return {
    userId: u.id,
    orgId: u.contractorOrgId,
    role: u.contractorRole ?? "STAFF",
    orgStatus: u.contractorOrgStatus ?? "PENDING_VERIFICATION",
    orgPlan: u.contractorOrgPlan ?? "FREE",
    orgName: u.contractorOrgName ?? "",
  };
}

export async function requireContractorOwner(): Promise<ContractorContext> {
  const ctx = await requireContractor();
  if (ctx.role !== "OWNER") {
    throw new Error("Forbidden");
  }
  return ctx;
}
