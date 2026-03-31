import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

/** Auth-excluded pages: unauthenticated users can view, authenticated users are redirected to dashboard. */
const publicPages = ["/login", "/forgot-password", "/reset-password"];

/** Pages accessible by BOTH authenticated and unauthenticated users (no redirect either way). */
const publicAccessiblePages = ["/", "/pricing", "/checkout", "/accept-invitation"];

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
  // Exact match for "/" (landing page) or starts-with for others
  return publicAccessiblePages.some((page) =>
    page === "/" ? p === "/" : p === page || p.startsWith(page + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // API routes: allow public API endpoints, require auth for everything else
  if (pathname.startsWith("/api")) {
    if (
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/invitations/by-token") ||
      pathname.startsWith("/api/plans") ||
      pathname.startsWith("/api/stripe/checkout") ||
      pathname.startsWith("/api/stripe/verify-session") ||
      pathname.startsWith("/api/stripe/webhook")
    ) {
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

  // Extract locale from the current pathname (e.g. /hu/dashboard -> hu)
  const localeMatch = pathname.match(new RegExp(`^/(${routing.locales.join("|")})(\/|$)`));
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Public-accessible pages: allow through regardless of auth state
  if (isAccessible) {
    return intlMiddleware(req);
  }

  // Redirect unauthenticated users to login (unless on a public or public-accessible page)
  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth-excluded pages (login, forgot-password, etc.)
  if (isAuthenticated && isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
  }

  // Apply next-intl middleware
  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
