"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
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
  if (p === "/" || p === "") return true;
  return publicPages.some(
    (page) => p === page || p.startsWith(page + "/")
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();

  // Public and standalone pages: render children directly, no shell
  if (isStandalonePage(pathname) || isPublicPage(pathname)) {
    return <>{children}</>;
  }

  // For authenticated pages: always render the shell structure to avoid hydration mismatch.
  // The sidebar/topbar handle their own loading states internally.
  const isAuthenticated = status === "authenticated";

  return (
    <div className="min-h-screen bg-slate-50">
      {isAuthenticated && (
        <>
          <Sidebar />
          <TopBar />
        </>
      )}
      <main className={isAuthenticated ? "lg:pl-64 pt-0" : ""}>
        <div className={isAuthenticated ? "px-6 py-6" : ""}>{children}</div>
      </main>
    </div>
  );
}
