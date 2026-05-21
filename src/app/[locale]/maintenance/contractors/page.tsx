import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getContractorList, getMaintenanceOverview } from "@/lib/maintenance-dal";
import type { ContractorListItem } from "@/lib/maintenance-dal";
import { MaintenanceShell } from "@/components/maintenance/maintenance-shell";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "maintenance.shell" });
  return { title: `${t("title")} · ${t("tab.contractors")}` };
}

export default async function ContractorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [list, overview] = await Promise.all([
    getContractorList(),
    getMaintenanceOverview(),
  ]);
  const t = await getTranslations({ locale, namespace: "maintenance" });

  const sorted = [...list.items].sort((a, b) => {
    const presenceRank = { on_site: 0, contract: 1, off: 2 } as const;
    const pr = presenceRank[a.presence] - presenceRank[b.presence];
    if (pr !== 0) return pr;
    return b.openCount - a.openCount;
  });

  return (
    <MaintenanceShell
      locale={locale}
      active="contractors"
      counts={{
        overview: overview.totalOpenCount,
        contractors: list.items.length,
        scheduled: overview.scheduledCount,
      }}
      titleKey="maintenance.contractors.title"
      ledeKey="maintenance.contractors.lede"
    >
      {sorted.length === 0 ? (
        <div
          style={{
            background: "var(--color-card)",
            border: "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
            borderRadius: "14px",
            padding: "48px 32px",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "13px",
          }}
        >
          {t("contractors.noContractors")}
        </div>
      ) : (
        <ul
          className="grid gap-3.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {sorted.map((c) => (
            <ContractorCard key={c.id} contractor={c} t={t} />
          ))}
        </ul>
      )}
    </MaintenanceShell>
  );
}

function ContractorCard({
  contractor,
  t,
}: {
  contractor: ContractorListItem;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const presence =
    contractor.presence === "on_site"
      ? {
          label: t("contractors.presenceOnSite"),
          bg: "var(--color-good-soft)",
          color: "var(--color-good)",
        }
      : contractor.presence === "contract"
        ? {
            label: t("contractors.presenceContract"),
            bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
            color:
              "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
          }
        : {
            label: t("contractors.presenceOff"),
            bg: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            color: "var(--color-muted)",
          };

  return (
    <li
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "20px",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "var(--color-bg-3)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 700,
            fontSize: "16px",
          }}
        >
          {contractor.initials}
        </span>
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {contractor.name}
          </div>
          <div
            className="font-mono truncate"
            style={{
              fontSize: "10.5px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginTop: "2px",
            }}
          >
            {contractor.specialty}
          </div>
        </div>
        <span
          className="font-mono flex-shrink-0"
          style={{
            fontSize: "9px",
            padding: "3px 7px",
            borderRadius: "4px",
            background: presence.bg,
            color: presence.color,
            letterSpacing: "0.06em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {presence.label}
        </span>
      </div>

      {/* eslint-disable-next-line responsive/mobile-first -- compact 3-stat panel: short numeric values fit ~110px tiles at 360px */}
      <div
        className="grid grid-cols-3 gap-3 font-mono"
        style={{
          marginTop: "16px",
          paddingTop: "16px",
          borderTop:
            "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
          fontSize: "10px",
          letterSpacing: "0.04em",
          color: "var(--color-muted)",
          textTransform: "uppercase",
        }}
      >
        <Stat label={t("contractors.openCount")} value={contractor.openCount} />
        <Stat label={t("contractors.totalJobs")} value={contractor.totalJobs} />
        <Stat
          label={t("contractors.rating")}
          value={
            contractor.averageRating != null
              ? `${contractor.averageRating.toFixed(1)} / 5`
              : "—"
          }
          sub={
            contractor.totalRatings > 0
              ? t("contractors.ratingCount", {
                  n: contractor.totalRatings.toString(),
                })
              : null
          }
        />
      </div>

      <div
        style={{
          marginTop: "14px",
          fontSize: "12px",
          color: "var(--color-ink-soft)",
          lineHeight: 1.5,
        }}
      >
        {contractor.contactInfo}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string | null;
}) {
  return (
    <div>
      <div>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--color-ink)",
          marginTop: "2px",
          letterSpacing: "-0.01em",
          textTransform: "none",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: "2px", letterSpacing: "0.04em" }}>{sub}</div>
      )}
    </div>
  );
}
