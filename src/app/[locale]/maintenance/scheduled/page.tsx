import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getScheduledList, getMaintenanceOverview } from "@/lib/maintenance-dal";
import type { ScheduledItem } from "@/lib/maintenance-dal";
import { MaintenanceShell } from "@/components/maintenance/maintenance-shell";
import { ScheduledHeaderActions } from "@/components/maintenance/scheduled-header-actions";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "maintenance.shell" });
  return { title: `${t("title")} · ${t("tab.scheduled")}` };
}

export default async function ScheduledPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [data, overview] = await Promise.all([
    getScheduledList(),
    getMaintenanceOverview(),
  ]);
  const t = await getTranslations({ locale, namespace: "maintenance" });

  return (
    <MaintenanceShell
      locale={locale}
      active="scheduled"
      counts={{
        overview: overview.totalOpenCount,
        contractors: overview.contractorTotalCount,
        scheduled: data.totalCount,
      }}
      titleKey="maintenance.scheduled.title"
      ledeKey="maintenance.scheduled.lede"
      headerActions={data.isBoardPlus ? <ScheduledHeaderActions /> : null}
    >
      {data.totalCount === 0 ? (
        <EmptyState locale={locale} isBoardPlus={data.isBoardPlus} />
      ) : (
        <>
          {data.upcoming.length > 0 && (
            <Section
              eyebrow={t("scheduled.upcomingEyebrow", {
                n: data.upcoming.length.toString(),
              })}
              title={t("scheduled.upcomingTitle")}
            >
              <Timeline items={data.upcoming} locale={locale} t={t} />
            </Section>
          )}
          {data.past.length > 0 && (
            <Section
              eyebrow={t("scheduled.pastEyebrow", {
                n: data.past.length.toString(),
              })}
              title={t("scheduled.pastTitle")}
              marginTop="32px"
            >
              <Timeline items={data.past} locale={locale} t={t} faded />
            </Section>
          )}
        </>
      )}
    </MaintenanceShell>
  );
}

function Section({
  eyebrow,
  title,
  marginTop,
  children,
}: {
  eyebrow: string;
  title: string;
  marginTop?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop }}>
      <div style={{ marginBottom: "14px" }}>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
          }}
        >
          {eyebrow}
        </span>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            marginTop: "4px",
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Timeline({
  items,
  locale,
  t,
  faded = false,
}: {
  items: ScheduledItem[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  faded?: boolean;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        overflow: "hidden",
        opacity: faded ? 0.85 : 1,
      }}
    >
      {items.map((item, idx) => (
        <ScheduledRow
          key={item.id}
          item={item}
          isLast={idx === items.length - 1}
          locale={locale}
          t={t}
        />
      ))}
    </ul>
  );
}

function ScheduledRow({
  item,
  isLast,
  locale,
  t,
}: {
  item: ScheduledItem;
  isLast: boolean;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  void locale;
  const dt = new Date(item.date);
  const dateLabel = dt.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const daysLabel =
    item.daysFromNow === 0
      ? t("scheduled.today")
      : item.daysFromNow > 0
        ? t("scheduled.inDays", { n: item.daysFromNow.toString() })
        : t("scheduled.daysAgo", {
            n: Math.abs(item.daysFromNow).toString(),
          });

  // Recurrence preset label
  const recurrenceLabel = item.isRecurring
    ? recurrenceLabelOf(item.recurrenceMonths, t)
    : null;

  // "Ticket fires in N days" hint
  const fireHint =
    item.daysToNextFire <= 0
      ? t("scheduled.fireDue")
      : t("scheduled.fireIn", { n: item.daysToNextFire.toString() });

  return (
    <li
      className="grid items-start"
      style={{
        gridTemplateColumns: "130px 1fr auto",
        gap: "16px",
        padding: "16px 20px",
        borderBottom: isLast
          ? "0"
          : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {daysLabel}
        </div>
        <div
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            marginTop: "2px",
          }}
        >
          {dt.toLocaleDateString("hu-HU", {
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>
      <div className="min-w-0">
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {item.title}
        </div>
        {item.description && (
          <div
            style={{
              fontSize: "12.5px",
              color: "var(--color-ink-soft)",
              marginTop: "2px",
              lineHeight: 1.5,
            }}
          >
            {item.description}
          </div>
        )}
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            marginTop: "4px",
          }}
        >
          {dateLabel}
        </div>
        <div
          className="flex flex-wrap gap-2"
          style={{ marginTop: "8px" }}
        >
          <Pill tone="ochre">
            {t("scheduled.leadTimeChip", {
              n: item.leadTimeDays.toString(),
            })}
          </Pill>
          <Pill tone="muted">{fireHint}</Pill>
          {item.materializedAt && (
            <Pill tone="muted">
              {t("scheduled.lastFired", {
                date: new Date(item.materializedAt).toLocaleDateString("hu-HU", {
                  month: "short",
                  day: "numeric",
                }),
              })}
            </Pill>
          )}
        </div>
      </div>
      {recurrenceLabel && (
        <span
          className="font-mono"
          style={{
            fontSize: "9px",
            padding: "3px 7px",
            borderRadius: "4px",
            background:
              "color-mix(in srgb, var(--color-moss-2) 18%, transparent)",
            color: "var(--color-moss-2)",
            letterSpacing: "0.06em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {recurrenceLabel}
        </span>
      )}
    </li>
  );
}

function recurrenceLabelOf(
  months: number | null,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  if (months == null) return t("scheduled.recurring");
  if (months === 1) return t("scheduled.modal.preset_1");
  if (months === 3) return t("scheduled.modal.preset_3");
  if (months === 6) return t("scheduled.modal.preset_6");
  if (months === 12) return t("scheduled.modal.preset_12");
  if (months === 24) return t("scheduled.modal.preset_24");
  return t("scheduled.everyNMonths", { n: months.toString() });
}

function Pill({
  tone,
  children,
}: {
  tone: "ochre" | "muted";
  children: React.ReactNode;
}) {
  const styles =
    tone === "ochre"
      ? {
          bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
          color:
            "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
        }
      : {
          bg: "color-mix(in srgb, var(--color-ink) 7%, transparent)",
          color: "var(--color-ink-soft)",
        };
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "4px",
        background: styles.bg,
        color: styles.color,
        letterSpacing: "0.04em",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

async function EmptyState({
  locale,
  isBoardPlus,
}: {
  locale: string;
  isBoardPlus: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "maintenance.scheduled" });
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
        borderRadius: "14px",
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <div
        className="grid place-items-center mx-auto"
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--color-moss-2) 18%, transparent)",
          color: "var(--color-moss-2)",
          marginBottom: "18px",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "22px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          marginBottom: "8px",
        }}
      >
        {t("emptyTitle")}
      </h2>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "14px",
          maxWidth: "44ch",
          margin: "0 auto",
          lineHeight: 1.55,
        }}
      >
        {isBoardPlus ? t("emptyBodyBoard") : t("emptyBodyMember")}
      </p>
    </div>
  );
}
