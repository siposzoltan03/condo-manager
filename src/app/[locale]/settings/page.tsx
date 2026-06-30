import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProfileOverview } from "@/lib/profile-dal";
import type { ProfileOverviewData } from "@/lib/profile-dal";
import { ProfileHero } from "@/components/settings/profile-hero";
import { NotificationMatrixView } from "@/components/settings/notification-matrix";
import { DangerZone } from "@/components/settings/danger-zone";
import { PersonalDataLauncher } from "@/components/settings/personal-data-launcher";
import { TwoFactorLauncher } from "@/components/settings/two-factor-launcher";
import { ChangePasswordLauncher } from "@/components/settings/change-password-launcher";
import { SessionsTable } from "@/components/settings/sessions-table";
import { AuditSlicePdfButton } from "@/components/reports/audit-slice-pdf-button";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile.shell" });
  return { title: t("title") };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getProfileOverview();
  const t = await getTranslations({ locale, namespace: "profile" });

  const isBoardMember =
    data.role === "BOARD_MEMBER" ||
    data.role === "ADMIN" ||
    data.role === "SUPER_ADMIN";
  const isAdmin = data.role === "ADMIN" || data.role === "SUPER_ADMIN";
  const tAdmin = await getTranslations({ locale, namespace: "admin" });

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 0 80px" }}>
      <ProfileHero locale={locale} data={data} />

      {/* Sticky tab rail (anchor-jump) */}
      <TabRail locale={locale} />

      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] items-start"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "32px 16px 0",
          gap: "28px",
        }}
      >
        {/* LEFT */}
        <div>
          {/* Személyes adatok */}
          <Section
            id="personal"
            title={t("personal.title")}
            desc={t("personal.desc")}
            edit={<PersonalDataLauncher initial={{
              phone: data.user.phone,
              secondaryEmail: data.user.secondaryEmail,
              birthDate: data.user.birthDate,
              permanentAddress: data.user.permanentAddress,
              mailingAddress: data.user.mailingAddress,
            }} />}
          >
            <div
              className="grid grid-cols-1 sm:grid-cols-2"
              style={{ gap: "16px 20px" }}
            >
              <ROField label={t("personal.fieldName")} value={data.user.name} />
              <ROField
                label={t("personal.fieldEmail")}
                value={data.user.email}
                badge={
                  data.user.emailVerifiedAt
                    ? { text: t("personal.verified"), tone: "ok" }
                    : { text: t("personal.unverified"), tone: "warn" }
                }
              />
              <ROField
                label={t("personal.fieldPhone")}
                value={data.user.phone ?? "—"}
              />
              <ROField
                label={t("personal.fieldSecondaryEmail")}
                value={data.user.secondaryEmail ?? "—"}
                badge={
                  !data.user.secondaryEmail
                    ? undefined
                    : data.user.secondaryEmailVerifiedAt
                      ? { text: t("personal.verified"), tone: "ok" }
                      : { text: t("personal.unverified"), tone: "warn" }
                }
              />
              <ROField
                label={t("personal.fieldBirthDate")}
                value={
                  data.user.birthDate
                    ? new Date(data.user.birthDate).toLocaleDateString("hu-HU")
                    : "—"
                }
              />
              <ROField
                label={t("personal.fieldLanguage")}
                value={data.user.language === "hu" ? "Magyar" : "English"}
              />
              <ROField
                full
                label={t("personal.fieldPermanentAddress")}
                value={data.user.permanentAddress ?? "—"}
              />
              <ROField
                full
                label={t("personal.fieldMailingAddress")}
                value={data.user.mailingAddress ?? t("personal.sameAsPermanent")}
              />
            </div>
          </Section>

          {/* Notifications */}
          <Section
            id="notifications"
            title={t("notifications.title")}
            desc={t("notifications.desc")}
          >
            <NotificationMatrixView
              initial={data.notifications}
              initialQuietHoursStart={data.quietHoursStart}
              initialQuietHoursEnd={data.quietHoursEnd}
            />
          </Section>

          {/* Units */}
          {data.units.length > 0 && (
            <Section
              id="units"
              title={t("units.title")}
              desc={t("units.desc")}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "12px",
                }}
              >
                {data.units.map((u) => (
                  <UnitCard
                    key={u.id}
                    unit={u}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Security */}
          <Section
            id="security"
            title={t("security.title")}
            desc={t("security.desc")}
          >
            <SecurityRow
              icon="lock"
              title={t("security.passwordTitle")}
              detail={t("security.passwordDetail")}
              right={<ChangePasswordLauncher />}
            />
            <SecurityRow
              icon="phone"
              title={t("security.twoFaTitle")}
              detail={
                data.twoFactorEnabled
                  ? t("security.twoFaActive")
                  : t("security.twoFaInactive")
              }
              right={
                <div className="flex items-center gap-2">
                  {data.twoFactorEnabled && (
                    <Pill tone="ok">{t("security.allOn")}</Pill>
                  )}
                  <TwoFactorLauncher enrolled={data.twoFactorEnabled} />
                </div>
              }
            />
            <SecurityRow
              icon="mail"
              title={t("security.emailNotifTitle")}
              detail={t("security.emailNotifDetail")}
              right={<Pill tone="ok">{t("security.allOn")}</Pill>}
            />
            <SecurityRow
              icon="clock"
              title={t("security.idleTitle")}
              detail={t("security.idleDetail")}
              right={<Pill tone="warn">{t("security.consider")}</Pill>}
            />
            <SessionsTable sessions={data.sessions} />
          </Section>

          {/* Audit-log export — admin-only */}
          {isAdmin && (
            <Section id="audit-export" title={tAdmin("auditExportTitle")}>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--color-ink-soft)",
                  lineHeight: 1.55,
                  marginBottom: "14px",
                }}
              >
                {tAdmin("auditExportDescription")}
              </p>
              <AuditSlicePdfButton />
            </Section>
          )}

          {/* Permissions */}
          {isBoardMember && (
            <Section
              id="permissions"
              title={t("permissions.title")}
              desc={
                data.mandateEndISO
                  ? t("permissions.descMandate", {
                      end: new Date(data.mandateEndISO).toLocaleDateString(
                        "hu-HU",
                      ),
                    })
                  : t("permissions.desc")
              }
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "8px",
                }}
              >
                {data.permissions.map((p) => (
                  <PermissionTile
                    key={p.id}
                    permission={p}
                    label={t(p.labelKey, { defaultMessage: p.key })}
                    description={
                      p.descriptionKey
                        ? t(p.descriptionKey, { defaultMessage: "" })
                        : ""
                    }
                  />
                ))}
              </div>
            </Section>
          )}

          <DangerZone
            isBoardMember={isBoardMember}
            pendingResignation={data.pendingResignation}
          />
        </div>

        {/* RIGHT RAIL */}
        <div style={{ position: "sticky", top: "100px" }}>
          <Section title={t("health.title")}>
            <HealthRing pct={data.health.pct} t={t} />
            <div className="flex flex-col gap-2" style={{ marginTop: "12px" }}>
              {data.health.checks.map((c) => (
                <CheckItem
                  key={c.key}
                  state={c.state}
                  label={t(`health.check.${c.key}`)}
                />
              ))}
            </div>
            <Tenure days={data.user.tenureDays} buildingName={data.buildingName} t={t} />
          </Section>

          {isBoardMember && (
            <Section title={t("activeRole.title")}>
              <div
                style={{
                  background: "var(--color-ink)",
                  color: "var(--color-bg)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                }}
              >
                <div
                  className="font-mono"
                  style={{
                    fontSize: "10px",
                    color: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {t(`role.${data.role}`)}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontSize: "16px",
                    fontWeight: 600,
                    letterSpacing: "-0.015em",
                    marginTop: "4px",
                  }}
                >
                  {data.buildingName}
                </div>
                {data.mandateStartISO && data.mandateEndISO && (
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
                      letterSpacing: "0.04em",
                      marginTop: "6px",
                    }}
                  >
                    {t("activeRole.mandate", {
                      start: new Date(
                        data.mandateStartISO,
                      ).toLocaleDateString("hu-HU", {
                        year: "numeric",
                        month: "2-digit",
                      }),
                      end: new Date(data.mandateEndISO).toLocaleDateString(
                        "hu-HU",
                        { year: "numeric", month: "2-digit" },
                      ),
                    })}
                  </div>
                )}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.03em",
                  padding: "8px 2px 0",
                }}
              >
                {t("activeRole.summary", {
                  board: data.buildingBoardSize.toString(),
                  units: data.buildingUnitCount.toString(),
                  residents: data.buildingResidentCount.toString(),
                })}
              </div>
            </Section>
          )}

          <Section title={t("quick.title")}>
            <div className="flex flex-col gap-1.5">
              <QuickAction label={t("quick.gdpr")} disabled />
              <QuickAction label={t("quick.payments")} disabled />
              <QuickAction label={t("quick.calendar")} disabled />
              <QuickAction label={t("quick.integrations")} disabled />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─── Server-rendered building blocks ──────────────────────────────────────

async function TabRail({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "profile" });
  const tabs = [
    { id: "overview", label: t("tab.overview"), on: true },
    { id: "personal", label: t("tab.personal") },
    { id: "notifications", label: t("tab.notifications") },
    { id: "units", label: t("tab.units") },
    { id: "security", label: t("tab.security") },
    { id: "permissions", label: t("tab.permissions") },
    { id: "danger", label: t("tab.danger") },
  ];
  return (
    <div
      style={{
        background: "var(--color-bg)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        position: "sticky",
        top: "67px",
        zIndex: 8,
        marginTop: "-20px",
      }}
    >
      <div
        className="flex gap-0.5"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 48px",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            style={{
              padding: "14px 16px",
              fontSize: "13.5px",
              fontWeight: tab.on ? 600 : 500,
              color: tab.on ? "var(--color-ink)" : "var(--color-ink-soft)",
              borderBottom: tab.on
                ? "2px solid var(--color-ink)"
                : "2px solid transparent",
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  desc,
  edit,
  children,
}: {
  id?: string;
  title: string;
  desc?: string;
  edit?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "24px 26px",
        marginBottom: "18px",
        scrollMarginTop: "120px",
      }}
    >
      <div
        className="flex justify-between items-center gap-3"
        style={{ marginBottom: desc ? "4px" : "12px" }}
      >
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "20px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        {edit}
      </div>
      {desc && (
        <p
          style={{
            color: "var(--color-muted)",
            fontSize: "12.5px",
            marginBottom: "18px",
          }}
        >
          {desc}
        </p>
      )}
      {children}
    </div>
  );
}

function ROField({
  label,
  value,
  badge,
  full,
}: {
  label: string;
  value: string;
  badge?: { text: string; tone: "ok" | "warn" };
  full?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1.5"
      style={{ gridColumn: full ? "1 / -1" : undefined }}
    >
      <label
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-2"
        style={{
          background: "var(--color-bg-3)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          borderRadius: "7px",
          padding: "9px 12px",
          fontSize: "14px",
          color: "var(--color-ink-soft)",
          fontWeight: 500,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {value}
        </span>
        {badge && (
          <span
            className="font-mono"
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "3px",
              letterSpacing: "0.06em",
              fontWeight: 700,
              textTransform: "uppercase",
              background:
                badge.tone === "ok"
                  ? "var(--color-good-soft)"
                  : "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
              color:
                badge.tone === "ok"
                  ? "var(--color-good)"
                  : "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
              flexShrink: 0,
            }}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

function UnitCard({
  unit,
  locale,
  t,
}: {
  unit: ProfileOverviewData["units"][number];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const isPrime = unit.isPrimary;
  const stairwellLabel = unit.stairwell ? `${unit.stairwell} · ` : "";
  return (
    <div
      style={{
        background: isPrime ? "var(--color-ink)" : "var(--color-bg-3)",
        color: isPrime ? "var(--color-bg)" : "var(--color-ink)",
        border: isPrime
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        className="flex items-baseline gap-2"
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "28px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
        }}
      >
        {stairwellLabel}
        {unit.number}
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: isPrime
              ? "color-mix(in srgb, var(--color-bg) 60%, transparent)"
              : "var(--color-muted)",
            letterSpacing: "0.06em",
            fontWeight: 500,
          }}
        >
          {unit.kind === "primary"
            ? t("units.primary")
            : unit.kind === "investment"
              ? t("units.investment")
              : t("units.secondary")}
        </span>
      </div>
      <span
        className="font-mono inline-block self-start"
        style={{
          fontSize: "9px",
          padding: "2px 7px",
          borderRadius: "3px",
          background: unit.tenantName
            ? "color-mix(in srgb, var(--color-ochre) 25%, transparent)"
            : "color-mix(in srgb, var(--color-moss-2) 25%, transparent)",
          color: unit.tenantName
            ? "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))"
            : "var(--color-moss)",
          letterSpacing: "0.06em",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {unit.tenantName ? t("units.rentedOut") : t("units.selfUse")}
      </span>
      <div
        className="grid grid-cols-2"
        style={{ gap: "10px 16px", fontSize: "12.5px" }}
      >
        <UnitFact
          label={t("units.area")}
          value={`${Math.round(unit.size)} m²`}
          dark={isPrime}
        />
        <UnitFact
          label={t("units.share")}
          value={`${Math.round(unit.ownershipShare * 10000)} / 10 000`}
          dark={isPrime}
        />
        <UnitFact
          label={t("units.monthlyCost")}
          value={
            unit.monthlyChargeFt
              ? `${unit.monthlyChargeFt.toLocaleString("hu-HU")} Ft`
              : "—"
          }
          dark={isPrime}
        />
        <UnitFact
          label={unit.tenantName ? t("units.tenant") : t("units.household")}
          value={unit.tenantName ?? `${unit.occupantCount} fő`}
          dark={isPrime}
        />
      </div>
      <a
        href={`/${locale}/units?unit=${unit.id}`}
        className="font-mono"
        style={{
          fontSize: "11px",
          letterSpacing: "0.04em",
          color: isPrime ? "var(--color-ochre)" : "var(--color-blue, #3a5a78)",
          fontWeight: 600,
          textDecoration: "underline",
          textDecorationColor: isPrime
            ? "color-mix(in srgb, var(--color-ochre) 40%, transparent)"
            : "color-mix(in srgb, #3a5a78 40%, transparent)",
        }}
      >
        {t("units.detailsCta")}
      </a>
    </div>
  );
}

function UnitFact({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark: boolean;
}) {
  return (
    <div>
      <span
        className="font-mono block"
        style={{
          fontSize: "10px",
          color: dark
            ? "color-mix(in srgb, var(--color-bg) 55%, transparent)"
            : "var(--color-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 500,
          fontSize: "14px",
          letterSpacing: "-0.01em",
          marginTop: "2px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SecurityRow({
  icon,
  title,
  detail,
  right,
}: {
  icon: "lock" | "phone" | "mail" | "clock";
  title: string;
  detail: string;
  right: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3.5"
      style={{
        padding: "14px 0",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <span
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "9px",
          background: "var(--color-bg-3)",
          color: "var(--color-ink-soft)",
        }}
      >
        <Icon name={icon} />
      </span>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.03em",
            marginTop: "2px",
          }}
        >
          {detail}
        </div>
      </div>
      {right}
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  const styles = {
    ok: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    warn: {
      bg: "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    },
  }[tone];
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "4px",
        background: styles.bg,
        color: styles.color,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function PermissionTile({
  permission,
  label,
  description,
}: {
  permission: { granted: boolean };
  label: string;
  description: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5"
      style={{
        padding: "10px 12px",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        borderRadius: "8px",
        fontSize: "12.5px",
      }}
    >
      <span
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "4px",
          background: permission.granted ? "var(--color-ink)" : "transparent",
          border: permission.granted
            ? "1.5px solid var(--color-ink)"
            : "1.5px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
          color: "var(--color-bg)",
          fontSize: "10px",
          fontWeight: 700,
        }}
      >
        {permission.granted ? "✓" : ""}
      </span>
      <div className="min-w-0">
        <div style={{ fontWeight: 500 }}>{label}</div>
        {description && (
          <div
            className="font-mono"
            style={{
              fontSize: "9px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              marginTop: "1px",
              fontWeight: 400,
              textTransform: "uppercase",
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthRing({
  pct,
  t,
}: {
  pct: number;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        paddingBottom: "16px",
        marginBottom: "8px",
        borderBottom:
          "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <span
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "58px",
          height: "58px",
          borderRadius: "50%",
          background: `conic-gradient(var(--color-moss-2) 0 ${pct}%, var(--color-bg-3) ${pct}% 100%)`,
        }}
      >
        <span
          className="grid place-items-center"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "var(--color-card)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "15px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {pct}%
        </span>
      </span>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600 }}>
          {pct >= 80
            ? t("health.statusGood")
            : pct >= 50
              ? t("health.statusOk")
              : t("health.statusLow")}
        </div>
      </div>
    </div>
  );
}

function CheckItem({
  state,
  label,
}: {
  state: "ok" | "warn" | "todo";
  label: string;
}) {
  const styles = {
    ok: { bg: "var(--color-good-soft)", color: "var(--color-good)", icon: "✓" },
    warn: {
      bg: "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 85%, var(--color-ink))",
      icon: "!",
    },
    todo: {
      bg: "var(--color-bg-3)",
      color: "var(--color-muted)",
      icon: "○",
    },
  }[state];
  return (
    <div className="flex items-center gap-2.5" style={{ fontSize: "12.5px" }}>
      <span
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: styles.bg,
          color: styles.color,
          fontSize: "10px",
          fontWeight: 700,
          border:
            state === "todo"
              ? "1.5px dashed color-mix(in srgb, var(--color-ink) 12%, transparent)"
              : "0",
        }}
      >
        {styles.icon}
      </span>
      <span style={{ color: state === "todo" ? "var(--color-muted)" : "var(--color-ink-soft)" }}>
        {label}
      </span>
    </div>
  );
}

function Tenure({
  days,
  buildingName,
  t,
}: {
  days: number;
  buildingName: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const label = years > 0
    ? t("health.tenureYearsMonths", { years: years.toString(), months: months.toString() })
    : t("health.tenureMonths", { months: Math.max(1, months).toString() });
  return (
    <div
      className="font-mono"
      style={{
        background: "var(--color-bg-3)",
        borderRadius: "8px",
        padding: "12px 14px",
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginTop: "10px",
      }}
    >
      <b
        style={{
          display: "block",
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "20px",
          color: "var(--color-ink)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          textTransform: "none",
          marginBottom: "2px",
        }}
      >
        {label}
      </b>
      {t("health.tenureSuffix", { building: buildingName })}
    </div>
  );
}

function QuickAction({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex justify-between transition-opacity hover:opacity-80 disabled:opacity-50"
      style={{
        padding: "9px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        background: "var(--color-card)",
        color: "var(--color-ink)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
      }}
    >
      <span>{label}</span>
      <span style={{ color: "var(--color-muted)" }}>›</span>
    </button>
  );
}

function Icon({ name }: { name: "lock" | "phone" | "mail" | "clock" }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    "aria-hidden": true,
  };
  switch (name) {
    case "lock":
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <path d="M22 6l-10 7L2 6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
  }
}
