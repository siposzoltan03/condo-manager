"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type {
  ComplaintListItem,
  ComplaintCategoryRef,
} from "@/lib/dal";

type StatusKey =
  | "REPORTED"
  | "ACKNOWLEDGED"
  | "WARNING_SENT"
  | "MEDIATION"
  | "RESOLVED"
  | "ESCALATED";

type KanbanColKey =
  | "REPORTED"
  | "ACKNOWLEDGED"
  | "WARNING_SENT"
  | "MEDIATION"
  | "CLOSED";

const KANBAN_COLUMNS: KanbanColKey[] = [
  "REPORTED",
  "ACKNOWLEDGED",
  "WARNING_SENT",
  "MEDIATION",
  "CLOSED",
];

const STATUS_TO_COLUMN: Record<StatusKey, KanbanColKey> = {
  REPORTED: "REPORTED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  WARNING_SENT: "WARNING_SENT",
  MEDIATION: "MEDIATION",
  RESOLVED: "CLOSED",
  ESCALATED: "CLOSED",
};

const STATUS_PILL: Record<
  StatusKey,
  { bg: string; fg: string; label: string }
> = {
  REPORTED: { bg: "var(--color-bg-3)", fg: "var(--color-ink)", label: "REPORTED" },
  ACKNOWLEDGED: {
    bg: "color-mix(in srgb, var(--color-moss) 18%, transparent)",
    fg: "var(--color-moss)",
    label: "ACKNOWLEDGED",
  },
  WARNING_SENT: {
    bg: "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
    fg: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    label: "WARNING_SENT",
  },
  MEDIATION: {
    bg: "color-mix(in srgb, var(--color-ink) 12%, transparent)",
    fg: "var(--color-ink)",
    label: "MEDIATION",
  },
  RESOLVED: {
    bg: "color-mix(in srgb, var(--color-moss) 70%, transparent)",
    fg: "#fff",
    label: "RESOLVED",
  },
  ESCALATED: { bg: "#c44", fg: "#fff", label: "ESCALATED" },
};

interface Props {
  locale: string;
  isBoardPlus: boolean;
  initialComplaints: ComplaintListItem[];
  categories: ComplaintCategoryRef[];
}

export function ComplaintsExplorer({
  locale,
  isBoardPlus,
  initialComplaints,
  categories,
}: Props) {
  const t = useTranslations("complaints");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return initialComplaints.filter((c) => {
      if (activeCategory && c.category.id !== activeCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(c.title ?? "").toLowerCase().includes(q) &&
          !c.description.toLowerCase().includes(q) &&
          !c.trackingNumber.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [initialComplaints, activeCategory, search]);

  // Group filtered for kanban (board+) or sort flat (residents).
  const byColumn = useMemo(() => {
    const grouped: Record<KanbanColKey, ComplaintListItem[]> = {
      REPORTED: [],
      ACKNOWLEDGED: [],
      WARNING_SENT: [],
      MEDIATION: [],
      CLOSED: [],
    };
    for (const c of filtered) {
      const col = STATUS_TO_COLUMN[c.status as StatusKey];
      grouped[col].push(c);
    }
    return grouped;
  }, [filtered]);

  return (
    <>
      {/* Filters: category chips + search */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{ marginBottom: "20px" }}
      >
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className="font-mono"
          style={{
            padding: "6px 12px",
            fontSize: "11px",
            borderRadius: "999px",
            background: !activeCategory
              ? "var(--color-ink)"
              : "var(--color-bg-3)",
            color: !activeCategory ? "var(--color-bg)" : "var(--color-ink-soft)",
            border: 0,
            cursor: "pointer",
            letterSpacing: "0.04em",
            fontWeight: !activeCategory ? 600 : 500,
          }}
        >
          {t("actions.filterAll")}
        </button>
        {categories.map((c) => {
          const isOn = activeCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className="font-mono inline-flex items-center gap-1.5"
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                borderRadius: "999px",
                background: isOn ? "var(--color-ink)" : "var(--color-bg-3)",
                color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
                border: 0,
                cursor: "pointer",
                letterSpacing: "0.04em",
                fontWeight: isOn ? 600 : 500,
              }}
            >
              {c.icon && <span aria-hidden>{c.icon}</span>}
              {c.name}
            </button>
          );
        })}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("actions.search")}
          style={{
            marginLeft: "auto",
            width: "260px",
            maxWidth: "100%",
            padding: "8px 12px",
            fontSize: "12.5px",
            color: "var(--color-ink)",
            background: "var(--color-card)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "8px",
            outline: "none",
          }}
        />
      </div>

      {/* Body: kanban for board+, list for residents */}
      {filtered.length === 0 ? (
        <EmptyState
          title={
            initialComplaints.length === 0 ? t("empty.title") : t("empty.noResults")
          }
          subtitle={
            initialComplaints.length === 0 ? t("empty.subtitle") : ""
          }
        />
      ) : isBoardPlus ? (
        <Kanban locale={locale} byColumn={byColumn} />
      ) : (
        <ResidentList locale={locale} items={filtered} />
      )}
    </>
  );
}

// ─── Kanban (board+) ────────────────────────────────────────────────────

function Kanban({
  locale,
  byColumn,
}: {
  locale: string;
  byColumn: Record<KanbanColKey, ComplaintListItem[]>;
}) {
  const t = useTranslations("complaints");
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start"
    >
      {KANBAN_COLUMNS.map((col) => (
        <div
          key={col}
          style={{
            background: "var(--color-card)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "14px",
            padding: "14px 12px",
            minHeight: "120px",
          }}
        >
          <div
            className="flex items-baseline justify-between"
            style={{ marginBottom: "10px", padding: "0 4px" }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "10.5px",
                color: "var(--color-ink-soft)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {t(`kanban.${col}` as const)}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                fontWeight: 500,
              }}
            >
              {byColumn[col].length}
            </span>
          </div>
          {byColumn[col].length === 0 ? (
            <div
              style={{
                padding: "16px 6px",
                color: "var(--color-muted)",
                fontSize: "11.5px",
                fontStyle: "italic",
              }}
            >
              {t("kanban.columnEmpty")}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {byColumn[col].map((c) => (
                <ComplaintCard key={c.id} locale={locale} c={c} compact />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Resident list view ─────────────────────────────────────────────────

function ResidentList({
  locale,
  items,
}: {
  locale: string;
  items: ComplaintListItem[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <ComplaintCard key={c.id} locale={locale} c={c} compact={false} />
      ))}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────

function ComplaintCard({
  locale,
  c,
  compact,
}: {
  locale: string;
  c: ComplaintListItem;
  compact: boolean;
}) {
  const t = useTranslations("complaints");
  const pill = STATUS_PILL[c.status as StatusKey];
  return (
    <Link
      href={`/${locale}/complaints/${c.id}`}
      className="transition-colors hover:border-[color-mix(in_srgb,var(--color-ink)_20%,transparent)]"
      style={{
        display: "block",
        background: compact ? "var(--color-bg)" : "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        borderRadius: "10px",
        padding: compact ? "10px 12px" : "16px 18px",
        textDecoration: "none",
        color: "var(--color-ink)",
      }}
    >
      <div className="flex items-start gap-2" style={{ marginBottom: "6px" }}>
        {c.category.icon && (
          <span
            aria-hidden
            style={{ fontSize: compact ? "14px" : "18px", lineHeight: 1 }}
          >
            {c.category.icon}
          </span>
        )}
        <span
          className="font-mono"
          style={{
            fontSize: "9.5px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            flex: 1,
          }}
        >
          {c.category.name} · {c.trackingNumber}
        </span>
        {c.isPrivate && (
          <span
            className="font-mono"
            style={{
              fontSize: "9px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
            }}
            aria-label={t("card.private")}
            title={t("card.private")}
          >
            🔒
          </span>
        )}
      </div>
      {c.title && (
        <div
          style={{
            fontSize: compact ? "12.5px" : "14.5px",
            fontWeight: 600,
            letterSpacing: "-0.005em",
            marginBottom: "4px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {c.title}
        </div>
      )}
      <div
        style={{
          fontSize: compact ? "11.5px" : "12.5px",
          color: "var(--color-ink-soft)",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: compact ? 2 : 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          marginBottom: "8px",
        }}
      >
        {c.description}
      </div>
      <div
        className="flex items-center gap-2 font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {!compact && (
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "4px",
              background: pill.bg,
              color: pill.fg,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontSize: "9.5px",
            }}
          >
            {t(`status_${c.status as StatusKey}` as const)}
          </span>
        )}
        {c.respondentUnitLabel && (
          <span>
            {t("card.respondent", { label: c.respondentUnitLabel })}
          </span>
        )}
        {c.photosCount > 0 && (
          <span>{t("card.photos", { n: c.photosCount.toString() })}</span>
        )}
        {c.notesCount > 0 && (
          <span>{t("card.notes", { n: c.notesCount.toString() })}</span>
        )}
        <span style={{ marginLeft: "auto" }}>
          {new Date(c.createdAt).toLocaleDateString("hu-HU", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </Link>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        borderRadius: "14px",
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "18px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          marginBottom: "6px",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div style={{ color: "var(--color-muted)", fontSize: "13px" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
