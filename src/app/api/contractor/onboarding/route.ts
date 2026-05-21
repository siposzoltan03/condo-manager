import { NextRequest, NextResponse } from "next/server";
import { requireContractorOwner } from "@/lib/contractor/session";
import {
  sanitizeSpecialties,
  sanitizeRegions,
} from "@/lib/contractor/taxonomy";
import { evaluateReadiness } from "@/lib/contractor/activation";
import {
  getOrgForOnboardingWizard,
  updateOrgProfile,
  updateOrgSpecialties,
  updateOrgRegions,
} from "@/lib/contractor";
import {
  getEffectivePlan,
  isWithinSpecialtyCap,
  isWithinRegionCap,
} from "@/lib/marketplace";

export const runtime = "nodejs";

/**
 * GET — returns the org row + readiness summary for the wizard to render.
 * PATCH — partial update of one of: profile, specialties, regions.
 *
 * `finalize` (accept DPA + ToS, attempt activation) lives in `./finalize`
 * because it has side-effects (welcome email, status flip).
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getOrgForOnboardingWizard(ctx.orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const readiness = await evaluateReadiness(ctx.orgId);
  return NextResponse.json({ org, readiness });
}

interface ProfilePayload {
  action: "profile";
  name?: string;
  description?: string | null;
  websiteUrl?: string | null;
}
interface SpecialtiesPayload {
  action: "specialties";
  specialties: string[];
}
interface RegionsPayload {
  action: "regions";
  regions: string[];
}
type Payload = ProfilePayload | SpecialtiesPayload | RegionsPayload;

export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body || !body.action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.action === "profile") {
    const name = body.name?.trim();
    if (name !== undefined && name.length < 2) {
      return NextResponse.json(
        { error: "Org name must be at least 2 characters." },
        { status: 400 },
      );
    }
    const description = body.description?.trim() ?? null;
    const websiteUrl = body.websiteUrl?.trim() ?? null;
    if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
      return NextResponse.json(
        { error: "Website URL must start with http:// or https://" },
        { status: 400 },
      );
    }
    await updateOrgProfile(ctx.orgId, {
      name,
      description,
      websiteUrl,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "specialties") {
    const slugs = sanitizeSpecialties(body.specialties);
    const effective = await getEffectivePlan(ctx.orgId);
    if (!isWithinSpecialtyCap(slugs.length, effective)) {
      return NextResponse.json(
        {
          error: "Specialty cap exceeded for this plan.",
          reason: "PLAN_CAP",
          cap: effective.caps.specialties,
          plan: effective.plan,
        },
        { status: 402 },
      );
    }
    await updateOrgSpecialties(ctx.orgId, slugs);
    return NextResponse.json({ ok: true, specialties: slugs });
  }

  if (body.action === "regions") {
    const codes = sanitizeRegions(body.regions);
    const effective = await getEffectivePlan(ctx.orgId);
    if (!isWithinRegionCap(codes.length, effective)) {
      return NextResponse.json(
        {
          error: "Region cap exceeded for this plan.",
          reason: "PLAN_CAP",
          cap: effective.caps.regions,
          plan: effective.plan,
        },
        { status: 402 },
      );
    }
    await updateOrgRegions(ctx.orgId, codes);
    return NextResponse.json({ ok: true, regions: codes });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
