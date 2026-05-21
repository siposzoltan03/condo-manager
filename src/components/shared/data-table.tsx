"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  /** Stable identifier. Used as React key and sort key. */
  key: string;
  /** Header label. String for default rendering, or node for custom. */
  header: ReactNode;
  /** Cell value. Receives the row; returns the cell node. */
  render: (row: T) => ReactNode;
  /** Horizontal alignment. Defaults to "left". Right-align numerics. */
  align?: "left" | "right" | "center";
  /** Hide this column entirely (both table and card views). */
  hide?: boolean;
  /** Hide on phone-card view only. Useful for "ID" or "createdBy"
   *  columns that are noise on phone but useful at desktop. */
  hideInCard?: boolean;
  /** Marks the column whose value becomes the card's title (large/bold).
   *  Exactly one column should set this; if none does, the first non-
   *  `hideInCard` column is used. */
  primary?: boolean;
  /** Width hint for the table view ("auto" by default). Phone ignores. */
  width?: string;
  /** Mono font for numeric/date cells. Defaults to false. */
  mono?: boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  /** Stable row key. Required — never index. */
  rowKey: (row: T) => string;
  /** Click handler for the row (whole card or table row). Optional. */
  onRowClick?: (row: T) => void;
  /** Right-side row actions (kebab menu, edit/delete buttons). Renders
   *  in its own column at desktop, as a footer in the card. */
  rowActions?: (row: T) => ReactNode;
  /** Breakpoint at which the table view kicks in. Defaults to "md".
   *  Wide-column surfaces (finance ledger) override to "lg". */
  tableAt?: "sm" | "md" | "lg";
  /** Empty-state node (no rows). */
  emptyState?: ReactNode;
  /** Loading skeleton (no rows yet). */
  loading?: boolean;
  /** Optional sort state — when provided, headers become clickable. */
  sort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (key: string) => void;
  /** Per-surface card escape hatch. When provided, phone view uses this
   *  instead of the auto-generated stacked layout. */
  renderCard?: (row: T) => ReactNode;
  /** Optional className passed to the outer wrapper of each view. */
  className?: string;
}

const TABLE_BREAKPOINT = {
  sm: { cards: "sm:hidden", table: "hidden sm:block" },
  md: { cards: "md:hidden", table: "hidden md:block" },
  lg: { cards: "lg:hidden", table: "hidden lg:block" },
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
  className,
}: DataTableProps<T>) {
  if (loading) return <DataTableSkeleton />;
  if (rows.length === 0) {
    return <>{emptyState ?? <DataTableEmpty />}</>;
  }

  const visible = columns.filter((c) => !c.hide);
  const cardColumns = visible.filter((c) => !c.hideInCard);
  const primaryColumn = cardColumns.find((c) => c.primary) ?? cardColumns[0];
  const secondaryColumns = cardColumns.filter(
    (c) => c.key !== primaryColumn?.key,
  );
  const bp = TABLE_BREAKPOINT[tableAt];

  return (
    <>
      {/* Card view (phone). */}
      <div className={cn("flex flex-col gap-3", bp.cards, className)}>
        {rows.map((row) => {
          const key = rowKey(row);
          if (renderCard) {
            return (
              <div
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {renderCard(row)}
              </div>
            );
          }
          return (
            <article
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "rounded-xl border border-ink/8 bg-card p-4",
                onRowClick && "cursor-pointer touch:min-h-11 transition-colors hover:bg-bg-3",
              )}
            >
              {primaryColumn && (
                <div className="font-display text-base font-semibold leading-tight text-ink">
                  {primaryColumn.render(row)}
                </div>
              )}
              {secondaryColumns.length > 0 && (
                <dl className="mt-3 flex flex-col gap-1.5">
                  {secondaryColumns.map((c) => (
                    <div
                      key={c.key}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <dt className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
                        {c.header}
                      </dt>
                      <dd
                        className={cn(
                          "text-right text-sm text-ink",
                          c.mono && "font-mono",
                        )}
                      >
                        {c.render(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {rowActions && (
                <div className="mt-3 flex justify-end border-t border-ink/5 pt-3">
                  {rowActions(row)}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Table view (desktop). */}
      <div
        className={cn(
          "overflow-x-auto rounded-xl border border-ink/8 bg-card",
          bp.table,
          className,
        )}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink/8">
              {visible.map((c) => {
                const sortable = Boolean(onSortChange);
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      "px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      !c.align && "text-left",
                      sortable && "cursor-pointer select-none hover:text-ink",
                    )}
                    onClick={
                      sortable ? () => onSortChange?.(c.key) : undefined
                    }
                  >
                    {c.header}
                    {sort?.key === c.key &&
                      (sort.direction === "asc" ? " ▲" : " ▼")}
                  </th>
                );
              })}
              {rowActions && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-ink/5 transition-colors hover:bg-bg-3",
                  onRowClick && "cursor-pointer",
                )}
              >
                {visible.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3 text-sm text-ink",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.mono && "font-mono",
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

function DataTableEmpty() {
  return (
    <div className="rounded-xl border border-ink/8 bg-card py-12 text-center text-sm text-muted">
      —
    </div>
  );
}
