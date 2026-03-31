"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

/** Pages that render standalone (no sidebar / top bar). */
const standalonePages = ["/login", "/forgot-password", "/reset-password"];

/** Public marketing pages that render without the app shell (own nav). */
const publicPages = ["/pricing", "/checkout", "/accept-invitation"];

/** Locales supported by the application. */
const SUPPORTED_LOCALES = new Set(["hu", "en"]);

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  return segments.length > 1 && SUPPORTED_LOCALES.has(segments[1])
    ? "/" + segments.slice(2).join("/")
    : pathname;
}

function isStandalonePage(pathname: string): boolean {
  const p = stripLocale(pathname);
  return standalonePages.some(
    (page) => p === page || p.startsWith(page + "/")
  );
}

function isPublicPage(pathname: string): boolean {
  const p = stripLocale(pathname);
  // Root "/" is the landing page (public)
  if (p === "/" || p === "") return true;
  return publicPages.some(
    (page) => p === page || p.startsWith(page + "/")
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // Standalone pages (login, forgot-password, etc.) and public marketing pages never get the shell
  if (isStandalonePage(pathname) || isPublicPage(pathname)) {
    return <>{children}</>;
  }

  // While loading auth, show minimal loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  // Not authenticated — render children (middleware will redirect)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Authenticated: render full app shell
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <TopBar />
      <main className="lg:pl-64 pt-0">
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
