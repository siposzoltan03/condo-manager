import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type {
  BoardDashboardData,
  BoardActivityItem,
  FollowupItem,
  OnboardingChecklist,
} from "@/lib/dashboard-dal";
import type { RegistryStatus } from "@/lib/officer-registry";
import { OfficerRegistryBanner } from "@/components/compliance/officer-registry-banner";
import { AuditCommitteeRequiredBanner } from "@/components/compliance/audit-committee-required-banner";
import { SetupChecklist } from "./setup-checklist";

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
  // Show in compact form: < 100 K → exact; < 1M → "{N}K"; else "{X.XX}M"
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toFixed(2);
  }
  if (Math.abs(n) >= 1_000) {
    return `${Math.round(n / 1_000)}K`;
  }
  return Math.round(n).toString();
}

function formatHUFFull(n: number, locale: string): string {
  return Math.round(n).toLocaleString(intlLocale(locale));
}

function formatRelative(
  iso: string,
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string,
  now = new Date(),
): string {
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return t("now");
  if (diffMin < 60) return t("relative.minutesAgo", { n: diffMin });
  const diffH = Math.round(diffMin / 60);
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
  data: BoardDashboardData;
  followups: FollowupItem[];
  activeBuildingName: string;
  /** Phase 2 + 4 compliance state for the deadline + committee banners.
   *  Computed at the page level so this component stays a pure render. */
  compliance?: {
    registryStatus: RegistryStatus | null;
    requiresAuditCommittee: boolean;
    hasActiveCommittee: boolean;
  };
  /** Onboarding setup progress; rendered only while setup is incomplete. */
  onboarding?: OnboardingChecklist;
}

export async function BoardDashboard({
  locale,
  userName,
  data,
  followups,
  activeBuildingName: _activeBuildingName,
  compliance,
  onboarding,
}: Props) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tCompliance = await getTranslations({ locale, namespace: "compliance" });

  const now = new Date();
  const greeting = t(`greeting.${greetingKeyForHour(now.getHours())}`);
  const firstName = userName.split(" ").pop() ?? userName;
  const dateLabel = now.toLocaleDateString(intlLocale(locale), {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // Cash chart highest column for accent coloring.
  const maxNetAbs = Math.max(...data.cashFlow.map((m) => Math.abs(m.net)), 1);

  // Aggregate alerts shown in the page header subtitle.
  const headerLine = [
    data.kpi.urgentTicketCount > 0
      ? t("headerLine.urgentTickets", { count: data.kpi.urgentTicketCount })
      : null,
    data.activeVote ? t("headerLine.activeVote") : null,
    data.kpi.outstandingUnitsCount > 0
      ? t("headerLine.unitsInArrears", { count: data.kpi.outstandingUnitsCount })
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div style={{ padding: "32px", maxWidth: "1440px", margin: "0 auto" }}>
      {/* ── Compliance banners (Phase 2 + Phase 4) ────────────────────── */}
      {compliance?.registryStatus && (
        <OfficerRegistryBanner
          status={compliance.registryStatus}
          locale={locale}
          copy={{
            title:
              compliance.registryStatus.kind === "overdue"
                ? tCompliance("registry.titleOverdue")
                : tCompliance("registry.titleDueSoon"),
            description:
              compliance.registryStatus.kind === "overdue"
                ? tCompliance("registry.descriptionOverdue", {
                    days: compliance.registryStatus.daysOverdue.toString(),
                  })
                : compliance.registryStatus.kind === "due-soon"
                  ? tCompliance("registry.descriptionDueSoon", {
                      days: compliance.registryStatus.daysLeft.toString(),
                    })
                  : "",
            cta: tCompliance("registry.cta"),
            dismiss: tCompliance("registry.dismiss"),
          }}
        />
      )}
      {compliance && (
        <AuditCommitteeRequiredBanner
          requiresAuditCommittee={compliance.requiresAuditCommittee}
          hasActiveCommittee={compliance.hasActiveCommittee}
          locale={locale}
          copy={{
            title: tCompliance("auditCommittee.title"),
            description: tCompliance("auditCommittee.description"),
            cta: tCompliance("auditCommittee.cta"),
            dismiss: tCompliance("auditCommittee.dismiss"),
          }}
        />
      )}

      {/* ── Onboarding setup checklist (hidden once complete) ──────────── */}
      {onboarding && !onboarding.allComplete && (
        <SetupChecklist locale={locale} checklist={onboarding} />
      )}

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-end gap-8" style={{ marginBottom: "28px" }}>
        <div>
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
            {headerLine && (
              <>
                {" "}
                <b>{headerLine}</b>{" "}
                {data.kpi.outstandingCharges > 0
                  ? t("headerLine.callToAction")
                  : t("headerLine.callToActionToday")}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 transition-colors hover:bg-[var(--color-bg-3)]"
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              background: "var(--color-card)",
            }}
          >
            <CalendarIcon />
            {now.toLocaleDateString(intlLocale(locale), { month: "long" })}
          </button>
        </div>
      </div>

      {/* ── Greeting strip ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-6"
        style={{
          marginBottom: "28px",
          padding: "18px 22px",
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
        }}
      >
        <span
          className="flex-shrink-0"
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "var(--color-moss-2)",
            boxShadow: "0 0 0 4px color-mix(in srgb, var(--color-moss-2) 22%, transparent)",
          }}
        />
        <div
          className="font-mono flex-1"
          style={{
            fontSize: "12px",
            color: "var(--color-ink-soft)",
            letterSpacing: "0.04em",
          }}
        >
          {t("systemStatus")}{" "}
          <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>{t("now")}</b>
        </div>
        <div
          className="font-mono"
          style={{ fontSize: "11px", color: "var(--color-muted)", letterSpacing: "0.06em" }}
        >
          v2026.4
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: "24px" }}>
        <KpiCard
          variant="dark"
          icon="₣"
          label={t("kpiOperatingBalance")}
          value={formatHUF(data.kpi.operatingBalance)}
          unit={Math.abs(data.kpi.operatingBalance) >= 1_000_000 ? "M Ft" : "Ft"}
          sub={t("kpiOperatingSub")}
        />
        <KpiCard
          variant="moss"
          icon="◈"
          label={t("kpiReserveFund")}
          value={formatHUF(data.kpi.reserveBalance)}
          unit={Math.abs(data.kpi.reserveBalance) >= 1_000_000 ? "M Ft" : "Ft"}
          sub={
            data.kpi.reserveTarget > 0
              ? `${t("kpiReserveTarget", {
                  target: (data.kpi.reserveTarget / 1_000_000).toFixed(0),
                })} / ${Math.round(
                  (data.kpi.reserveBalance / data.kpi.reserveTarget) * 100,
                )}%`
              : ""
          }
        />
        <KpiCard
          icon="⚑"
          label={t("kpiOpenTickets")}
          value={String(data.kpi.openTicketCount)}
          unit={t("kpiTicketsUnit")}
          sub={
            data.kpi.urgentTicketCount > 0
              ? `${data.kpi.urgentTicketCount} ${t("kpiUrgent")}`
              : t("kpiAllSteady")
          }
        />
        <KpiCard
          variant="ochre"
          icon="⌥"
          label={t("kpiOutstanding")}
          value={formatHUF(data.kpi.outstandingCharges)}
          unit={Math.abs(data.kpi.outstandingCharges) >= 1_000_000 ? "M Ft" : "Ft"}
          sub={`${data.kpi.outstandingUnitsCount} ${t("kpiUnitsArrears")}`}
        />
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: "24px" }}>
        <QuickAction
          href={`/${locale}/communication`}
          iconBg="var(--color-ink)"
          iconColor="var(--color-bg)"
          label={t("quickAnnouncement")}
          sub={t("quickAnnouncementSub")}
          icon="megaphone"
        />
        <QuickAction
          href={`/${locale}/voting`}
          iconBg="var(--color-moss)"
          iconColor="#f5f2e6"
          label={t("quickNewVote")}
          sub={t("quickNewVoteSub")}
          icon="ballot"
        />
        <QuickAction
          href={`/${locale}/finance`}
          iconBg="var(--color-ochre)"
          iconColor="var(--color-ink)"
          label={t("quickAddInvoice")}
          sub={t("quickAddInvoiceSub")}
          icon="document"
        />
        <QuickAction
          href={`/${locale}/voting/meetings`}
          iconBg="color-mix(in srgb, var(--color-ink) 90%, var(--color-moss))"
          iconColor="var(--color-bg)"
          label={t("quickMeeting")}
          sub={t("quickMeetingSub")}
          icon="calendar"
        />
      </div>

      {/* ── Activity + Tasks (2-col) ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" style={{ marginBottom: "24px" }}>
        <Panel className="lg:col-span-7">
          <PanelHead title={t("recentActivity")} sub={t("recentActivitySub")} link={{ label: t("activityLog"), href: `/${locale}/users` }} />
          <div>
            {data.recentActivity.length === 0 ? (
              <EmptyHint label={t("emptyActivity")} />
            ) : (
              data.recentActivity.map((it) => (
                <ActivityRow key={it.id} item={it} t={t} locale={locale} />
              ))
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHead
            title={t("myTasks")}
            sub={
              followups.length > 0
                ? `${followups.length} ${t("openItems")}`
                : t("emptyTasksSub")
            }
            link={{ label: t("seeAll"), href: `/${locale}/dashboard/tasks` }}
          />
          <div>
            {followups.length === 0 ? (
              <EmptyHint label={t("emptyTasks")} />
            ) : (
              followups.map((f) => <FollowupRow key={f.id} item={f} locale={locale} />)
            )}
          </div>
        </Panel>
      </div>

      {/* ── Vote + Cash + Building summary (3-col) ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ marginBottom: "20px" }}>
        <Panel>
          <PanelHead
            title={t("activeVote")}
            sub={data.activeVote ? `VOTE-${data.activeVote.id.slice(-6).toUpperCase()}` : "—"}
            link={
              data.activeVote
                ? { label: t("open"), href: `/${locale}/voting` }
                : undefined
            }
          />
          <div style={{ padding: "22px" }}>
            {data.activeVote ? (
              <>
                <div
                  className="font-mono"
                  style={{ fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.08em" }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "var(--color-ochre)",
                      display: "inline-block",
                      marginRight: "4px",
                      verticalAlign: "middle",
                    }}
                  />
                  ÉLŐ · NYÍLT
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontSize: "19px",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.2,
                    marginTop: "6px",
                  }}
                >
                  {data.activeVote.title}
                </div>
                <div className="grid gap-1.5" style={{ marginTop: "14px" }}>
                  {data.activeVote.options.map((o) => (
                    <VoteOptionBar key={o.id} label={o.label} percent={o.percent} type={o.type} />
                  ))}
                </div>
                <div
                  className="flex justify-between font-mono"
                  style={{
                    fontSize: "10px",
                    color: "var(--color-muted)",
                    letterSpacing: "0.05em",
                    marginTop: "14px",
                    paddingTop: "12px",
                    borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
                  }}
                >
                  <span>
                    KVÓRUM <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>{data.activeVote.quorumPercent}%</b> /{" "}
                    {data.activeVote.quorumThreshold}%
                  </span>
                  <span>
                    {data.activeVote.daysRemaining >= 0 ? (
                      <>
                        ZÁR <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>{data.activeVote.daysRemaining} NAP</b>
                      </>
                    ) : (
                      <span style={{ color: "var(--color-danger)" }}>LEJÁRT</span>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <EmptyHint label={t("emptyVote")} />
            )}
          </div>
        </Panel>

        <Panel dark>
          <PanelHead
            dark
            title={t("cashFlow")}
            sub={t("cashFlowSub")}
          />
          <div style={{ padding: "22px" }}>
            <div className="grid grid-cols-2 gap-3.5" style={{ marginTop: "8px" }}>
              <CashNum dark label={t("incomeYTD")} value={formatHUF(data.cashFlow_incomeYTD)} unit="M Ft" />
              <CashNum dark label={t("expenseYTD")} value={formatHUF(data.cashFlow_expenseYTD)} unit="M Ft" />
            </div>
            <div
              className="flex items-end gap-1 relative"
              style={{
                height: "90px",
                marginTop: "22px",
                paddingBottom: "18px",
                borderBottom: "1px solid color-mix(in srgb, var(--color-bg) 12%, transparent)",
              }}
            >
              {data.cashFlow.map((m, i) => {
                const hPct = Math.max(8, Math.round((Math.abs(m.net) / maxNetAbs) * 100));
                const isCurrent = i === data.cashFlow.length - 1;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full relative">
                    <div
                      style={{
                        width: "100%",
                        height: `${hPct}%`,
                        background: isCurrent
                          ? "var(--color-ochre)"
                          : "color-mix(in srgb, var(--color-bg) 22%, transparent)",
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                    <span
                      className="font-mono absolute"
                      style={{
                        bottom: 0,
                        fontSize: "9px",
                        color: "color-mix(in srgb, var(--color-bg) 50%, transparent)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              className="flex gap-4 font-mono"
              style={{
                fontSize: "10px",
                color: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
                letterSpacing: "0.05em",
                marginTop: "14px",
              }}
            >
              <span>
                <span
                  className="inline-block"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    background: "var(--color-ochre)",
                    marginRight: "6px",
                    verticalAlign: "middle",
                  }}
                />
                AKTUÁLIS HÓ
              </span>
              <span>
                <span
                  className="inline-block"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    background: "color-mix(in srgb, var(--color-bg) 22%, transparent)",
                    marginRight: "6px",
                    verticalAlign: "middle",
                  }}
                />
                ELŐZŐ HÓNAPOK
              </span>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t("buildingNow")} sub={t("buildingNowSub")} link={{ label: t("details"), href: `/${locale}/units` }} />
          <div style={{ padding: "22px" }}>
            <SummaryRow label={t("totalUnits")} value={String(data.summary.totalUnits)} />
            <SummaryRow
              label={t("activeResidents")}
              value={String(data.summary.totalUsers)}
            />
            <SummaryRow
              label={t("ownershipRecorded")}
              value={`${Math.round(data.summary.ownershipShareRecorded * 100)}%`}
            />
            <SummaryRow
              label={t("paymentRate")}
              value={`${Math.round(data.summary.paymentRate * 100)}%`}
            />
            <SummaryRow
              label={t("arrearsUnits")}
              value={String(data.summary.arrearsUnits)}
              warn={data.summary.arrearsUnits > 0}
            />
            <SummaryRow
              label={t("nextMeeting")}
              value={
                data.summary.nextMeetingDate
                  ? new Date(data.summary.nextMeetingDate)
                      .toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric" })
                      .toUpperCase()
                  : "—"
              }
            />
          </div>
        </Panel>
      </div>

      {/* ── People row (3-col) ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel>
          <PanelHead
            title={t("boardMembers")}
            sub={`${data.boardMembers.length} ${t("boardMembersSub")}`}
            link={{ label: t("message"), href: `/${locale}/communication` }}
          />
          <div style={{ padding: "22px" }}>
            {data.boardMembers.length === 0 ? (
              <EmptyHint label={t("emptyBoard")} />
            ) : (
              data.boardMembers.map((p, i) => (
                <PersonRow key={p.id} colorIndex={i} name={p.name} sub={p.unitLabel ?? "—"} role={p.isChair ? "ELNÖK" : "TAG"} last={i === data.boardMembers.length - 1} />
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t("todaysMeetings")} sub={`${data.todaysMeetings.length} ${t("itemsCount")}`} />
          <div style={{ padding: "22px" }}>
            {data.todaysMeetings.length === 0 ? (
              <EmptyHint label={t("emptyMeetings")} />
            ) : (
              data.todaysMeetings.map((m, i) => (
                <PersonRow
                  key={m.id}
                  colorIndex={(i + 3) % 4}
                  name={m.title}
                  sub={`${new Date(m.startsAt).toLocaleTimeString(intlLocale(locale), {
                    hour: "2-digit",
                    minute: "2-digit",
                  })} · ${m.location ?? "—"}`}
                  role="MA"
                  last={i === data.todaysMeetings.length - 1}
                  iconLabel="📅"
                />
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title={t("contractors")}
            sub={t("contractorsSub")}
            link={{ label: t("directory"), href: `/${locale}/maintenance/contractors` }}
          />
          <div style={{ padding: "22px" }}>
            {data.contractors.length === 0 ? (
              <EmptyHint label={t("emptyContractors")} />
            ) : (
              data.contractors.slice(0, 3).map((c, i) => (
                <PersonRow
                  key={c.id}
                  colorIndex={(i + 2) % 4}
                  name={c.name}
                  sub={`${c.specialty}${
                    c.averageRating ? ` · ⭐ ${c.averageRating.toFixed(1)}` : ""
                  }${c.totalJobs ? ` / ${c.totalJobs} MUNKA` : ""}`}
                  role={c.totalJobs > 0 ? "AKTÍV" : "SZERZ"}
                  last={i === Math.min(2, data.contractors.length - 1)}
                />
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function Panel({
  children,
  className,
  dark,
}: {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden ${className ?? ""}`}
      style={{
        background: dark ? "var(--color-ink)" : "var(--color-card)",
        color: dark ? "var(--color-bg)" : undefined,
        border: `1px solid ${dark ? "var(--color-ink)" : "color-mix(in srgb, var(--color-ink) 10%, transparent)"}`,
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
  dark,
}: {
  title: string;
  sub?: string;
  link?: { label: string; href: string };
  dark?: boolean;
}) {
  return (
    <div
      className="flex justify-between items-center"
      style={{
        padding: "18px 22px",
        borderBottom: `1px solid ${dark ? "color-mix(in srgb, var(--color-bg) 12%, transparent)" : "color-mix(in srgb, var(--color-ink) 6%, transparent)"}`,
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
              color: dark ? "color-mix(in srgb, var(--color-bg) 55%, transparent)" : "var(--color-muted)",
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
            color: dark
              ? "color-mix(in srgb, var(--color-bg) 75%, transparent)"
              : "var(--color-ink-soft)",
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
      : variant === "ochre"
        ? "var(--color-ink)"
        : "var(--color-ink)";
  const subColor =
    variant === "dark" || variant === "moss"
      ? "color-mix(in srgb, #f5f2e6 78%, transparent)"
      : variant === "ochre"
        ? "color-mix(in srgb, var(--color-ink) 80%, transparent)"
        : "var(--color-ink-soft)";
  const labelColor =
    variant
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
          fontSize: "42px",
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
              fontSize: "18px",
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

function CashNum({
  label,
  value,
  unit,
  dark,
}: {
  label: string;
  value: string;
  unit: string;
  dark?: boolean;
}) {
  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: dark
            ? "color-mix(in srgb, var(--color-bg) 60%, transparent)"
            : "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "28px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1,
        }}
      >
        {value}
        <small
          style={{
            fontSize: "13px",
            color: dark
              ? "color-mix(in srgb, var(--color-bg) 60%, transparent)"
              : "var(--color-muted)",
            marginLeft: "4px",
            fontWeight: 400,
          }}
        >
          {unit}
        </small>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className="flex justify-between"
      style={{
        padding: "11px 0",
        borderBottom: "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
        fontSize: "13px",
      }}
    >
      <span style={{ color: "var(--color-ink-soft)" }}>{label}</span>
      <span
        className="font-mono"
        style={{
          fontWeight: 600,
          color: warn ? "var(--color-ochre)" : "var(--color-ink)",
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function VoteOptionBar({ label, percent, type }: { label: string; percent: number; type: "y" | "n" | "a" | "x" }) {
  const color =
    type === "y"
      ? "color-mix(in srgb, var(--color-moss-2) 18%, transparent)"
      : type === "n"
        ? "color-mix(in srgb, var(--color-danger) 14%, transparent)"
        : type === "a"
          ? "color-mix(in srgb, var(--color-ink) 10%, transparent)"
          : "color-mix(in srgb, var(--color-moss) 12%, transparent)";
  return (
    <div
      className="grid items-center relative overflow-hidden"
      style={{
        gridTemplateColumns: "1fr auto",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        background: "var(--color-bg-3)",
        fontSize: "12.5px",
        fontWeight: 500,
      }}
    >
      <span
        className="absolute"
        aria-hidden
        style={{
          inset: 0,
          background: color,
          width: `${percent}%`,
          transformOrigin: "left",
        }}
      />
      <span style={{ position: "relative" }}>{label}</span>
      <span className="font-mono" style={{ position: "relative", fontWeight: 600 }}>
        {percent}%
      </span>
    </div>
  );
}

function ActivityRow({
  item,
  t,
  locale,
}: {
  item: BoardActivityItem;
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
}) {
  const iconBg =
    item.severity === "danger"
      ? "var(--color-danger-soft)"
      : item.severity === "warn"
        ? "color-mix(in srgb, var(--color-ochre) 32%, transparent)"
        : item.kind === "voting"
          ? "color-mix(in srgb, var(--color-ink) 90%, transparent)"
          : item.kind === "finance"
            ? "color-mix(in srgb, var(--color-moss) 18%, transparent)"
            : "color-mix(in srgb, var(--color-ink) 6%, transparent)";
  const iconColor =
    item.severity === "danger"
      ? "var(--color-danger)"
      : item.severity === "warn"
        ? "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))"
        : item.kind === "voting"
          ? "var(--color-bg)"
          : item.kind === "finance"
            ? "var(--color-moss)"
            : "var(--color-ink-soft)";

  return (
    <div
      className="grid gap-3.5 items-start cursor-pointer hover:bg-[var(--color-bg-3)] transition-colors"
      style={{
        gridTemplateColumns: "36px 1fr auto",
        padding: "14px 22px",
        borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <div
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "9px",
          background: iconBg,
          color: iconColor,
        }}
      >
        <ActivityIcon kind={item.kind} />
      </div>
      <div className="min-w-0">
        <strong
          style={{ display: "block", fontWeight: 600, fontSize: "13.5px", letterSpacing: "-0.005em" }}
        >
          {item.title}
        </strong>
        {item.body && (
          <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--color-ink-soft)", lineHeight: 1.4 }}>
            {item.body}
          </p>
        )}
        {item.tag && (
          <span
            className="inline-flex items-center font-mono"
            style={{
              gap: "5px",
              marginTop: "6px",
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              padding: "2px 7px",
              borderRadius: "4px",
              background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          >
            {item.tag}
          </span>
        )}
      </div>
      <div
        className="font-mono whitespace-nowrap"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
          paddingTop: "4px",
        }}
      >
        {formatRelative(item.occurredAt, t, locale)}
      </div>
    </div>
  );
}

function FollowupRow({ item, locale }: { item: FollowupItem; locale: string }) {
  const pillBg =
    item.pill === "due"
      ? "var(--color-danger-soft)"
      : item.pill === "soon"
        ? "color-mix(in srgb, var(--color-ochre) 30%, transparent)"
        : item.pill === "ok"
          ? "var(--color-good-soft)"
          : "color-mix(in srgb, var(--color-ink) 8%, transparent)";
  const pillColor =
    item.pill === "due"
      ? "var(--color-danger)"
      : item.pill === "soon"
        ? "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))"
        : item.pill === "ok"
          ? "var(--color-good)"
          : "var(--color-ink-soft)";
  const Wrapper = item.href ? Link : "div";

  return (
    <Wrapper
      href={item.href ? `/${locale}${item.href}` : "#"}
      className="grid items-start cursor-pointer hover:bg-[var(--color-bg-3)] transition-colors"
      style={{
        gridTemplateColumns: "22px 1fr auto",
        gap: "14px",
        padding: "14px 22px",
        borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "5px",
          border: "1.5px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          marginTop: "2px",
        }}
      />
      <div>
        <strong style={{ display: "block", fontWeight: 600, fontSize: "13.5px", letterSpacing: "-0.005em" }}>
          {item.title}
        </strong>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            marginTop: "3px",
          }}
        >
          {item.meta}
        </div>
      </div>
      <span
        className="font-mono self-center whitespace-nowrap"
        style={{
          fontSize: "10px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "3px 8px",
          borderRadius: "4px",
          fontWeight: 600,
          background: pillBg,
          color: pillColor,
        }}
      >
        {item.pillText}
      </span>
    </Wrapper>
  );
}

function PersonRow({
  colorIndex,
  name,
  sub,
  role,
  last,
  iconLabel,
}: {
  colorIndex: number;
  name: string;
  sub: string;
  role: string;
  last: boolean;
  iconLabel?: string;
}) {
  const palette = [
    { bg: "var(--color-ochre)", color: "var(--color-ink)" },
    { bg: "var(--color-moss)", color: "#f5f2e6" },
    { bg: "color-mix(in srgb, var(--color-ink) 80%, var(--color-ochre))", color: "var(--color-bg)" },
    { bg: "color-mix(in srgb, var(--color-moss-2) 80%, transparent)", color: "var(--color-ink)" },
  ];
  const av = palette[colorIndex % palette.length];
  const initials = iconLabel
    ? iconLabel
    : name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: "36px 1fr auto",
        gap: "12px",
        padding: "10px 0",
        borderBottom: last ? "none" : "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <span
        className="grid place-items-center"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: av.bg,
          color: av.color,
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 500,
          fontSize: "13px",
        }}
      >
        {initials}
      </span>
      <div>
        <strong style={{ display: "block", fontWeight: 600, fontSize: "13px", letterSpacing: "-0.005em" }}>
          {name}
        </strong>
        <small
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.04em" }}
        >
          {sub}
        </small>
      </div>
      <span
        className="font-mono"
        style={{
          fontSize: "10px",
          padding: "3px 7px",
          borderRadius: "4px",
          background: "color-mix(in srgb, var(--color-ink) 7%, transparent)",
          color: "var(--color-ink-soft)",
          letterSpacing: "0.05em",
          fontWeight: 600,
        }}
      >
        {role}
      </span>
    </div>
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
  icon: "megaphone" | "ballot" | "document" | "calendar";
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
        <QuickIcon kind={icon} />
      </div>
      <div>
        <strong style={{ display: "block", fontWeight: 600, fontSize: "14px", letterSpacing: "-0.01em" }}>
          {label}
        </strong>
        <small
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.05em", display: "block", marginTop: "2px" }}
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

// ─── Inline icons ─────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ActivityIcon({ kind }: { kind: BoardActivityItem["kind"] }) {
  const common = { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true } as const;
  if (kind === "finance") return <svg {...common}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
  if (kind === "voting") return <svg {...common}><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" /><rect x="9" y="3" width="6" height="8" rx="1" /></svg>;
  if (kind === "maintenance") return <svg {...common}><path d="M14 2l6 6-11 11H3v-6z" /></svg>;
  if (kind === "documents") return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
  if (kind === "communication") return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
}

function QuickIcon({ kind }: { kind: "megaphone" | "ballot" | "document" | "calendar" }) {
  const common = { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true } as const;
  if (kind === "megaphone") return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
  if (kind === "ballot") return <svg {...common}><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" /><rect x="9" y="3" width="6" height="8" rx="1" /></svg>;
  if (kind === "document") return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
  return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}
