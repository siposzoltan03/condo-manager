import { setRequestLocale, getTranslations } from "next-intl/server";
import { RoleGuard } from "@/components/auth/role-guard";
import { prisma } from "@/lib/prisma";
import {
  getRegistryStatus,
  type RegistryStatus,
} from "@/lib/officer-registry";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Phase 4 — Cross-building officer-registry tracker for SUPER_ADMIN.
 *
 * Lists every building's registration status sorted by urgency
 * (overdue → due-soon → ok → registered). Useful for support staff to
 * nudge customers before the 2026-10-31 deadline (Tht. § 55/A–D).
 *
 * Read-only in this phase; PATCH endpoint and per-building action UI
 * are tracked separately.
 */
export default async function OfficerRegistryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "compliance.registry" });

  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      representativeRegisteredAt: true,
      representativeRegistryDeadline: true,
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const ranked = buildings
    .map((b) => ({ b, status: getRegistryStatus(b, now) }))
    .sort((a, b) => rank(a.status) - rank(b.status));

  return (
    <RoleGuard
      capability="platform.admin"
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-lg bg-danger/10 px-6 py-4 text-center">
            <h2 className="text-lg font-semibold text-danger">Access Denied</h2>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1
            className="text-[28px] sm:text-[36px] lg:text-[44px]"
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
            }}
          >
            {t("titleDueSoon")}
          </h1>
          <p
            className="mt-2 max-w-prose"
            style={{ color: "var(--color-ink-soft)", fontSize: "14px" }}
          >
            Tht. § 55/A–D — 2026-10-31
          </p>
        </header>

        <div className="overflow-hidden rounded-xl border border-ink/8 bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/8">
                <Th>Building</Th>
                <Th>City</Th>
                <Th>Deadline</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ b, status }) => (
                <tr
                  key={b.id}
                  className="border-b border-ink/5 transition-colors hover:bg-bg-3"
                >
                  <Td>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div className="font-mono text-[11px] text-muted">
                      {b.address}
                    </div>
                  </Td>
                  <Td>{b.city}</Td>
                  <Td>
                    <span className="font-mono text-[11px]">
                      {b.representativeRegistryDeadline.toLocaleDateString(
                        locale === "en" ? "en-US" : "hu-HU",
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </span>
                  </Td>
                  <Td>
                    <StatusPill status={status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RoleGuard>
  );
}

/** Sort key — overdue first, then due-soon, then ok, then registered. */
function rank(s: RegistryStatus): number {
  switch (s.kind) {
    case "overdue":
      return 0;
    case "due-soon":
      return 1;
    case "ok":
      return 2;
    case "registered":
      return 3;
  }
}

function StatusPill({ status }: { status: RegistryStatus }) {
  const styles: Record<RegistryStatus["kind"], { bg: string; color: string; label: string }> = {
    overdue: {
      bg: "color-mix(in srgb, var(--color-danger) 16%, transparent)",
      color: "var(--color-danger)",
      label: `Overdue · ${status.kind === "overdue" ? status.daysOverdue : 0}d`,
    },
    "due-soon": {
      bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
      label: `Due in ${status.kind === "due-soon" ? status.daysLeft : 0}d`,
    },
    ok: {
      bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
      color: "var(--color-ink-soft)",
      label: `OK · ${status.kind === "ok" ? status.daysLeft : 0}d left`,
    },
    registered: {
      bg: "color-mix(in srgb, var(--color-good) 18%, transparent)",
      color: "var(--color-good)",
      label: "Registered",
    },
  };
  const s = styles[status.kind];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-sm text-ink">{children}</td>;
}
