import { NextRequest, NextResponse } from "next/server";
import { register } from "@/lib/register";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Per-IP rate limit: 5 signups per hour. Blocks brute attempts at email
  // enumeration and slows abuse without an external bot-protection layer.
  // TODO: add Cloudflare Turnstile token verification here once env keys are set.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit({
    key: `auth:register:ip:${ip}`,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? "http://localhost:3000";

  const result = await register(body, baseUrl);

  if (!result.ok) {
    const status =
      result.error === "email-taken"
        ? 409
        : result.error === "validation"
          ? 400
          : 500;
    // For 400 (validation) the client expects { fields: { fieldName: messageKey } }
    // — translate the keys into localized strings server-side using the user's
    // requested locale, so the client doesn't need a key→message lookup.
    if (result.error === "validation" && result.fields) {
      const locale =
        typeof body === "object" && body !== null && (body as Record<string, unknown>).locale === "en"
          ? "en"
          : "hu";
      const messages = await import(`@/i18n/${locale}.json`).then(
        (m: { default: { auth: Record<string, string> } }) => m.default.auth,
      );
      const fields: Record<string, string> = {};
      for (const [field, key] of Object.entries(result.fields)) {
        if (key && messages[key]) fields[field] = messages[key];
      }
      return NextResponse.json(
        { ok: false, error: "validation", fields },
        { status: 400 },
      );
    }
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ ok: true, email: result.email }, { status: 201 });
}
