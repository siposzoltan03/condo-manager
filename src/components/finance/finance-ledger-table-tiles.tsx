"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { FinanceLedgerRow } from "@/lib/finance-dal";
import { DataTable, type Column } from "@/components/shared/data-table";

interface Props {
  locale: string;
  rows: FinanceLedgerRow[];
  /** When true, render as a panel preview (no header — caller handles it). */
  embed?: boolean;
  /** Footer text on the right side. */
  syncLabel?: string;
  /** Footer text on the left side; defaults to "{shown} / {total}". */
  countLabel?: string;
}

export function FinanceLedgerTableTiles({
  locale: _locale,
  rows,
  embed,
  syncLabel,
  countLabel,
}: Props) {
  const t = useTranslations("finance.ledger");
  void _locale;

  // Pre-compute running balance per row. The existing implementation used
  // a mutable accumulator inside the table render loop; DataTable doesn't
  // pass index/accumulator to column renderers, so we build a Map keyed
  // by row id and look it up in the render callback.
  const balanceByRowId = useMemo(() => {
    const totals = new Map<string, number>();
    let running = rows.reduce((s, r) => s + r.amount, 0);
    for (const r of rows) {
      totals.set(r.id, running);
      running -= r.amount;
    }
    return totals;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
        }}
      >
        {t("empty")}
      </div>
    );
  }

  const columns: Column<FinanceLedgerRow>[] = [
    {
      key: "date",
      header: t("colDate"),
      mono: true,
      render: (r) => (
        <span
          className="font-mono whitespace-nowrap"
          style={{ fontSize: "12px", color: "var(--color-muted)" }}
        >
          {new Date(r.date).toLocaleDateString("hu-HU", {
            month: "2-digit",
            day: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "description",
      header: t("colDescription"),
      primary: true,
      render: (r) => (
        <div>
          <strong
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "13px",
              letterSpacing: "-0.005em",
            }}
          >
            {r.description}
          </strong>
          <span
            className="font-mono inline-flex items-center"
            style={{
              gap: "5px",
              marginTop: "3px",
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              padding: "2px 7px",
              borderRadius: "4px",
              background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          >
            /{" "}
            {r.kind === "income"
              ? "bevétel"
              : r.kind === "expense"
                ? "kiadás"
                : "belső"}{" "}
            · {r.category}
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      header: t("colAmount"),
      align: "right",
      mono: true,
      render: (r) => (
        <span
          className="font-mono whitespace-nowrap"
          style={{
            fontWeight: 600,
            fontSize: "13px",
            color:
              r.amount > 0
                ? "var(--color-good)"
                : r.amount < 0
                  ? "var(--color-danger)"
                  : "var(--color-ink)",
          }}
        >
          {r.amount > 0 ? "+" : r.amount < 0 ? "−" : ""}
          {Math.abs(Math.round(r.amount)).toLocaleString("hu-HU")}
        </span>
      ),
    },
    {
      key: "balance",
      header: t("colBalance"),
      align: "right",
      mono: true,
      render: (r) => (
        <span
          className="font-mono whitespace-nowrap"
          style={{ fontWeight: 600, fontSize: "13px" }}
        >
          {Math.round(balanceByRowId.get(r.id) ?? 0).toLocaleString("hu-HU")}
        </span>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      align: "right",
      // Hide in card view — having "Booked"/"Paid" repeated for every entry
      // is noise on phone; finance overview hides it deliberately.
      hideInCard: true,
      render: (r) => {
        const isFirst = rows[0]?.id === r.id;
        return (
          <Pill kind={isFirst ? "ok" : "neu"}>
            {isFirst ? t("statusBooked") : t("statusPaid")}
          </Pill>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        className="!rounded-none !border-0"
      />
      {!embed && (
        <div
          className="flex justify-between items-center font-mono"
          style={{
            padding: "14px 22px",
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            background: "var(--color-bg-3)",
            borderTop:
              "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <span>{countLabel ?? `${rows.length} ${t("rowsLabel")}`}</span>
          {syncLabel && <span>{syncLabel}</span>}
        </div>
      )}
    </>
  );
}

function Pill({
  kind,
  children,
}: {
  kind: "ok" | "warn" | "bad" | "neu";
  children: React.ReactNode;
}) {
  const palette = {
    ok: { bg: "var(--color-good-soft, #d9e2cd)", color: "var(--color-good)" },
    warn: {
      bg: "color-mix(in srgb, var(--color-ochre) 30%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    },
    bad: {
      bg: "var(--color-danger-soft, #f2d6cc)",
      color: "var(--color-danger)",
    },
    neu: {
      bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
      color: "var(--color-ink-soft)",
    },
  }[kind];
  return (
    <span
      className="font-mono inline-block whitespace-nowrap"
      style={{
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: "999px",
        fontWeight: 600,
        background: palette.bg,
        color: palette.color,
      }}
    >
      {children}
    </span>
  );
}
