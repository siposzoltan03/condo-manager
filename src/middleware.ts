import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

/** Auth-excluded pages: unauthenticated users can view, authenticated users are redirected to their home. */
const publicPages = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/contractor/login",
  "/contractor/signup",
];

/** Pages accessible by BOTH authenticated and unauthenticated users (no redirect either way). */
const publicAccessiblePages = ["/", "/pricing", "/checkout", "/accept-invitation"];

/** Exact-path public pages — match without prefix expansion. */
const publicExactPaths = new Set(["/contractor"]);

/** Strip locale prefix and return the path. */
function isContractorPath(stripped: string): boolean {
  return stripped === "/contractor" || stripped.startsWith("/contractor/");
}

/** Strip locale prefix from a pathname (e.g. /hu/login -> /login, /hu -> /). */
function stripLocale(pathname: string): string {
  return routing.locales.reduce(
    (path, locale) =>
      path.startsWith(`/${locale}/`)
        ? path.slice(`/${locale}`.length)
        : path === `/${locale}`
          ? "/"
          : path,
    pathname
  );
}

function isPublicPage(pathname: string): boolean {
  const p = stripLocale(pathname);
  return publicPages.some((page) => p === page || p.startsWith(page + "/"));
}

function isPublicAccessiblePage(pathname: string): boolean {
  const p = stripLocale(pathname);
  if (publicExactPaths.has(p)) return true;
  return publicAccessiblePages.some((page) =>
    page === "/" ? p === "/" || p === "" : p === page || p.startsWith(page + "/")
  );
}

function isPublicApiRoute(pathname: string): boolean {
  return (
    pathname === "/api/metrics" || // Prometheus scrape endpoint (tailnet-only)
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/contractor/auth/signup") ||
    pathname.startsWith("/api/contractor/auth/check-tax-id") ||
    pathname.startsWith("/api/contractor/auth/verify-email") ||
    pathname.startsWith("/api/invitations/by-token") ||
    pathname.startsWith("/api/plans") ||
    pathname.startsWith("/api/stripe/checkout") ||
    pathname.startsWith("/api/stripe/verify-session") ||
    pathname.startsWith("/api/stripe/webhook")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // API routes
  if (pathname.startsWith("/api")) {
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }
    if (!req.auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isAuthenticated = !!req.auth;
  const isPublic = isPublicPage(pathname);
  const isAccessible = isPublicAccessiblePage(pathname);
  const sessionKind =
    (req.auth?.user as { kind?: "condo" | "contractor" } | undefined)?.kind ??
    "condo";

  const localeMatch = pathname.match(new RegExp(`^/(${routing.locales.join("|")})(\/|$)`));
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const stripped = stripLocale(pathname);
  const wantsContractorTree = isContractorPath(stripped);

  // Public-accessible pages: allow through regardless of auth state
  if (isAccessible) {
    return intlMiddleware(req);
  }

  // Cross-tree isolation: a contractor session on a condo route or vice
  // versa is redirected to the right home. Stops a contractor accidentally
  // landing on /dashboard via a stale cookie + condo sessions snooping
  // /contractor/marketplace.
  if (isAuthenticated && !isPublic) {
    if (sessionKind === "contractor" && !wantsContractorTree) {
      return NextResponse.redirect(
        new URL(`/${locale}/contractor/marketplace`, req.url),
      );
    }
    if (sessionKind === "condo" && wantsContractorTree) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
    }
  }

  // Redirect unauthenticated users to the right login form.
  if (!isAuthenticated && !isPublic) {
    const loginPath = wantsContractorTree
      ? `/${locale}/contractor/login`
      : `/${locale}/login`;
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth-excluded pages.
  if (isAuthenticated && isPublic) {
    const home =
      sessionKind === "contractor"
        ? `/${locale}/contractor/marketplace`
        : `/${locale}/dashboard`;
    return NextResponse.redirect(new URL(home, req.url));
  }

  return intlMiddleware(req);
});

// Tell NextAuth's auth() wrapper NOT to redirect unauthenticated users automatically.
// We handle all redirects ourselves in the callback above.
export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
