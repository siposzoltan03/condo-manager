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
  return publicAccessiblePages.some((page) =>
    page === "/" ? p === "/" || p === "" : p === page || p.startsWith(page + "/")
  );
}

function isPublicApiRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth") ||
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

  const localeMatch = pathname.match(new RegExp(`^/(${routing.locales.join("|")})(\/|$)`));
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Public-accessible pages: allow through regardless of auth state
  if (isAccessible) {
    return intlMiddleware(req);
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth-excluded pages
  if (isAuthenticated && isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
  }

  return intlMiddleware(req);
});

// Tell NextAuth's auth() wrapper NOT to redirect unauthenticated users automatically.
// We handle all redirects ourselves in the callback above.
export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
