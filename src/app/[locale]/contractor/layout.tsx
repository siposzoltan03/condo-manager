import { auth } from "@/lib/auth";
import { getOrgName } from "@/lib/contractor";
import { getEffectivePlan } from "@/lib/marketplace";
import { ContractorShell } from "@/components/contractor/contractor-shell";
import type { ContractorTopbarData } from "@/components/contractor/contractor-topbar";

/**
 * Server layout that hosts the contractor section. Reads org + plan
 * server-side so the shell's topbar is fresh on every request (plan
 * badge + trial countdown). Delegates the standalone-vs-shell decision
 * to the client `ContractorShell` so it can use `usePathname()`.
 *
 * The parent `AppShell` already skips its condo chrome for the
 * `/contractor/*` subtree.
 */
export default async function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  let data: ContractorTopbarData | null = null;

  if (session?.user?.kind === "contractor" && session.user.contractorOrgId) {
    const orgId = session.user.contractorOrgId;
    const org = await getOrgName(orgId);
    if (org) {
      const effective = await getEffectivePlan(orgId);
      data = {
        orgName: org.name,
        plan: effective.plan,
        status: effective.status,
        trialDaysRemaining: effective.trialDaysRemaining,
        viewerName: session.user.name ?? "",
      };
    }
  }

  return <ContractorShell data={data}>{children}</ContractorShell>;
}
