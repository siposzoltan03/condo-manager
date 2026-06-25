import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOrgStatus } from "@/lib/contractor";
import { listAllBidsByOrg } from "@/lib/marketplace";
import { getTranslations } from "next-intl/server";
import { PageHead } from "@/components/contractor/page-head";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}

/**
 * Submitted-bid history. The contractor's view across all publications
 * they bid on. Lightweight table — Phase 7 deferred a full leads page
 * with full filters; this lists what we have today and is sorted by
 * recency. Tabs use search-params for shareability.
 */
export default async function ContractorLeadsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const tab: "submitted" | "won" | "rejected" | "all" =
    sp.status === "won"
      ? "won"
      : sp.status === "rejected"
        ? "rejected"
        : sp.status === "all"
          ? "all"
          : "submitted";

  const session = await auth();
  const orgId = session?.user?.contractorOrgId;
  if (!session?.user || !orgId) {
    redirect(`/${locale}/contractor/login`);
  }
  const org = await getOrgStatus(orgId);
  if (!org) redirect(`/${locale}/contractor/login`);
  if (org.status === "PENDING_VERIFICATION") {
    redirect(`/${locale}/contractor/onboarding`);
  }

  const allBids = await listAllBidsByOrg(orgId);

  const counts = {
    submitted: allBids.filter((b) => b.status === "SUBMITTED").length,
    won: allBids.filter((b) => b.status === "WON").length,
    rejected: allBids.filter((b) => b.status === "REJECTED").length,
    all: allBids.length,
  };
  const filtered =
    tab === "all"
      ? allBids
      : allBids.filter((b) => {
          if (tab === "submitted") return b.status === "SUBMITTED";
          if (tab === "won") return b.status === "WON";
          if (tab === "rejected") return b.status === "REJECTED";
          return true;
        });

  const t = await getTranslations({ locale, namespace: "marketplace" });
  const tabLabels = {
    submitted: t("bidStatusSubmitted"),
    won: t("bidStatusWon"),
    rejected: t("bidStatusRejected"),
    all: t("projectsTabAll"),
  };

  const basePath = `/${locale}/contractor/leads`;

  return (
    <div style={{ color: "var(--color-ink)" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "1080px", padding: "40px 24px 80px" }}
      >
        <PageHead
          pulse
          eyebrow={`/ ${t("navLeads")}`}
          title={t("navLeads")}
          subtitle={t("bidFormExisting")}
        />

        <div
          className="flex items-center gap-1 flex-wrap"
          style={{
            marginBottom: "20px",
            borderBottom:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            paddingBottom: "10px",
          }}
        >
          {(
            ["submitted", "won", "rejected", "all"] as const
          ).map((k) => {
            const isOn = k === tab;
            return (
              <Link
                key={k}
                href={`${basePath}?status=${k}`}
                className="font-mono flex items-center gap-2"
                style={{
                  padding: "7px 13px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  letterSpacing: "0.04em",
                  background: isOn ? "var(--color-ink)" : "transparent",
                  color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
                  fontWeight: isOn ? 600 : 500,
                  textDecoration: "none",
                }}
              >
                {tabLabels[k]}
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    background: isOn
                      ? "color-mix(in srgb, var(--color-bg) 20%, transparent)"
                      : "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                    color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {counts[k]}
                </span>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div
            className="rounded-xl border text-center"
            style={{
              padding: "40px 24px",
              borderStyle: "dashed",
              borderColor:
                "color-mix(in srgb, var(--color-ink) 12%, transparent)",
              background: "var(--color-bg-3)",
            }}
          >
            <p
              style={{
                color: "var(--color-ink-soft)",
                fontSize: "14px",
                margin: "0 0 12px",
              }}
            >
              {t("boardEmpty")}
            </p>
            <Link
              href={`/${locale}/contractor/marketplace`}
              className="font-mono"
              style={{
                display: "inline-block",
                padding: "9px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                background: "var(--color-ink)",
                color: "var(--color-bg)",
                textDecoration: "none",
                letterSpacing: "0.04em",
              }}
            >
              {t("openMarketCta")}
            </Link>
          </div>
        ) : (
          <ul
            className="rounded-xl border overflow-hidden"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              background: "var(--color-bg)",
              borderColor:
                "color-mix(in srgb, var(--color-ink) 10%, transparent)",
            }}
          >
            {filtered.map((b) => {
              const statusKey =
                b.status === "WON"
                  ? "bidStatusWon"
                  : b.status === "REJECTED"
                    ? "bidStatusRejected"
                    : b.status === "WITHDRAWN"
                      ? "bidStatusWithdrawn"
                      : "bidStatusSubmitted";
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 flex-wrap"
                  style={{
                    padding: "14px 18px",
                    borderTop:
                      "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
                  }}
                >
                  <Link
                    href={`/${locale}/contractor/marketplace/${b.publication.id}`}
                    style={{
                      textDecoration: "none",
                      color: "var(--color-ink)",
                      flex: "1 1 200px",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-space-grotesk), sans-serif",
                        fontSize: "14px",
                        fontWeight: 500,
                        letterSpacing: "-0.015em",
                      }}
                    >
                      {b.publication.scrubbedTitle}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: "10.5px",
                        color: "var(--color-muted)",
                        letterSpacing: "0.04em",
                        marginTop: "2px",
                      }}
                    >
                      {b.publication.zip} {b.publication.city}
                    </div>
                  </Link>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "12px",
                      color: "var(--color-ink)",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {Number(b.amount).toLocaleString(locale)} Ft · {b.etaDays}n
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      padding: "3px 9px",
                      borderRadius: "5px",
                      background:
                        b.status === "WON"
                          ? "var(--color-moss)"
                          : b.status === "REJECTED"
                            ? "color-mix(in srgb, var(--color-danger) 16%, transparent)"
                            : "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                      color:
                        b.status === "WON"
                          ? "var(--color-bg)"
                          : b.status === "REJECTED"
                            ? "var(--color-danger)"
                            : "var(--color-ink-soft)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {t(statusKey)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
