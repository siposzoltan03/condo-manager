# `<DataTable>` API spike

**Date:** 2026-05-18 · **Status:** Spike (not canonical)
**Plan ref:** [`docs/plans/2026-05-18-mobile-responsive.md`](../plans/2026-05-18-mobile-responsive.md) §0.6

## What this spike answers

Before shipping the canonical shared component (Phase 0 task #6), what
should the prop shape be? Getting it wrong locks pain into every later
phase since this lands in finance, voting, complaints, maintenance,
units, residents, settings, admin tables.

## What changed in scope after looking at code

The plan implied two spike surfaces: **finance ledger** and **voting
history**. Reading the code:

- `finance/ledger-table.tsx` and `finance/finance-ledger-table-tiles.tsx`
  are real `<table>` surfaces. ✓ Good spike target.
- `voting/past-vote-card.tsx` is **already a card** — it has a result
  badge, a stacked bar chart, and a vote breakdown. There is no
  table-form to switch from. ✗ Wrong target.
- `voting/meeting-list.tsx` renders `<MeetingCard>` items in two
  date-bucketed groups. Also already cards. ✗ Wrong target.

**Corollary:** the plan's claim that `<CardList>/<DataTable>` "touches
50+ surfaces" overcounts. The component only fits surfaces that have a
real `<table>` on desktop. From `grep -rl '<table' src/components`,
that's:

- `finance/{ledger-table, finance-ledger-table-tiles, payment-history-table, budget-table}.tsx`
- `units/{unit-list, units-explorer}.tsx`
- `admin/{building-list, user-list}.tsx`
- `settings/{invitation-list, notifications-tab}.tsx`
- `documents/documents-explorer.tsx`
- `public/pricing-page.tsx` (probably keeps its own layout)

≈ 11 real targets, not 50. **Update the plan after this spike lands.**

A surface like `meeting-list` doesn't need this primitive — it just
needs its existing `MeetingCard` to be mobile-friendly.

## Naming

Drop the `<CardList>/<DataTable>` *pair*. One component, one name:
**`<DataTable>`**. It renders as a table at `md:`+ and as a card stack
below. "CardList" as a separate name was misleading — there's no
separate component, just one breakpoint-aware view.

## API

```ts
type ColumnAlign = "left" | "right" | "center";

interface Column<T> {
  /** Stable identifier. Used as React key and (optionally) as sort key. */
  key: string;

  /** Header label. String for default rendering, or node for custom. */
  header: ReactNode;

  /** Cell value. Receives the row; returns the cell node. */
  render: (row: T) => ReactNode;

  /** Horizontal alignment. Defaults to "left". Right for numerics. */
  align?: ColumnAlign;

  /** Hide this column entirely. Skipped in both table and card views. */
  hide?: boolean;

  /** Hide on phone-card view only. Useful for "ID" or "createdBy" columns
   *  that are noise on a phone but useful at desktop. */
  hideInCard?: boolean;

  /** Marks the column whose value becomes the card's title (large/bold).
   *  Exactly one column should set this; if none does, the first non-
   *  `hideInCard` column is used. */
  primary?: boolean;

  /** Width hint for the table view ("auto" by default). Phone view ignores. */
  width?: string;

  /** Mono font for numeric/date columns. Defaults to false. */
  mono?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];

  /** Stable row key. Required — never index. */
  rowKey: (row: T) => string;

  /** Click handler for the entire row (card or table-row). Optional. */
  onRowClick?: (row: T) => void;

  /** Right-side row actions (kebab menu, edit/delete buttons). Renders in
   *  its own column at desktop, as a footer in the card. */
  rowActions?: (row: T) => ReactNode;

  /** Breakpoint at which the table view kicks in. Defaults to "md".
   *  Finance ledger and other wide-column surfaces override to "lg". */
  tableAt?: "sm" | "md" | "lg";

  /** Empty-state node (no rows). */
  emptyState?: ReactNode;

  /** Loading skeleton (no rows yet). */
  loading?: boolean;

  /** Optional sort state — if provided, headers become clickable. */
  sort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (key: string) => void;

  /** Per-surface card escape hatch. If provided, the phone view uses this
   *  instead of the auto-generated stacked layout. Used by finance ledger
   *  where the column data is too dense to stack legibly. */
  renderCard?: (row: T) => ReactNode;
}
```

## Card view defaults (when `renderCard` is not provided)

For each row:

1. Primary column renders large at the top (`text-base font-semibold`).
2. Remaining non-`hideInCard` columns stack below as label-value pairs:
   - Label: column `header`, small mono uppercase, muted.
   - Value: `render(row)` output.
3. `rowActions(row)` if provided, renders in a footer row aligned right.
4. Whole card is tappable if `onRowClick` is set (44 px min touch
   target satisfied by the card padding).

## Validation

Spike skeleton was written against:

- **Finance ledger** — works with `renderCard` escape hatch
  (date/description/amount/balance/status is too dense for default
  label-value stacking; ledger needs its own bespoke card).
- **Units list** — works with default card auto-generation. Primary
  column = unit number; size/owner/share stack below.

Two real surfaces, two different render strategies, one API. Good
signal.

## Open per-spike questions

- **Sticky header in table view.** Finance ledger benefits from a
  sticky `<thead>` at long scroll. Not required for v1; revisit when
  finance phase hits.
- **Virtualization.** Some lists (residents in large condos, ledger
  entries over multi-year history) cross 500+ rows. Out of scope for
  v1 — surface this if a real list reaches that size in Phase B–C.
- **Hungarian column headers.** Test labels at 375 px for overflow
  before claiming the API is done. e.g., "Tulajdoni hányad" is
  noticeably longer than "Share."

## Skeleton

Spike implementation is intentionally **not** committed to
`src/components/shared/` — that path is reserved for the canonical
version (Phase 0 task #6). The skeleton below proved the API; the
canonical implementation can refine details (className, tile-style
borders, animation) without reshaping props.

```tsx
"use client";

import { type ReactNode } from "react";
import clsx from "clsx";

interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  hide?: boolean;
  hideInCard?: boolean;
  primary?: boolean;
  width?: string;
  mono?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  tableAt?: "sm" | "md" | "lg";
  emptyState?: ReactNode;
  loading?: boolean;
  sort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (key: string) => void;
  renderCard?: (row: T) => ReactNode;
}

const TABLE_BREAKPOINT = {
  sm: { hidden: "sm:hidden", table: "hidden sm:block" },
  md: { hidden: "md:hidden", table: "hidden md:block" },
  lg: { hidden: "lg:hidden", table: "hidden lg:block" },
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowActions,
  tableAt = "md",
  emptyState,
  loading,
  sort,
  onSortChange,
  renderCard,
}: DataTableProps<T>) {
  const visible = columns.filter((c) => !c.hide);
  const cardColumns = visible.filter((c) => !c.hideInCard);
  const primaryColumn = cardColumns.find((c) => c.primary) ?? cardColumns[0];
  const secondaryColumns = cardColumns.filter((c) => c.key !== primaryColumn?.key);
  const bp = TABLE_BREAKPOINT[tableAt];

  if (loading) return <DataTableSkeleton />;
  if (rows.length === 0) return <>{emptyState ?? <EmptyDefault />}</>;

  return (
    <>
      {/* Card view (phone) */}
      <div className={clsx("flex flex-col gap-3", bp.hidden)}>
        {rows.map((row) => {
          const key = rowKey(row);
          if (renderCard) {
            return (
              <div key={key} onClick={() => onRowClick?.(row)}>
                {renderCard(row)}
              </div>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => onRowClick?.(row)}
              disabled={!onRowClick}
              className="rounded-xl border border-ink/8 bg-card p-4 text-left disabled:cursor-default touch:min-h-11"
            >
              {primaryColumn && (
                <div className="font-display text-base text-ink">
                  {primaryColumn.render(row)}
                </div>
              )}
              <dl className="mt-2 flex flex-col gap-1.5">
                {secondaryColumns.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-3">
                    <dt className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
                      {c.header}
                    </dt>
                    <dd className={clsx("text-sm text-ink", c.mono && "font-mono")}>
                      {c.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
              {rowActions && (
                <div className="mt-3 flex justify-end border-t border-ink/5 pt-3">
                  {rowActions(row)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Table view (desktop) */}
      <div className={clsx("rounded-xl border border-ink/8 bg-card overflow-x-auto", bp.table)}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink/8">
              {visible.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={clsx(
                    "px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    !c.align && "text-left",
                    onSortChange && "cursor-pointer select-none"
                  )}
                  style={c.width ? { width: c.width } : undefined}
                  onClick={onSortChange ? () => onSortChange(c.key) : undefined}
                >
                  {c.header}
                  {sort?.key === c.key && (sort.direction === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
              {rowActions && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  "border-b border-ink/5 transition-colors hover:bg-bg-3",
                  onRowClick && "cursor-pointer"
                )}
              >
                {visible.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(
                      "px-4 py-3 text-sm",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.mono && "font-mono"
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-2 py-3 text-right">{rowActions(row)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DataTableSkeleton() {
  return (
    <div className="rounded-xl border border-ink/8 bg-card p-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-bg-3" />
        ))}
      </div>
    </div>
  );
}

function EmptyDefault() {
  return (
    <div className="rounded-xl border border-ink/8 bg-card py-12 text-center text-sm text-muted">
      No entries.
    </div>
  );
}
```

## Recommended changes to the plan based on spike

1. **§0.2 entry** — rename `<CardList>/<DataTable>` pair to just
   `<DataTable>` (one component, breakpoint-aware). Card-only surfaces
   (meeting-list, past-vote-card) don't use this primitive.
2. **§5 Phase B / C surface estimates** — refigure based on which
   components actually have `<table>` markup today (≈ 11), not on
   list-shaped surfaces broadly.
3. **§0.6 spike target list** — replace "voting history" with
   "units list" (or similar). Voting is already cards by design.
