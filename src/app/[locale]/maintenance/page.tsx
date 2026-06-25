import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getMaintenanceOverview } from "@/lib/maintenance-dal";
import type {
  CriticalHeroData,
  MaintenanceActivityEvent,
  MaintenanceContractorCard,
} from "@/lib/maintenance-dal";
import { MaintenanceShell } from "@/components/maintenance/maintenance-shell";
import { MaintenanceBoard } from "@/components/maintenance/maintenance-board";
import { MaintenanceHeaderActions } from "@/components/maintenance/maintenance-header-actions";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "maintenance.shell" });
  return { title: t("title") };
}

export default async function MaintenancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getMaintenanceOverview();
  const t = await getTranslations({ locale, namespace: "maintenance" });

  return (
    <MaintenanceShell
      locale={locale}
      active="overview"
      counts={{
        overview: data.totalOpenCount,
        contractors: data.contractorTotalCount,
        scheduled: data.scheduledCount,
      }}
      titleSuffix={t("shell.titleSuffixBoard")}
      headerActions={<MaintenanceHeaderActions isBoardPlus={data.isBoardPlus} />}
    >
      {data.critical && (
        <CriticalStrip data={data.critical} locale={locale} />
      )}

      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5"
        style={{ marginBottom: "28px" }}
      >
        <KpiTile
          label={t("kpis.critical")}
          value={data.kpis.critical.toString()}
          sub={t("kpis.criticalSub")}
          tone="danger"
          inverted
        />
        <KpiTile
          label={t("kpis.urgent")}
          value={data.kpis.urgent.toString()}
          sub={t("kpis.urgentSub")}
          tone="ochre"
        />
        <KpiTile
          label={t("kpis.inProgress")}
          value={data.kpis.inProgress.toString()}
          sub={t("kpis.inProgressSub", {
            n: data.kpis.inProgressContractors.toString(),
          })}
        />
        <KpiTile
          label={t("kpis.avgResolution")}
          value={
            data.kpis.avgResolutionDays != null
              ? data.kpis.avgResolutionDays.toString()
              : "—"
          }
          valueSuffix={t("kpis.daysUnit")}
          sub={t("kpis.avgResolutionSub")}
        />
        <KpiTile
          label={t("kpis.ytdCost")}
          value={(data.kpis.ytdCostFt / 1_000_000).toFixed(2)}
          valueSuffix={t("kpis.million")}
          sub={t("kpis.ytdCostSub", {
            n: data.kpis.ytdClosedCount.toString(),
          })}
        />
      </div>

      <MaintenanceBoard
        locale={locale}
        initialKanban={data.kanban}
        initialColumnCounts={data.columnCounts}
        list={data.list}
        isBoardPlus={data.isBoardPlus}
      />

      {/* Contractors strip */}
      <div
        className="flex justify-between items-baseline"
        style={{ margin: "10px 0 16px" }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "22px",
              fontWeight: 500,
              letterSpacing: "-0.025em",
            }}
          >
            {t("contractors.stripTitle")}
          </h2>
          <p
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              margin: "4px 0 0",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {t("contractors.stripSubtitle", {
              n: data.contractorTotalCount.toString(),
            })}
          </p>
        </div>
        <Link
          href={`/${locale}/maintenance/contractors`}
          style={{
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            color: "var(--color-ink-soft)",
          }}
        >
          {t("contractors.viewAll")}
        </Link>
      </div>

      {data.contractors.length === 0 ? (
        <div
          style={{
            background: "var(--color-card)",
            border: "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "13px",
            marginBottom: "24px",
          }}
        >
          {t("contractors.noContractors")}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          style={{ marginBottom: "24px" }}
        >
          {data.contractors.map((c) => (
            <ContractorCard key={c.id} contractor={c} locale={locale} t={t} />
          ))}
        </div>
      )}

      {/* Activity feed */}
      <ActivityPanel events={data.activity} locale={locale} />
    </MaintenanceShell>
  );
}

// ─── Critical strip ──────────────────────────────────────────────────────

async function CriticalStrip({
  data,
  locale,
}: {
  data: CriticalHeroData;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "maintenance" });

  return (
    <div
      className="flex items-center gap-6"
      style={{
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        borderRadius: "14px",
        padding: "20px 24px",
        marginBottom: "28px",
        position: "relative",
        overflow: "hidden",
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "4px",
          background: "var(--color-danger)",
        }}
      />
      <div
        className="flex items-center gap-2.5"
        style={{
          paddingRight: "24px",
          borderRight:
            "1px solid color-mix(in srgb, var(--color-bg) 18%, transparent)",
        }}
      >
        <div
          className="grid place-items-center"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "color-mix(in srgb, var(--color-danger) 25%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {t("criticalStrip.flag")}
          <small
            style={{
              display: "block",
              color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
              letterSpacing: "0.06em",
              fontWeight: 500,
              marginTop: "2px",
            }}
          >
            {t("criticalStrip.openCount", {
              n: data.totalOpenCritical.toString(),
            })}
          </small>
        </div>
      </div>
      <div className="flex-1 min-w-[200px]">
        <div
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "18px",
            fontWeight: 600,
            letterSpacing: "-0.015em",
          }}
        >
          {data.title}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
            letterSpacing: "0.04em",
            marginTop: "4px",
          }}
        >
          {data.trackingNumber} · {t("criticalStrip.reportedAgo", {
            hours: data.ageHours.toString(),
          })}
          {data.locationLabel ? ` · ${data.locationLabel}` : ""}
          {data.contractorName ? (
            <>
              {" · "}
              <b style={{ color: "var(--color-bg)", fontWeight: 600 }}>
                {data.contractorName}
              </b>
              {" "}
              {t("criticalStrip.enRoute")}
            </>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/${locale}/maintenance/${data.ticketId}`}
          style={{
            background: "transparent",
            border:
              "1px solid color-mix(in srgb, var(--color-bg) 25%, transparent)",
            color: "var(--color-bg)",
            padding: "9px 14px",
            borderRadius: "8px",
            fontWeight: 500,
            fontSize: "12px",
            textDecoration: "none",
          }}
        >
          {t("criticalStrip.openTicket")}
        </Link>
      </div>
    </div>
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  valueSuffix,
  sub,
  inverted = false,
  tone,
}: {
  label: string;
  value: string;
  valueSuffix?: string;
  sub: string;
  inverted?: boolean;
  tone?: "danger" | "ochre";
}) {
  const dotColor =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "ochre"
        ? "var(--color-ochre)"
        : null;

  return (
    <div
      style={{
        background: inverted ? "var(--color-ink)" : "var(--color-card)",
        color: inverted ? "var(--color-bg)" : "var(--color-ink)",
        border: inverted
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "16px 18px",
      }}
    >
      <div
        className="font-mono flex items-center gap-2"
        style={{
          fontSize: "10px",
          color: inverted
            ? "color-mix(in srgb, var(--color-bg) 60%, transparent)"
            : "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {dotColor && (
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: dotColor,
            }}
          />
        )}
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          margin: "10px 0 2px",
        }}
      >
        {value}
        {valueSuffix && (
          <small style={{ fontSize: "14px", color: "var(--color-muted)", marginLeft: "4px" }}>
            {valueSuffix}
          </small>
        )}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: inverted
            ? "color-mix(in srgb, var(--color-bg) 60%, transparent)"
            : "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

// ─── Contractor card ─────────────────────────────────────────────────────

function ContractorCard({
  contractor,
  locale,
  t,
}: {
  contractor: MaintenanceContractorCard;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const presence =
    contractor.presence === "on_site"
      ? { label: t("contractors.presenceOnSite"), bg: "var(--color-good-soft)", color: "var(--color-good)" }
      : contractor.presence === "contract"
        ? {
            label: t("contractors.presenceContract"),
            bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
            color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
          }
        : {
            label: t("contractors.presenceOff"),
            bg: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            color: "var(--color-muted)",
          };

  return (
    <Link
      href={`/${locale}/maintenance/contractors`}
      className="block transition-shadow hover:shadow"
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "16px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: "var(--color-bg-3)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 700,
            fontSize: "14px",
          }}
        >
          {contractor.initials}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="truncate"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            {contractor.name}
          </div>
          <div
            className="font-mono truncate"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {contractor.specialty}
          </div>
        </div>
        <span
          className="font-mono flex-shrink-0"
          style={{
            fontSize: "9px",
            padding: "2px 6px",
            borderRadius: "3px",
            background: presence.bg,
            color: presence.color,
            letterSpacing: "0.06em",
            fontWeight: 700,
          }}
        >
          {presence.label}
        </span>
      </div>
      <div
        className="flex items-baseline justify-between"
        style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop:
            "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {t("contractors.openCount")}{" "}
          <b
            style={{
              color: "var(--color-ink)",
              fontWeight: 700,
              fontSize: "14px",
              fontFamily: "var(--font-space-grotesk), sans-serif",
              marginLeft: "2px",
            }}
          >
            {contractor.openCount}
          </b>
        </div>
        <Stars rating={contractor.averageRating} />
      </div>
    </Link>
  );
}

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) {
    return (
      <span
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        —
      </span>
    );
  }
  const filled = Math.round(rating);
  return (
    <span
      style={{
        color: "var(--color-ochre)",
        fontSize: "12px",
        letterSpacing: "-0.5px",
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            color:
              i <= filled
                ? "var(--color-ochre)"
                : "color-mix(in srgb, var(--color-ink) 15%, transparent)",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ─── Activity panel ──────────────────────────────────────────────────────

async function ActivityPanel({
  events,
  locale,
}: {
  events: MaintenanceActivityEvent[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "maintenance" });

  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
      }}
    >
      <div
        className="flex justify-between items-start"
        style={{
          padding: "18px 22px",
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "17px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {t("activity.title")}
          </h3>
          <div
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              marginTop: "2px",
              textTransform: "uppercase",
            }}
          >
            {t("activity.subtitle")}
          </div>
        </div>
      </div>
      {events.length === 0 ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "13px",
          }}
        >
          {t("activity.empty")}
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {events.map((e, i) => (
            <ActivityRow
              key={e.id}
              event={e}
              isLast={i === events.length - 1}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

async function ActivityRow({
  event,
  isLast,
  locale,
}: {
  event: MaintenanceActivityEvent;
  isLast: boolean;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "maintenance" });

  const time = new Date(event.at).toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const tone = {
    new: { bg: "color-mix(in srgb, var(--color-ochre) 25%, transparent)", color: "color-mix(in srgb, var(--color-ochre) 70%, var(--color-ink))" },
    assigned: { bg: "color-mix(in srgb, #6c8caa 25%, transparent)", color: "#3a5a78" },
    comment: { bg: "color-mix(in srgb, var(--color-ink) 7%, transparent)", color: "var(--color-ink-soft)" },
    scheduled: { bg: "color-mix(in srgb, #6c8caa 25%, transparent)", color: "#3a5a78" },
    done: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    rated: { bg: "color-mix(in srgb, var(--color-ink) 7%, transparent)", color: "var(--color-ink-soft)" },
  }[event.tag];

  const avatarBg =
    event.avatar.tone === "ink"
      ? "var(--color-ink)"
      : event.avatar.tone === "moss"
        ? "var(--color-moss-2)"
        : event.avatar.tone === "ochre"
          ? "var(--color-ochre)"
          : "var(--color-bg-3)";
  const avatarColor =
    event.avatar.tone === "ink"
      ? "var(--color-bg)"
      : event.avatar.tone === "moss"
        ? "var(--color-bg)"
        : event.avatar.tone === "ochre"
          ? "var(--color-ink)"
          : "var(--color-ink-soft)";

  return (
    <li
      className="grid items-center"
      style={{
        gridTemplateColumns: "90px 36px 1fr auto",
        gap: "16px",
        padding: "13px 22px",
        borderBottom: isLast
          ? "0"
          : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {time}
      </div>
      <div
        className="grid place-items-center"
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: avatarBg,
          color: avatarColor,
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 600,
          fontSize: "11px",
          border:
            event.avatar.tone === "soft"
              ? "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)"
              : "0",
        }}
      >
        {event.avatar.initials}
      </div>
      <Link
        href={`/${locale}/maintenance/${event.ticketId}`}
        style={{
          fontSize: "13px",
          textDecoration: "none",
          color: "inherit",
          minWidth: 0,
        }}
      >
        <b style={{ fontWeight: 600 }}>{event.subjectName}</b> {event.body}
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            marginLeft: "6px",
          }}
        >
          {event.trackingNumber}
        </span>
      </Link>
      <span
        className="font-mono"
        style={{
          fontSize: "10px",
          letterSpacing: "0.06em",
          padding: "3px 7px",
          borderRadius: "4px",
          fontWeight: 700,
          background: tone.bg,
          color: tone.color,
          textTransform: "uppercase",
        }}
      >
        {t(`activity.tag.${event.tag}`)}
      </span>
    </li>
  );
}
