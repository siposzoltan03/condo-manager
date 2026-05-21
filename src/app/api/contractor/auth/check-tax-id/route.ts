import { NextRequest, NextResponse } from "next/server";
import { findOrgByTaxId } from "@/lib/contractor";
import { checkTaxIdFormat } from "@/lib/contractor/tax-id";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Inline NAV adószám check fired from the contractor signup form on each
 * change of the input. Phase 1 returns a format-validated result plus a
 * "navConfirmed: false" stub — Phase 2 will swap the body for the real
 * NAV SOAP call. The endpoint is public (no session needed) so the
 * unsigned-up user can validate before submitting.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit({
    key: `contractor:check-tax-id:${ip}`,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const taxId = typeof body?.taxId === "string" ? body.taxId : "";

  const fmt = checkTaxIdFormat(taxId);
  if (!fmt.ok) {
    return NextResponse.json({ ok: false, reason: fmt.reason });
  }

  // Block re-registration with the same tax id.
  const existing = await findOrgByTaxId(fmt.normalized);
  if (existing) {
    return NextResponse.json({ ok: false, reason: "TAKEN" });
  }

  // TODO Phase 2: call NAV API and set navConfirmed accordingly.
  return NextResponse.json({
    ok: true,
    normalized: fmt.normalized,
    navConfirmed: false,
  });
}
