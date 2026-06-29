"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { UserCog, LogOut } from "lucide-react";

/**
 * Persistent read-only impersonation banner. Visible on every authed page while
 * a SUPER_ADMIN is impersonating a member. Names the impersonated user + role +
 * building, notes the real superadmin is logged, and offers Exit (which audits
 * impersonate.end + clears the session). Renders nothing when not impersonating.
 */
export function ImpersonationBanner() {
  const t = useTranslations("impersonation");
  const tRoles = useTranslations("building");
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const imp = session?.user?.impersonating;
  if (!imp) return null;

  async function exit() {
    if (exiting) return;
    setExiting(true);
    try {
      await fetch("/api/impersonation/exit", { method: "POST" });
      await updateSession({ impersonating: null });
      router.refresh();
    } finally {
      setExiting(false);
    }
  }

  const roleLabel = tRoles(`role_${imp.role}` as Parameters<typeof tRoles>[0]);

  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-100 text-amber-950"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-200">
          <UserCog className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {t("viewingAs", {
              name: imp.userName ?? "",
              role: roleLabel,
              building: imp.buildingName ?? "",
            })}{" "}
            · <span className="font-bold uppercase">{t("readOnly")}</span>
          </div>
          <div className="text-xs text-amber-900/80">
            {t("loggedInAs", { name: session?.user?.name ?? "superadmin" })}
          </div>
        </div>
        <button
          onClick={exit}
          disabled={exiting}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-bold text-amber-300 hover:opacity-90 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t("exit")}
        </button>
      </div>
    </div>
  );
}
