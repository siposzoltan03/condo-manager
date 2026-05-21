import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Returns the path the contractor should land on after sign-in.
 * - PENDING_VERIFICATION → /contractor/onboarding (finish profile)
 * - ACTIVE / anything else → /contractor/marketplace
 *
 * Lives server-side so the gate uses the fresh JWT instead of whatever
 * the client thinks the session looks like.
 */
export async function GET(request: Request) {
  const session = await auth();
  const u = session?.user;
  if (!u || u.kind !== "contractor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const locale = new URL(request.url).searchParams.get("locale") ?? "hu";
  const base =
    u.contractorOrgStatus === "PENDING_VERIFICATION"
      ? "contractor/onboarding"
      : "contractor/marketplace";
  return NextResponse.json({ path: `/${locale}/${base}` });
}
