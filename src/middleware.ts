import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

const publicPages = ["/login", "/forgot-password", "/reset-password", "/accept-invitation"];

/** Pages accessible by both authenticated and unauthenticated users (no redirect to dashboard). */
const publicAccessiblePages = ["/accept-invitation"];

function isPublicPage(pathname: string): boolean {
  // Strip locale prefix if present (e.g., /hu/login -> /login)
  const pathWithoutLocale = routing.locales.reduce(
    (path, locale) =>
      path.startsWith(`/${locale}/`)
        ? path.slice(`/${locale}`.length)
        : path === `/${locale}`
          ? "/"
          : path,
    pathname
  );

  return publicPages.some((page) => pathWithoutLocale.startsWith(page));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // API routes: allow auth endpoints, require auth for everything else
  if (pathname.startsWith("/api")) {
    if (
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/invitations/by-token")
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

  // Extract locale from the current pathname (e.g. /hu/dashboard -> hu)
  const localeMatch = pathname.match(new RegExp(`^/(${routing.locales.join("|")})(\/|$)`));
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page (but not from public accessible pages like accept-invitation)
  if (isAuthenticated && isPublic) {
    const pathWithoutLocale = routing.locales.reduce(
      (path, locale) =>
        path.startsWith(`/${locale}/`)
          ? path.slice(`/${locale}`.length)
          : path === `/${locale}`
            ? "/"
            : path,
      pathname
    );
    const isPublicAccessible = publicAccessiblePages.some((page) =>
      pathWithoutLocale.startsWith(page)
    );
    if (!isPublicAccessible) {
      return NextResponse.redirect(new URL(`/${locale}`, req.url));
    }
  }

  // Apply next-intl middleware
  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
