import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { issueVerificationToken } from "@/lib/email-verification";
import { sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/email-templates";
import { escapeHtml } from "@/lib/escape-html";
import { createDefaultDocumentCategories } from "@/lib/building-setup";

/**
 * Self-serve registration: creates a User + TRIALING Subscription on the
 * Képviselő plan + first Building (with the user as chair) + email verification
 * token, then sends the verification email.
 *
 * Atomic transaction. On any failure no partial state is created.
 *
 * NOTE: When the feature-gating tier rename ships (Plan slugs Starter/Pro/Enterprise
 * → Kezdő/Képviselő/Kezelő iroda), update DEFAULT_TRIAL_PLAN_SLUG accordingly.
 */

const TRIAL_DAYS = 14;
const DEFAULT_TRIAL_PLAN_SLUG = process.env.DEFAULT_TRIAL_PLAN_SLUG ?? "pro";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  buildingName: string;
  locale: "hu" | "en";
}

/**
 * Server-side field error keys. Mapped to localized strings on the client
 * via the auth.* i18n namespace. Keep keys stable — the client switches
 * on these to look up messages.
 */
export type FieldErrorKey =
  | "errorNameRequired"
  | "errorEmailInvalid"
  | "errorBuildingRequired"
  | "errorPasswordTooShort";

export type RegisterResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; error: "email-taken" | "validation" | "plan-missing" | "internal"; fields?: Partial<Record<keyof RegisterInput, FieldErrorKey>> };

function validate(input: unknown): { ok: true; data: RegisterInput } | { ok: false; fields: Partial<Record<keyof RegisterInput, FieldErrorKey>> } {
  const fields: Partial<Record<keyof RegisterInput, FieldErrorKey>> = {};

  if (typeof input !== "object" || input === null) {
    return { ok: false, fields: { name: "errorNameRequired" } };
  }
  const i = input as Record<string, unknown>;

  const name = typeof i.name === "string" ? i.name.trim() : "";
  const email = typeof i.email === "string" ? i.email.toLowerCase().trim() : "";
  const password = typeof i.password === "string" ? i.password : "";
  const buildingName =
    typeof i.buildingName === "string" ? i.buildingName.trim() : "";
  const locale: "hu" | "en" = i.locale === "en" ? "en" : "hu";

  if (name.length < 2 || name.length > 100) fields.name = "errorNameRequired";
  if (!EMAIL_RE.test(email) || email.length > 255)
    fields.email = "errorEmailInvalid";
  if (buildingName.length < 2 || buildingName.length > 100)
    fields.buildingName = "errorBuildingRequired";
  if (password.length < 10 || password.length > 200)
    fields.password = "errorPasswordTooShort";

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, data: { name, email, password, buildingName, locale } };
}

export async function register(rawInput: unknown, baseUrl: string): Promise<RegisterResult> {
  const parsed = validate(rawInput);
  if (!parsed.ok) return { ok: false, error: "validation", fields: parsed.fields };

  const { name, email, password, buildingName, locale } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "email-taken" };

  const plan = await prisma.plan.findUnique({
    where: { slug: DEFAULT_TRIAL_PLAN_SLUG },
    select: { id: true, slug: true, name: true },
  });
  if (!plan) return { ok: false, error: "plan-missing" };

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          language: locale,
          isActive: true,
          // emailVerifiedAt stays null until /verify-email/[token] runs
        },
        select: { id: true },
      });

      const subscription = await tx.subscription.create({
        data: {
          name: buildingName,
          email,
          planId: plan.id,
          ownerId: user.id,
          subscriptionStatus: "TRIALING",
          trialEndsAt,
        },
        select: { id: true },
      });

      const building = await tx.building.create({
        data: {
          name: buildingName,
          // Sentinel address — onboarding wizard fills these later.
          address: "",
          city: "",
          zipCode: "",
          subscriptionId: subscription.id,
        },
        select: { id: true },
      });

      await tx.userBuilding.create({
        data: {
          userId: user.id,
          buildingId: building.id,
          // The person who registers a building is its administrator (közös
          // képviselő): they run onboarding, manage users/residents and assign
          // owners to units — all of which require ADMIN (users.manage).
          role: "ADMIN",
          isActive: true,
        },
      });

      await createDefaultDocumentCategories(tx, building.id);

      return user.id;
    });
  } catch (err) {
    console.error("[register] transaction failed:", err);
    return { ok: false, error: "internal" };
  }

  // Out-of-transaction: token + email. If email send fails, the user can
  // resend via the /verify-email/pending page.
  const rawToken = await issueVerificationToken(userId);
  const verificationLink = `${baseUrl}/${locale}/verify-email/${rawToken}`;

  const { subject, html } = verificationEmail({
    recipientName: escapeHtml(name),
    verificationLink,
    expiryHours: 24,
    locale,
  });
  try {
    await sendEmail(email, subject, html);
  } catch (err) {
    console.error("[register] email send failed (user can resend):", err);
  }

  return { ok: true, userId, email };
}
