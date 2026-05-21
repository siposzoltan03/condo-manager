import { NextRequest, NextResponse } from "next/server";
import { requireContractorOwner } from "@/lib/contractor/session";
import { validateTaxIdWithNav } from "@/lib/contractor/nav-validation";
import { tryActivate, evaluateReadiness } from "@/lib/contractor/activation";
import {
  getOrgForFinalize,
  setOrgDpaSigned,
  setOrgNavConfirmed,
} from "@/lib/contractor";
import { createAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/contractor/onboarding/finalize
 *
 * Final wizard step. Expects { acceptDpa: true, locale?: "hu"|"en" } in the
 * body. Steps in order:
 *
 *   1. Mark DPA + ToS accepted (`dpaSignedAt`).
 *   2. If `navConfirmedAt` is still empty, call NAV validation now.
 *      (Idempotent — won't re-stamp if already confirmed.)
 *   3. Try to activate the org. If readiness still fails (e.g. docs
 *      missing) we return the missing-step map so the client can route
 *      the user back to the offending wizard step.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { acceptDpa?: boolean; locale?: "hu" | "en" }
    | null;
  if (!body?.acceptDpa) {
    return NextResponse.json(
      { error: "Missing DPA acceptance." },
      { status: 400 },
    );
  }
  const locale = body.locale === "en" ? "en" : "hu";

  const org = await getOrgForFinalize(ctx.orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 1. DPA acceptance — set once, never reset.
  if (!org.dpaSignedAt) {
    await setOrgDpaSigned(org.id, new Date());
  }

  // 2. NAV validation — only if not already confirmed.
  if (!org.navConfirmedAt) {
    const result = await validateTaxIdWithNav(org.taxId);
    if (result.confirmed) {
      await setOrgNavConfirmed(org.id, result.checkedAt);
    }
  }

  // 3. Attempt auto-activation.
  const base =
    process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? "http://localhost:3000";
  const loginUrl = `${base}/${locale}/contractor/login`;
  const activation = await tryActivate(ctx.orgId, loginUrl, locale);

  if (activation.activated) {
    await createAuditLog({
      entityType: "ContractorOrg",
      entityId: ctx.orgId,
      action: "UPDATE",
      userId: ctx.userId,
      newValue: { status: "ACTIVE" },
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, activated: true });
  }

  // Not activated: surface the readiness map so the client can guide
  // the user back to the missing piece. NAV-not-confirmed in "manual"
  // mode is the most common branch — keeps the org in PENDING and a
  // platform operator approves manually.
  const readiness = await evaluateReadiness(ctx.orgId);
  return NextResponse.json({
    ok: true,
    activated: false,
    readiness,
  });
}
