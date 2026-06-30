"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { ImpersonationBanner } from "./impersonation-banner";

/** Pages that render standalone (no sidebar / top bar). */
const standalonePages = ["/login", "/forgot-password", "/reset-password", "/verify-email"];

/** Subtree paths that render their own shell — AppShell stays out of the way. */
const ownShellRoots = ["/contractor"];

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

/** Full-screen kiosk / companion routes that render without the app shell. */
const STANDALONE_PATTERNS = [
  /^\/voting\/meetings\/[^/]+\/live$/,
  /^\/voting\/meetings\/[^/]+\/follow$/,
];

function isStandalonePage(pathname: string): boolean {
  const p = stripLocale(pathname);
  if (STANDALONE_PATTERNS.some((re) => re.test(p))) return true;
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

function isOwnShellRoot(pathname: string): boolean {
  const p = stripLocale(pathname);
  return ownShellRoots.some((root) => p === root || p.startsWith(root + "/"));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Public + standalone pages render their own chrome. The contractor
  // subtree has its own ContractorShell as well — AppShell stays out
  // of the way for everything under /contractor.
  if (
    isStandalonePage(pathname) ||
    isPublicPage(pathname) ||
    isOwnShellRoot(pathname)
  ) {
    return <>{children}</>;
  }

  // Authenticated routes: always render the shell scaffold so server-rendered
  // HTML matches the first client render (no hydration mismatch / no flash of
  // shell-less layout while the session is loading). The Sidebar and TopBar
  // each call useSession() internally and degrade to placeholder content
  // while status === "loading".
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
    >
      <Sidebar />
      <main className="lg:pl-[244px]">
        <ImpersonationBanner />
        <TopBar />
        <div>{children}</div>
      </main>
    </div>
  );
}
