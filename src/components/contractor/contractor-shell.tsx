"use client";

import { usePathname } from "next/navigation";
import { ContractorSidebar } from "./contractor-sidebar";
import { ContractorTopbar, type ContractorTopbarData } from "./contractor-topbar";

/**
 * Routes the contractor section into one of three layouts:
 *
 *   1. Standalone-marketing — anonymous landing (`/contractor`), login,
 *      signup. Own chrome; passthrough.
 *   2. Standalone-wizard — onboarding. Owns its full-screen chrome;
 *      passthrough.
 *   3. Shell — every other authenticated contractor page. Renders
 *      sidebar + topbar around the page body.
 *
 * Pathname is read client-side via `usePathname()` so the same layout
 * file works across the tree.
 */
const SUPPORTED_LOCALES = new Set(["hu", "en"]);

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  return segments.length > 1 && SUPPORTED_LOCALES.has(segments[1])
    ? "/" + segments.slice(2).join("/")
    : pathname;
}

const STANDALONE_PATHS = new Set<string>([
  "/contractor",
  "/contractor/login",
  "/contractor/signup",
  "/contractor/onboarding",
]);

export function ContractorShell({
  data,
  children,
}: {
  /** null when the viewer isn't an authenticated contractor. */
  data: ContractorTopbarData | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const stripped = stripLocale(pathname);

  if (STANDALONE_PATHS.has(stripped) || !data) {
    return <>{children}</>;
  }

  // ContractorSidebar handles its own positioning — hamburger + drawer
  // on phone/tablet, sticky persistent column at lg:+. Main column gets
  // left padding at lg: to make room for the 244px persistent sidebar
  // (same pattern as the main app-shell).
  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--color-bg)",
        color: "var(--color-ink)",
      }}
    >
      <ContractorSidebar data={data} />
      <main className="lg:pl-[244px]" style={{ minWidth: 0 }}>
        <ContractorTopbar />
        <div>{children}</div>
      </main>
    </div>
  );
}
