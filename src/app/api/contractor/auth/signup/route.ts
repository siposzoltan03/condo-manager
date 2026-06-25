import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { checkTaxIdFormat } from "@/lib/contractor/tax-id";
import { signVerificationToken } from "@/lib/contractor/verification";
import { newTrialWindow } from "@/lib/marketplace/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/email-templates";
import {
  findOrgByTaxId,
  findContractorUserByEmail,
  createContractorOrgWithOwner,
} from "@/lib/contractor";
import { contractorOrgCreated } from "@/lib/contractor/events";
import { findUserByEmail } from "@/lib/profile-dal";

export const runtime = "nodejs";

interface SignupBody {
  email: string;
  password: string;
  /** Display name of the user signing up. */
  name: string;
  /** Org / business display name (often "Kovács István E.V. — Vízvezeték"). */
  orgName: string;
  /** HU adószám in `XXXXXXXX-Y-ZZ` form. */
  taxId: string;
  /** Optional phone. */
  phone?: string;
  /** Locale for the verification email ("hu" | "en"). Defaults to "hu". */
  locale?: "hu" | "en";
}

function parseBody(raw: unknown): SignupBody | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.email !== "string" ||
    typeof o.password !== "string" ||
    typeof o.name !== "string" ||
    typeof o.orgName !== "string" ||
    typeof o.taxId !== "string"
  ) {
    return null;
  }
  return {
    email: o.email.trim().toLowerCase(),
    password: o.password,
    name: o.name.trim(),
    orgName: o.orgName.trim(),
    taxId: o.taxId.trim(),
    phone: typeof o.phone === "string" ? o.phone.trim() : undefined,
    locale: o.locale === "en" ? "en" : "hu",
  };
}

const SILENT_NOOP_RESPONSE = {
  ok: true,
  message: "Ellenőrizd a postaládát.",
} as const;

/**
 * POST /api/contractor/auth/signup
 *
 * Creates a `ContractorOrg` in PENDING_VERIFICATION + an owner
 * `ContractorUser`, sends an email-verification link. The user lands on
 * the onboarding wizard after verifying.
 *
 * Idempotency: re-submitting with an existing email returns 200 + a
 * "verification re-sent" hint so we don't leak account existence.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit({
    key: `contractor:signup:${ip}`,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const body = parseBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json(
      { error: "A jelszónak legalább 8 karakter hosszúnak kell lennie." },
      { status: 400 },
    );
  }

  const fmt = checkTaxIdFormat(body.taxId);
  if (!fmt.ok) {
    return NextResponse.json(
      { error: "Érvénytelen adószám formátum." },
      { status: 400 },
    );
  }

  // Reject collisions across either auth tree. Intentionally NOT 409
  // with "user exists" — that would leak account existence to a probing
  // attacker. Pretend success and silently no-op; the form shows a
  // generic "check your inbox" screen so behaviour is identical.
  const [existingCondoUser, existingContractorUser, existingOrg] =
    await Promise.all([
      findUserByEmail(body.email),
      findContractorUserByEmail(body.email),
      findOrgByTaxId(fmt.normalized),
    ]);

  if (existingCondoUser || existingContractorUser || existingOrg) {
    return NextResponse.json(SILENT_NOOP_RESPONSE);
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const { trialEndsAt } = newTrialWindow();

  let createdUserId: string;
  try {
    const { org, user } = await createContractorOrgWithOwner({
      org: {
        name: body.orgName,
        taxId: fmt.normalized,
        status: "PENDING_VERIFICATION",
        // Auto-enrol on a 14-day Pro trial; the lazy-expiry logic in
        // pricing.ts downgrades back to FREE caps when the window ends.
        plan: "PRO",
        planStatus: "TRIALING",
        trialEndsAt,
      },
      owner: {
        email: body.email,
        passwordHash,
        name: body.name,
        phone: body.phone,
      },
    });
    createdUserId = user.id;

    await contractorOrgCreated({
      orgId: org.id,
      ownerUserId: user.id,
      name: org.name,
      taxId: fmt.normalized,
    });

    const verificationToken = signVerificationToken(user.id);
    const base =
      process.env.NEXTAUTH_URL ??
      process.env.BASE_URL ??
      "http://localhost:3000";
    const verificationLink = `${base}/api/contractor/auth/verify-email?token=${encodeURIComponent(
      verificationToken,
    )}`;
    const { subject, html } = verificationEmail({
      recipientName: user.name,
      verificationLink,
      expiryHours: 24,
      locale: body.locale,
    });
    sendEmail(body.email, subject, html).catch((err) => {
      console.error("Contractor signup verification email failed:", err);
    });
  } catch (err) {
    console.error("Contractor signup failed:", err);
    return NextResponse.json(
      { error: "Belső hiba történt. Próbáld újra később." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    userId: createdUserId,
    message: "Ellenőrizd a postaládát.",
  });
}
