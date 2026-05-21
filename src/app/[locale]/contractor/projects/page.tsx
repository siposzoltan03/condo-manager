import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOrgStatus } from "@/lib/contractor";
import { listWonBids } from "@/lib/marketplace";
import { getTranslations } from "next-intl/server";
import { PageHead } from "@/components/contractor/page-head";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}

/**
 * Contractor "my projects" page. Phase 4 ships a read-only list of
 * AWARDED publications the org won. Phase 5/6 will add status updates,
 * scheduled visits, and invoice flow. The status filter (Aktív / Lezárt
 * / Mind) lives in the URL search-params so the tabs are sharable.
 */
export default async function ContractorProjectsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const tab: "active" | "closed" | "all" =
    sp.status === "closed" ? "closed" : sp.status === "all" ? "all" : "active";
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

  const t = await getTranslations({ locale, namespace: "marketplace" });

  const wonBids = await listWonBids(orgId);

  // Bucket counts for the tab strip (Aktív / Lezárt / Mind). A project
  // is "Aktív" until the board signs off (VERIFIED) — that's the only
  // terminal state from the contractor's POV. COMPLETED still requires
  // the contractor to upload an invoice and the board to mark it paid.
  const isActive = (s: string | undefined) =>
    s !== undefined && s !== "VERIFIED";
  const counts = {
    active: wonBids.filter((b) => isActive(b.publication.ticket?.status))
      .length,
    closed: wonBids.length -
      wonBids.filter((b) => isActive(b.publication.ticket?.status)).length,
    all: wonBids.length,
  };

  const filteredBids =
    tab === "active"
      ? wonBids.filter((b) => isActive(b.publication.ticket?.status))
      : tab === "closed"
        ? wonBids.filter((b) => !isActive(b.publication.ticket?.status))
        : wonBids;

  return (
    <div style={{ color: "var(--color-ink)" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "880px", padding: "40px 24px 80px" }}
      >
        <PageHead
          pulse
          eyebrow={t("projectsEyebrow")}
          title={t("projectsTitle")}
          subtitle={t("projectsSubtitle")}
        />

        <Tabs
          active={tab}
          counts={counts}
          labels={{
            active: t("projectsTabActive"),
            closed: t("projectsTabClosed"),
            all: t("projectsTabAll"),
          }}
          basePath={`/${locale}/contractor/projects`}
        />


        {filteredBids.length === 0 ? (
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
                fontSize: "14.5px",
                color: "var(--color-ink-soft)",
                margin: "0 0 12px",
              }}
            >
              {t("projectsEmpty")}
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
              {t("projectsGoMarket")}
            </Link>
          </div>
        ) : (
          <ul
            className="flex flex-col gap-3"
            style={{ listStyle: "none", padding: 0 }}
          >
            {filteredBids.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/${locale}/contractor/projects/${b.id}`}
                  className="block rounded-xl border transition-colors hover:border-[var(--color-ink)]"
                  style={{
                    padding: "16px 18px",
                    background:
                      "color-mix(in srgb, var(--color-good) 8%, var(--color-bg))",
                    borderColor:
                      "color-mix(in srgb, var(--color-good) 30%, transparent)",
                    textDecoration: "none",
                    color: "var(--color-ink)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "10px",
                          padding: "3px 8px",
                          borderRadius: "5px",
                          background: "var(--color-ink)",
                          color: "var(--color-bg)",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {t(`category${b.publication.category}` as never)}
                      </span>
                      <h3
                        style={{
                          fontFamily: "var(--font-space-grotesk), sans-serif",
                          fontSize: "17px",
                          fontWeight: 500,
                          letterSpacing: "-0.02em",
                          margin: "8px 0 4px",
                        }}
                      >
                        {b.publication.scrubbedTitle}
                      </h3>
                      <p
                        className="font-mono"
                        style={{
                          fontSize: "11px",
                          color: "var(--color-muted)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {b.publication.zip} {b.publication.city} ·{" "}
                        {b.publication.publisherDisplayName} ·{" "}
                        {t("reviewFt", {
                          amount: Number(b.amount).toLocaleString(locale),
                        })}
                        {" · "}
                        {t("reviewDays", { count: b.etaDays })}
                      </p>
                    </div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "var(--color-good)",
                        color: "var(--color-bg)",
                        letterSpacing: "0.06em",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {t("bidStatusWon")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tabs({
  active,
  counts,
  labels,
  basePath,
}: {
  active: "active" | "closed" | "all";
  counts: { active: number; closed: number; all: number };
  labels: { active: string; closed: string; all: string };
  basePath: string;
}) {
  const tabs: Array<{ key: "active" | "closed" | "all"; href: string }> = [
    { key: "active", href: `${basePath}?status=active` },
    { key: "closed", href: `${basePath}?status=closed` },
    { key: "all", href: `${basePath}?status=all` },
  ];
  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      style={{
        marginBottom: "20px",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        paddingBottom: "10px",
      }}
    >
      {tabs.map((tb) => {
        const isOn = tb.key === active;
        return (
          <Link
            key={tb.key}
            href={tb.href}
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
            {labels[tb.key]}
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
              {counts[tb.key]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
