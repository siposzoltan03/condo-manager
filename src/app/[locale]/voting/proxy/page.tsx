import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getVotingOverview, getProxyOverview } from "@/lib/voting-dal";
import type { ProxyAssignmentItem } from "@/lib/voting-dal";
import { VotingShell } from "@/components/voting/voting-shell";
import { GrantProxyForm } from "@/components/voting/grant-proxy-form";
import { RevokeProxyButton } from "@/components/voting/revoke-proxy-button";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "voting.shell" });
  return { title: `${t("title")} · ${t("tab.proxy")}` };
}

export default async function VotingProxyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [overview, proxyData] = await Promise.all([
    getVotingOverview(),
    getProxyOverview(),
  ]);
  const t = await getTranslations({ locale, namespace: "voting" });

  const activeOutgoing = proxyData.outgoing.filter((p) => p.status === "active");
  const activeIncoming = proxyData.incoming.filter((p) => p.status === "active");

  return (
    <VotingShell
      locale={locale}
      active="proxy"
      counts={{
        active: overview.totalOpenCount,
        meetings: overview.totalMeetingCount,
        history: overview.totalHistoryCount,
      }}
      titleKey="voting.proxy.title"
      ledeKey="voting.proxy.lede"
    >
      {/* Legal notice */}
      <div
        style={{
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ochre) 40%, transparent)",
          borderRadius: "12px",
          padding: "14px 16px",
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
            color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
            marginTop: "2px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </span>
        <div>
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "-0.015em",
              marginBottom: "2px",
            }}
          >
            {t("proxy.noticeTitle")}
          </div>
          <p
            style={{
              fontSize: "12.5px",
              color: "var(--color-ink-soft)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {t("proxy.noticeBody")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        {/* MAIN: outgoing + incoming */}
        <div>
          <ProxySection
            title={t("proxy.outgoingTitle")}
            subtitle={t("proxy.outgoingSubtitle", {
              active: activeOutgoing.length.toString(),
            })}
            empty={t("proxy.outgoingEmpty")}
            items={proxyData.outgoing}
            locale={locale}
            isOutgoing
          />

          <div style={{ marginTop: "32px" }}>
            <ProxySection
              title={t("proxy.incomingTitle")}
              subtitle={t("proxy.incomingSubtitle", {
                active: activeIncoming.length.toString(),
              })}
              empty={t("proxy.incomingEmpty")}
              items={proxyData.incoming}
              locale={locale}
            />
          </div>
        </div>

        {/* SIDEBAR: grant form */}
        <aside>
          <div
            style={{
              background: "var(--color-card)",
              border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              borderRadius: "14px",
              padding: "20px",
              position: "sticky",
              top: "24px",
            }}
          >
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
                {t("proxy.grantEyebrow")}
              </span>
              <h3
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: "18px",
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  marginTop: "4px",
                }}
              >
                {t("proxy.grantTitle")}
              </h3>
              {proxyData.isOwner && proxyData.userOwnershipShare > 0 && (
                <div
                  className="font-mono"
                  style={{
                    fontSize: "10px",
                    color: "var(--color-ink-soft)",
                    marginTop: "4px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t("proxy.yourShare", {
                    pct: (proxyData.userOwnershipShare * 100).toFixed(2),
                  })}
                </div>
              )}
            </div>

            <GrantProxyForm
              candidates={proxyData.candidates}
              openVotes={proxyData.openVotes}
              nextMeeting={proxyData.nextMeeting}
              isOwner={proxyData.isOwner}
            />
          </div>
        </aside>
      </div>
    </VotingShell>
  );
}

async function ProxySection({
  title,
  subtitle,
  empty,
  items,
  locale,
  isOutgoing = false,
}: {
  title: string;
  subtitle: string;
  empty: string;
  items: ProxyAssignmentItem[];
  locale: string;
  isOutgoing?: boolean;
}) {
  return (
    <section>
      <div style={{ marginBottom: "12px" }}>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "20px",
            fontWeight: 500,
            letterSpacing: "-0.025em",
          }}
        >
          {title}
        </h2>
        <p
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            margin: "4px 0 0",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </p>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            background: "var(--color-card)",
            border: "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "13px",
          }}
        >
          {empty}
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "10px" }}>
          {items.map((p) => (
            <ProxyRow key={p.id} item={p} locale={locale} canRevoke={isOutgoing} />
          ))}
        </ul>
      )}
    </section>
  );
}

async function ProxyRow({
  item,
  locale,
  canRevoke,
}: {
  item: ProxyAssignmentItem;
  locale: string;
  canRevoke: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "voting.proxy" });

  const validFrom = new Date(item.validFrom).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const validUntil = item.validUntil
    ? new Date(item.validUntil).toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const statusStyle = {
    active: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    expired: {
      bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
      color: "var(--color-muted)",
    },
    scheduled: {
      bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    },
  }[item.status];

  return (
    <li
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "14px 16px",
      }}
    >
      <div className="flex justify-between items-start gap-3" style={{ marginBottom: "8px" }}>
        <div className="min-w-0">
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {item.counterpartyName}
          </div>
          {item.counterpartyEmail && (
            <div
              className="font-mono"
              style={{
                fontSize: "10.5px",
                color: "var(--color-ink-soft)",
                letterSpacing: "0.04em",
                marginTop: "2px",
              }}
            >
              {item.counterpartyEmail}
            </div>
          )}
        </div>
        <span
          className="font-mono inline-block flex-shrink-0"
          style={{
            fontSize: "10px",
            padding: "3px 8px",
            borderRadius: "5px",
            background: statusStyle.bg,
            color: statusStyle.color,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {t(`status_${item.status}`)}
        </span>
      </div>

      <div
        className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono"
        style={{
          fontSize: "10.5px",
          color: "var(--color-ink-soft)",
          letterSpacing: "0.04em",
        }}
      >
        <span>
          <span style={{ color: "var(--color-muted)" }}>
            {t("rowScope")}:
          </span>{" "}
          {item.scopeLabel === "general" ? t("scopeGeneral") : item.scopeLabel}
        </span>
        <span>
          <span style={{ color: "var(--color-muted)" }}>
            {t("rowFrom")}:
          </span>{" "}
          {validFrom}
        </span>
        {validUntil && (
          <span>
            <span style={{ color: "var(--color-muted)" }}>
              {t("rowUntil")}:
            </span>{" "}
            {validUntil}
          </span>
        )}
      </div>

      {canRevoke && item.status !== "expired" && (
        <div
          style={{
            marginTop: "10px",
            paddingTop: "10px",
            borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <RevokeProxyButton proxyId={item.id} />
        </div>
      )}
    </li>
  );
}
