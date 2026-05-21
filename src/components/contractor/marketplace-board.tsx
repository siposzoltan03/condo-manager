"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LeadCard, type LeadCardData } from "@/components/marketplace/lead-card";
import { PUBLICATION_URGENCIES } from "@/lib/marketplace/category-mapping";
import { PageHead } from "./page-head";

interface PublicationDTO {
  id: string;
  scrubbedTitle: string;
  scrubbedDescription: string;
  category: string;
  urgency: string;
  city: string;
  zip: string;
  budgetBand: string | null;
  deadlineAt: string | null;
  specialties: string[];
  publishedAt: string;
  publisherDisplayName: string;
  bidsCount: number;
}

export function MarketplaceBoard({ locale }: { locale: "hu" | "en" }) {
  const t = useTranslations("marketplace");
  const [pubs, setPubs] = useState<PublicationDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<"all" | (typeof PUBLICATION_URGENCIES)[number]["slug"]>(
    "all",
  );
  const [postedWithin, setPostedWithin] = useState<"all" | "7d" | "30d">("all");

  const reload = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (urgency !== "all") qs.set("urgency", urgency);
      if (postedWithin === "7d") qs.set("postedWithinDays", "7");
      if (postedWithin === "30d") qs.set("postedWithinDays", "30");
      const res = await fetch(`/api/contractor/marketplace?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(t("loadFailed"));
        return;
      }
      const data = (await res.json()) as { publications: PublicationDTO[] };
      setPubs(data.publications);
    } catch {
      setError(t("loadFailed"));
    }
  }, [t, urgency, postedWithin]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div
      style={{ color: "var(--color-ink)" }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: "1080px", padding: "40px 24px 80px" }}
      >
        <Header count={pubs?.length ?? null} />

        {error && (
          <div
            role="alert"
            className="rounded-lg border my-4"
            style={{
              padding: "10px 14px",
              fontSize: "13px",
              background:
                "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,264px)_minmax(0,1fr)] gap-6 mt-2">
          <FilterRail
            urgency={urgency}
            setUrgency={setUrgency}
            postedWithin={postedWithin}
            setPostedWithin={setPostedWithin}
          />

          <div>
            {pubs === null ? (
              <Skeleton />
            ) : pubs.length === 0 ? (
              <Empty locale={locale} />
            ) : (
              <ul
                className="grid gap-4"
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(280px, 1fr))",
                }}
              >
                {pubs.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/${locale}/contractor/marketplace/${p.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <LeadCard data={toLeadCardData(p)} locale={locale} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ count }: { count: number | null }) {
  const t = useTranslations("marketplace");
  return (
    <PageHead
      pulse
      eyebrow={t("boardEyebrowLive")}
      title={t("boardTitle")}
      subtitle={t("boardSubLive")}
      actions={
        count !== null && (
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              padding: "5px 10px",
              borderRadius: "6px",
              background: "var(--color-bg-3)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              color: "var(--color-ink-soft)",
              letterSpacing: "0.04em",
            }}
          >
            {t("boardResultCount", { count })}
          </span>
        )
      }
    />
  );
}

function FilterRail({
  urgency,
  setUrgency,
  postedWithin,
  setPostedWithin,
}: {
  urgency: "all" | string;
  setUrgency: (u: "all" | "URGENT" | "MEDIUM" | "PLANNED") => void;
  postedWithin: "all" | "7d" | "30d";
  setPostedWithin: (p: "all" | "7d" | "30d") => void;
}) {
  const t = useTranslations("marketplace");
  return (
    <aside
      className="rounded-xl border flex flex-col gap-5"
      style={{
        padding: "18px",
        background: "var(--color-card, var(--color-bg))",
        borderColor:
          "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        position: "sticky",
        top: "84px",
        alignSelf: "start",
      }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {t("boardFiltersTitle")}
      </span>

      <FilterGroup label={t("fieldUrgency")}>
        <FilterChip active={urgency === "all"} onClick={() => setUrgency("all")}>
          {t("filterAll")}
        </FilterChip>
        <FilterChip
          active={urgency === "URGENT"}
          onClick={() => setUrgency("URGENT")}
        >
          {t("filterUrgent")}
        </FilterChip>
        <FilterChip
          active={urgency === "MEDIUM"}
          onClick={() => setUrgency("MEDIUM")}
        >
          {t("filterMedium")}
        </FilterChip>
        <FilterChip
          active={urgency === "PLANNED"}
          onClick={() => setUrgency("PLANNED")}
        >
          {t("filterPlanned")}
        </FilterChip>
      </FilterGroup>

      <FilterGroup label={t("detailPublished")}>
        <FilterChip
          active={postedWithin === "all"}
          onClick={() => setPostedWithin("all")}
        >
          {t("filterPostedAll")}
        </FilterChip>
        <FilterChip
          active={postedWithin === "7d"}
          onClick={() => setPostedWithin("7d")}
        >
          {t("filterPosted7d")}
        </FilterChip>
        <FilterChip
          active={postedWithin === "30d"}
          onClick={() => setPostedWithin("30d")}
        >
          {t("filterPosted30d")}
        </FilterChip>
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="font-mono"
        style={{
          fontSize: "10.5px",
          color: "var(--color-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center sm:min-h-0"
      style={{
        padding: "6px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        background: active ? "var(--color-ink)" : "var(--color-bg-3)",
        color: active ? "var(--color-bg)" : "var(--color-ink-soft)",
        border: active
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

function Skeleton() {
  return (
    <ul
      className="grid gap-4"
      style={{
        listStyle: "none",
        padding: 0,
        margin: "20px 0 0",
        gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
      }}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl"
          style={{
            height: "200px",
            background: "var(--color-bg-3)",
            opacity: 0.5,
          }}
        />
      ))}
    </ul>
  );
}

function Empty({ locale }: { locale: "hu" | "en" }) {
  const t = useTranslations("marketplace");
  return (
    <div
      className="rounded-xl border text-center"
      style={{
        marginTop: "24px",
        padding: "48px 24px",
        borderStyle: "dashed",
        borderColor: "color-mix(in srgb, var(--color-ink) 12%, transparent)",
        background: "var(--color-bg-3)",
      }}
    >
      <p
        style={{
          fontSize: "16px",
          color: "var(--color-ink)",
          margin: "0 0 6px",
        }}
      >
        {t("boardEmpty")}
      </p>
      <p
        style={{
          fontSize: "13px",
          color: "var(--color-ink-soft)",
          margin: 0,
        }}
      >
        {t("boardEmptyHint")}
      </p>
      <Link
        href={`/${locale}/contractor/settings`}
        className="font-mono"
        style={{
          display: "inline-block",
          marginTop: "16px",
          padding: "9px 14px",
          borderRadius: "8px",
          fontSize: "12px",
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          textDecoration: "none",
          letterSpacing: "0.04em",
        }}
      >
        ⚙ {locale === "en" ? "Settings" : "Beállítások"}
      </Link>
    </div>
  );
}

function toLeadCardData(p: PublicationDTO): LeadCardData {
  return {
    scrubbedTitle: p.scrubbedTitle,
    scrubbedDescription: p.scrubbedDescription,
    category: p.category,
    urgency: p.urgency as LeadCardData["urgency"],
    city: p.city,
    zip: p.zip,
    budgetBand: p.budgetBand as LeadCardData["budgetBand"],
    deadlineAt: p.deadlineAt ? new Date(p.deadlineAt) : null,
    publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
    publisherDisplayName: p.publisherDisplayName,
    bidsCount: p.bidsCount,
  };
}
