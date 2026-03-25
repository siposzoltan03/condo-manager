"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

/** Pages that render standalone (no sidebar / top bar). */
const standalonePages = ["/login", "/forgot-password", "/reset-password"];

function isStandalonePage(pathname: string): boolean {
  // Strip locale prefix: /hu/login -> /login
  const segments = pathname.split("/");
  const pathWithoutLocale = "/" + segments.slice(2).join("/");
  return standalonePages.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // Standalone pages (login, forgot-password, etc.) never get the shell
  if (isStandalonePage(pathname)) {
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
