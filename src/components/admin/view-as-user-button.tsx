"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Eye, Search, X, ShieldCheck, Check } from "lucide-react";

interface Member {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  isChair: boolean;
}

/**
 * Per-building "view as user" entry for the admin buildings list. SUPER_ADMIN
 * picks a member; we start a read-only impersonation and land on that user's
 * dashboard. Mirrors the building-switcher session pattern (updateSession +
 * router). Read-only is enforced server-side (middleware); this is the entry.
 */
export function ViewAsUserButton({
  buildingId,
  buildingName,
}: {
  buildingId: string;
  buildingName: string;
}) {
  const t = useTranslations("impersonation");
  const tRoles = useTranslations("building");
  const router = useRouter();
  const locale = useLocale();
  const { update: updateSession } = useSession();

  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  async function openPicker() {
    setOpen(true);
    setSelected(null);
    setQuery("");
    setMembers(null);
    const res = await fetch(
      `/api/impersonation/members?buildingId=${encodeURIComponent(buildingId)}`,
    );
    setMembers(res.ok ? await res.json() : []);
  }

  async function go() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/impersonation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId, userId: selected.userId }),
      });
      if (res.ok) {
        const data = await res.json();
        await updateSession({ impersonating: data });
        setOpen(false);
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = (role: string) =>
    tRoles(`role_${role}` as Parameters<typeof tRoles>[0]);

  const filtered = (members ?? []).filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  return (
    <>
      <button
        onClick={openPicker}
        title={t("viewAsUser")}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-700"
      >
        <Eye className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {t("viewAsUser")}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {t("pickMember")} — {buildingName}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3 text-slate-400">
              <Search className="h-4 w-4" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchMembers")}
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
              />
            </div>

            <div className="min-h-[200px] flex-1 overflow-y-auto p-2">
              {members === null ? (
                <p className="p-6 text-center text-sm text-slate-400">…</p>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">{t("noMembers")}</p>
              ) : (
                filtered.map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => setSelected(m)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      selected?.userId === m.userId ? "bg-amber-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {m.name ?? m.email}
                      </div>
                      <div className="truncate text-xs text-slate-500">{m.email}</div>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {roleLabel(m.role)}
                    </span>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full border ${
                        selected?.userId === m.userId
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-slate-300 text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 px-6 py-4">
              <div className="flex flex-1 items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{t("readOnlyNote")}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={go}
                  disabled={!selected || busy}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {selected
                    ? t("viewAsName", { name: selected.name ?? selected.email })
                    : t("viewAsUser")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
