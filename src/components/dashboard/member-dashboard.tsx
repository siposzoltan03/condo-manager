import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type {
  MemberDashboardData,
  MemberRecentAnnouncement,
  MemberOwnTicket,
} from "@/lib/dashboard-dal";

// ─── Helpers ───────────────────────────────────────────────────────────────

type GreetingKey = "morning" | "day" | "evening";
function greetingKeyForHour(h: number): GreetingKey {
  if (h < 4) return "evening";
  if (h < 11) return "morning";
  if (h < 18) return "day";
  return "evening";
}

function intlLocale(locale: string): string {
  return locale === "en" ? "en-US" : "hu-HU";
}

function formatHUF(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toString();
}

function formatDateShort(iso: string, locale: string): string {
  return new Date(iso)
    .toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric" })
    .toUpperCase();
}

function formatRelative(
  iso: string,
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string,
  now = new Date(),
): string {
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffH < 1) return t("now");
  if (diffH < 24) return t("relative.hoursAgo", { n: diffH });
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return t("relative.yesterday");
  if (diffD < 7) return t("relative.daysAgo", { n: diffD });
  return d
    .toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric" })
    .toUpperCase();
}

// ─── Component ─────────────────────────────────────────────────────────────

interface Props {
  locale: string;
  userName: string;
  data: MemberDashboardData;
}

export async function MemberDashboard({ locale, userName, data }: Props) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tBrand = await getTranslations({ locale, namespace: "brand" });

  const now = new Date();
  const greeting = t(`greeting.${greetingKeyForHour(now.getHours())}`);
  const firstName = userName.split(" ").pop() ?? userName;
  const dateLabel = now.toLocaleDateString(intlLocale(locale), {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const isTenant = data.role === "TENANT";
  const isOwner = data.role === "OWNER";

  // Subtitle: build a short summary line per role.
  const subtitleParts: string[] = [];
  const unreadCount = data.announcements.filter((a) => !a.isRead).length;
  if (unreadCount > 0)
    subtitleParts.push(
      t("memberHeaderLine.newAnnouncements", { count: unreadCount }),
    );
  if (data.kpi.ownOpenTickets > 0)
    subtitleParts.push(
      t("memberHeaderLine.ownOpenTickets", { count: data.kpi.ownOpenTickets }),
    );
  if (isOwner && data.activeVote && !data.activeVote.hasCast)
    subtitleParts.push(t("memberHeaderLine.voteToCast"));
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(", ") : null;
  void tBrand;

  return (
    <div style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "44px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1,
          }}
        >
          {greeting},{" "}
          <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
            {firstName}.
          </span>
        </h1>
        <p
          style={{
            color: "var(--color-ink-soft)",
            margin: "8px 0 0",
            maxWidth: "60ch",
          }}
        >
          {dateLabel}.
          {subtitle && (
            <>
              {" "}
              <b>{subtitle}</b> {t("headerLine.callToAction")}
            </>
          )}
        </p>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        style={{
          gridTemplateColumns:
            isOwner ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
          marginBottom: "24px",
        }}
      >
        {isOwner && (
          <KpiCard
            variant={data.kpi.ownBalance > 0 ? "ochre" : "moss"}
            icon="₣"
            label={t("memberKpiOwnBalance")}
            value={formatHUF(data.kpi.ownBalance)}
            unit="Ft"
            sub={
              data.kpi.ownArrearsUnits > 0
                ? `${data.kpi.ownArrearsUnits} ${t("memberKpiUnitsArrears")}`
                : t("memberKpiAllPaid")
            }
          />
        )}
        <KpiCard
          icon="⚑"
          label={t("memberKpiOwnTickets")}
          value={String(data.kpi.ownOpenTickets)}
          unit={t("kpiTicketsUnit")}
          sub={
            data.kpi.ownOpenTickets > 0
              ? t("memberKpiTicketsActive")
              : t("memberKpiNoTickets")
          }
        />
        <KpiCard
          variant="dark"
          icon="📅"
          label={t("memberKpiNextMeeting")}
          value={
            data.kpi.nextMeetingDate
              ? formatDateShort(data.kpi.nextMeetingDate, locale)
              : "—"
          }
          unit=""
          sub={
            data.kpi.nextMeetingDate
              ? t("memberKpiMeetingComing")
              : t("memberKpiNoMeeting")
          }
        />
      </div>

      {/* ── Quick actions row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: "24px" }}>
        <QuickAction
          href={`/${locale}/maintenance`}
          iconBg="var(--color-ochre)"
          iconColor="var(--color-ink)"
          label={t("memberQuickReportIssue")}
          sub={t("memberQuickReportIssueSub")}
          icon="wrench"
        />
        <QuickAction
          href={`/${locale}/communication`}
          iconBg="var(--color-ink)"
          iconColor="var(--color-bg)"
          label={t("memberQuickMessageChair")}
          sub={t("memberQuickMessageChairSub")}
          icon="mail"
        />
        {isOwner && (
          <QuickAction
            href={`/${locale}/voting`}
            iconBg="var(--color-moss)"
            iconColor="#f5f2e6"
            label={t("memberQuickVoting")}
            sub={t("memberQuickVotingSub")}
            icon="ballot"
          />
        )}
        {isOwner && (
          <QuickAction
            href={`/${locale}/finance`}
            iconBg="color-mix(in srgb, var(--color-ink) 90%, var(--color-moss))"
            iconColor="var(--color-bg)"
            label={t("memberQuickOwnFinance")}
            sub={t("memberQuickOwnFinanceSub")}
            icon="document"
          />
        )}
        {isTenant && (
          <QuickAction
            href={`/${locale}/documents`}
            iconBg="var(--color-moss)"
            iconColor="#f5f2e6"
            label={t("memberQuickHouseRules")}
            sub={t("memberQuickHouseRulesSub")}
            icon="document"
          />
        )}
        {isTenant && (
          <QuickAction
            href={`/${locale}/communication`}
            iconBg="color-mix(in srgb, var(--color-ink) 90%, var(--color-moss))"
            iconColor="var(--color-bg)"
            label={t("memberQuickAnnouncements")}
            sub={t("memberQuickAnnouncementsSub")}
            icon="megaphone"
          />
        )}
      </div>

      {/* ── Two-col: Announcements + (Active vote OR house rules) ──────── */}
      <div
        className="grid grid-cols-1 gap-5"
        style={{
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          marginBottom: "24px",
        }}
      >
        <Panel>
          <PanelHead
            title={t("memberRecentAnnouncements")}
            sub={
              unreadCount > 0
                ? `${unreadCount} ${t("memberAnnouncementsUnread")}`
                : t("memberAnnouncementsAllRead")
            }
            link={{ label: t("seeAll"), href: `/${locale}/communication` }}
          />
          <div>
            {data.announcements.length === 0 ? (
              <EmptyHint label={t("memberEmptyAnnouncements")} />
            ) : (
              data.announcements.map((a) => (
                <AnnouncementRow key={a.id} item={a} locale={locale} t={t} />
              ))
            )}
          </div>
        </Panel>

        {isOwner && data.activeVote && (
          <Panel>
            <PanelHead
              title={t("memberActiveVote")}
              sub={
                data.activeVote.hasCast
                  ? t("memberVoteCast")
                  : t("memberVotePending")
              }
              link={{
                label: data.activeVote.hasCast ? t("open") : t("memberCastVote"),
                href: `/${locale}/voting`,
              }}
            />
            <div style={{ padding: "22px" }}>
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {t("memberActiveVoteEyebrow")}
              </span>
              <h4
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: "20px",
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  margin: "8px 0 14px",
                }}
              >
                {data.activeVote.title}
              </h4>
              <div
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.05em",
                  marginBottom: "16px",
                }}
              >
                {t("voteClosesPrefix")} · {formatDateShort(data.activeVote.deadline, locale)}
              </div>
              <Link
                href={`/${locale}/voting`}
                className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: data.activeVote.hasCast
                    ? "var(--color-bg-3)"
                    : "var(--color-ink)",
                  color: data.activeVote.hasCast
                    ? "var(--color-ink)"
                    : "var(--color-bg)",
                  border: data.activeVote.hasCast
                    ? "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)"
                    : "1px solid var(--color-ink)",
                }}
              >
                {data.activeVote.hasCast
                  ? t("memberVoteSeeResults")
                  : `${t("memberCastVote")} →`}
              </Link>
            </div>
          </Panel>
        )}

        {(isTenant || (isOwner && !data.activeVote)) && (
          <Panel>
            <PanelHead
              title={t("memberHouseRules")}
              sub={t("memberHouseRulesSub")}
              link={{ label: t("open"), href: `/${locale}/documents` }}
            />
            <div style={{ padding: "22px" }}>
              {data.houseRulesDoc ? (
                <Link
                  href={`/${locale}/documents`}
                  className="flex items-center gap-3 transition-colors hover:bg-[var(--color-bg-3)]"
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    border: "1px dashed color-mix(in srgb, var(--color-ink) 12%, transparent)",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="grid place-items-center flex-shrink-0"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "9px",
                      background: "color-mix(in srgb, var(--color-moss) 18%, transparent)",
                      color: "var(--color-moss)",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <strong
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      {data.houseRulesDoc.title}
                    </strong>
                    <small
                      className="font-mono"
                      style={{
                        fontSize: "10px",
                        color: "var(--color-muted)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      PDF · NYILVÁNOS
                    </small>
                  </div>
                </Link>
              ) : (
                <EmptyHint label={t("memberEmptyHouseRules")} />
              )}
            </div>
          </Panel>
        )}
      </div>

      {/* ── Two-col bottom: Own tickets + Contact chair ────────────────── */}
      <div
        className="grid grid-cols-1 gap-5"
        style={{
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        }}
      >
        <Panel>
          <PanelHead
            title={t("memberOwnTickets")}
            sub={
              data.kpi.ownOpenTickets > 0
                ? `${data.kpi.ownOpenTickets} ${t("openItems")}`
                : t("memberNoOpenTickets")
            }
            link={{ label: t("seeAll"), href: `/${locale}/maintenance` }}
          />
          <div>
            {data.ownTickets.length === 0 ? (
              <EmptyHint label={t("memberEmptyTickets")} />
            ) : (
              data.ownTickets.map((t, i) => (
                <TicketRow
                  key={t.id}
                  item={t}
                  locale={locale}
                  last={i === data.ownTickets.length - 1}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title={t("memberContactBoard")}
            sub={t("memberContactBoardSub")}
          />
          <div style={{ padding: "22px" }}>
            {data.chair ? (
              <Link
                href={`/${locale}/communication`}
                className="flex items-center gap-3 transition-colors hover:bg-[var(--color-bg-3)]"
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  background: "var(--color-bg-3)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span
                  className="grid place-items-center"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "var(--color-ochre)",
                    color: "var(--color-ink)",
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  {data.chair.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <strong
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {data.chair.name}
                  </strong>
                  <small
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    KÉPVISELŐ · ÜZENETKÜLDÉS
                  </small>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  style={{ color: "var(--color-muted)" }}
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            ) : (
              <EmptyHint label={t("memberEmptyContact")} />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Subcomponents (reused style with BoardDashboard) ──────────────────────

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden ${className ?? ""}`}
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
      }}
    >
      {children}
    </div>
  );
}

function PanelHead({
  title,
  sub,
  link,
}: {
  title: string;
  sub?: string;
  link?: { label: string; href: string };
}) {
  return (
    <div
      className="flex justify-between items-center"
      style={{
        padding: "18px 22px",
        borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <div>
        <h3 style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.02em" }}>
          {title}
        </h3>
        {sub && (
          <div
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              marginTop: "2px",
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {link && (
        <Link
          href={link.href}
          className="inline-flex items-center touch:min-h-11 touch:px-2 touch:-mx-2 touch:-my-1"
          style={{
            fontSize: "12px",
            color: "var(--color-ink-soft)",
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}

function KpiCard({
  variant,
  icon,
  label,
  value,
  unit,
  sub,
}: {
  variant?: "dark" | "moss" | "ochre";
  icon: string;
  label: string;
  value: string;
  unit?: string;
  sub: string;
}) {
  const bg =
    variant === "dark"
      ? "var(--color-ink)"
      : variant === "moss"
        ? "var(--color-moss)"
        : variant === "ochre"
          ? "var(--color-ochre)"
          : "var(--color-card)";
  const fg =
    variant === "dark" || variant === "moss"
      ? "#f5f2e6"
      : "var(--color-ink)";
  const subColor = variant
    ? "color-mix(in srgb, currentColor 78%, transparent)"
    : "var(--color-ink-soft)";
  const labelColor = variant
    ? "color-mix(in srgb, currentColor 70%, transparent)"
    : "var(--color-muted)";
  const iconBg = variant
    ? "color-mix(in srgb, currentColor 18%, transparent)"
    : "color-mix(in srgb, var(--color-ink) 8%, transparent)";

  return (
    <div
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${variant ? bg : "color-mix(in srgb, var(--color-ink) 10%, transparent)"}`,
        borderRadius: "14px",
        padding: "22px",
      }}
    >
      <div
        className="font-mono flex items-center gap-2"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: labelColor,
        }}
      >
        <span
          className="grid place-items-center"
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            background: iconBg,
            color: "currentColor",
            fontSize: "12px",
          }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "38px",
          fontWeight: 500,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          margin: "16px 0 6px",
        }}
      >
        {value}
        {unit && (
          <small
            style={{
              fontSize: "16px",
              marginLeft: "4px",
              fontWeight: 400,
              color: variant
                ? "color-mix(in srgb, currentColor 65%, transparent)"
                : "var(--color-muted)",
            }}
          >
            {unit}
          </small>
        )}
      </div>
      <div style={{ fontSize: "12px", color: subColor }}>{sub}</div>
    </div>
  );
}

function AnnouncementRow({
  item,
  locale,
  t,
}: {
  item: MemberRecentAnnouncement;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <Link
      href={`/${locale}/communication`}
      className="grid items-start cursor-pointer hover:bg-[var(--color-bg-3)] transition-colors"
      style={{
        gridTemplateColumns: "8px 1fr auto",
        gap: "14px",
        padding: "14px 22px",
        borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span
        className="self-center"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: item.isRead
            ? "transparent"
            : "var(--color-ochre)",
          border: item.isRead
            ? "1px solid color-mix(in srgb, var(--color-ink) 20%, transparent)"
            : "none",
        }}
      />
      <div className="min-w-0">
        <strong
          style={{
            display: "block",
            fontWeight: item.isRead ? 500 : 600,
            fontSize: "13.5px",
            letterSpacing: "-0.005em",
          }}
        >
          {item.title}
        </strong>
        <p
          style={{
            margin: "3px 0 0",
            fontSize: "12.5px",
            color: "var(--color-ink-soft)",
            lineHeight: 1.4,
          }}
        >
          {item.bodyExcerpt}
        </p>
      </div>
      <div
        className="font-mono whitespace-nowrap self-center"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
        }}
      >
        {formatRelative(item.createdAt, t, locale)}
      </div>
    </Link>
  );
}

function TicketRow({
  item,
  locale,
  last,
}: {
  item: MemberOwnTicket;
  locale: string;
  last: boolean;
}) {
  const urgent = item.urgency === "HIGH" || item.urgency === "CRITICAL";
  return (
    <Link
      href={`/${locale}/maintenance`}
      className="grid items-center cursor-pointer hover:bg-[var(--color-bg-3)] transition-colors"
      style={{
        gridTemplateColumns: "1fr auto",
        gap: "14px",
        padding: "14px 22px",
        borderBottom: last
          ? "none"
          : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div className="min-w-0">
        <strong
          style={{ display: "block", fontWeight: 600, fontSize: "13.5px" }}
        >
          {item.title}
        </strong>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.05em",
            marginTop: "3px",
          }}
        >
          / {item.trackingNumber} · {item.status}
        </div>
      </div>
      <span
        className="font-mono whitespace-nowrap"
        style={{
          fontSize: "10px",
          letterSpacing: "0.06em",
          padding: "3px 8px",
          borderRadius: "4px",
          fontWeight: 600,
          background: urgent
            ? "var(--color-danger-soft)"
            : "color-mix(in srgb, var(--color-ink) 8%, transparent)",
          color: urgent ? "var(--color-danger)" : "var(--color-ink-soft)",
        }}
      >
        {item.urgency}
      </span>
    </Link>
  );
}

function QuickAction({
  href,
  iconBg,
  iconColor,
  label,
  sub,
  icon,
}: {
  href: string;
  iconBg: string;
  iconColor: string;
  label: string;
  sub: string;
  icon: "wrench" | "mail" | "ballot" | "document" | "megaphone";
}) {
  return (
    <Link
      href={href}
      className="flex gap-3.5 items-center transition-all hover:border-[color-mix(in_srgb,var(--color-ink)_20%,transparent)]"
      style={{
        padding: "18px",
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        textDecoration: "none",
        color: "var(--color-ink)",
      }}
    >
      <div
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "9px",
          background: iconBg,
          color: iconColor,
        }}
      >
        <Icon kind={icon} />
      </div>
      <div>
        <strong
          style={{
            display: "block",
            fontWeight: 600,
            fontSize: "14px",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </strong>
        <small
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.05em",
            display: "block",
            marginTop: "2px",
          }}
        >
          {sub}
        </small>
      </div>
    </Link>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "32px 22px",
        textAlign: "center",
        color: "var(--color-muted)",
        fontSize: "13px",
      }}
    >
      {label}
    </div>
  );
}

function Icon({ kind }: { kind: "wrench" | "mail" | "ballot" | "document" | "megaphone" }) {
  const common = {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    "aria-hidden": true,
  } as const;
  if (kind === "wrench")
    return (
      <svg {...common}>
        <path d="M14 2l6 6-11 11H3v-6z" />
      </svg>
    );
  if (kind === "mail")
    return (
      <svg {...common}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M22 7l-10 6L2 7" />
      </svg>
    );
  if (kind === "ballot")
    return (
      <svg {...common}>
        <path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" />
        <rect x="9" y="3" width="6" height="8" rx="1" />
      </svg>
    );
  if (kind === "megaphone")
    return (
      <svg {...common}>
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
