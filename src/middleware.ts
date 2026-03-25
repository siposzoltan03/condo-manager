import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

const publicPages = ["/login", "/forgot-password", "/reset-password"];

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

  // Skip middleware for all API routes
  if (pathname.startsWith("/api")) {
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

  // Redirect authenticated users away from login page
  if (isAuthenticated && isPublic) {
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }

  // Apply next-intl middleware
  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
