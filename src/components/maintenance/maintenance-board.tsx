"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  KanbanColumn,
  MaintenanceTicketCard,
  TicketStatusKey,
  UrgencyKey,
  CategoryKey,
} from "@/lib/maintenance-dal";

interface Props {
  locale: string;
  initialKanban: Record<KanbanColumn, MaintenanceTicketCard[]>;
  initialColumnCounts: Record<KanbanColumn, number>;
  list: MaintenanceTicketCard[];
  isBoardPlus: boolean;
}

type FilterPill = "all" | "mine" | "sla_risk" | "resident";

const COLUMN_TARGET: Record<KanbanColumn, TicketStatusKey | null> = {
  submitted: null, // creation only
  acknowledged: "ACKNOWLEDGED",
  in_progress: "IN_PROGRESS",
  closed: "COMPLETED",
};

const COLUMN_DOT: Record<KanbanColumn, string> = {
  submitted: "var(--color-ochre)",
  acknowledged: "#6c8caa",
  in_progress: "var(--color-moss-2)",
  closed: "var(--color-good)",
};

const COLUMN_ORDER: KanbanColumn[] = [
  "submitted",
  "acknowledged",
  "in_progress",
  "closed",
];

export function MaintenanceBoard({
  locale,
  initialKanban,
  initialColumnCounts,
  list,
  isBoardPlus,
}: Props) {
  const router = useRouter();
  const t = useTranslations("maintenance");

  const [kanban, setKanban] = useState(initialKanban);
  const [columnCounts, setColumnCounts] = useState(initialColumnCounts);

  // Sync server-rendered state into client state when props change (e.g. after
  // router.refresh() following a ticket creation or assignment). Without this,
  // useState ignores prop changes and new tickets only show up after a full
  // page reload.
  useEffect(() => {
    setKanban(initialKanban);
  }, [initialKanban]);
  useEffect(() => {
    setColumnCounts(initialColumnCounts);
  }, [initialColumnCounts]);

  const [view, setView] = useState<"board" | "list" | "map">("board");
  const [filter, setFilter] = useState<FilterPill>("all");
  const [category, setCategory] = useState<CategoryKey | "all">("all");
  const [contractor, setContractor] = useState<string>("all");
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanColumn | null>(null);

  const allCards = useMemo(
    () => [
      ...kanban.submitted,
      ...kanban.acknowledged,
      ...kanban.in_progress,
      ...kanban.closed,
    ],
    [kanban],
  );

  // Filter helpers
  function passesFilter(c: MaintenanceTicketCard): boolean {
    if (filter === "sla_risk" && !c.slaAtRisk) return false;
    if (filter === "mine" && !c.assigneeName) return false;
    if (filter === "resident" && c.assigneeName) return false;
    if (category !== "all" && c.category !== category) return false;
    if (contractor !== "all") {
      if (contractor === "__none__" && c.assigneeName) return false;
      if (contractor !== "__none__" && c.assigneeName !== contractor) return false;
    }
    return true;
  }

  const filteredKanban = useMemo<Record<KanbanColumn, MaintenanceTicketCard[]>>(() => {
    return {
      submitted: kanban.submitted.filter(passesFilter),
      acknowledged: kanban.acknowledged.filter(passesFilter),
      in_progress: kanban.in_progress.filter(passesFilter),
      closed: kanban.closed.filter(passesFilter),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanban, filter, category, contractor]);

  const filteredList = useMemo(
    () => list.filter(passesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, filter, category, contractor],
  );

  const filterCounts = useMemo(
    () => ({
      all: allCards.length,
      mine: allCards.filter((c) => c.assigneeName).length,
      sla_risk: allCards.filter((c) => c.slaAtRisk).length,
      resident: allCards.filter((c) => !c.assigneeName).length,
    }),
    [allCards],
  );

  const contractorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCards) if (c.assigneeName) set.add(c.assigneeName);
    return Array.from(set).sort();
  }, [allCards]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────
  function findColumnOf(ticketId: string): KanbanColumn | null {
    for (const col of COLUMN_ORDER) {
      if (kanban[col].some((t) => t.id === ticketId)) return col;
    }
    return null;
  }

  function handleDragStart(ticketId: string) {
    if (!isBoardPlus) return;
    setDraggedTicketId(ticketId);
  }

  function handleDragEnd() {
    setDraggedTicketId(null);
    setDropTarget(null);
  }

  function handleDragOver(e: React.DragEvent, col: KanbanColumn) {
    if (!isBoardPlus) return;
    if (!draggedTicketId) return;
    e.preventDefault();
    setDropTarget(col);
  }

  async function handleDrop(targetCol: KanbanColumn) {
    if (!isBoardPlus || !draggedTicketId) return;
    const sourceCol = findColumnOf(draggedTicketId);
    setDropTarget(null);
    if (!sourceCol || sourceCol === targetCol) {
      setDraggedTicketId(null);
      return;
    }

    const target = COLUMN_TARGET[targetCol];
    if (!target) {
      toast.error(t("kanban.errInvalidTransition"));
      setDraggedTicketId(null);
      return;
    }

    const ticket = kanban[sourceCol].find((t) => t.id === draggedTicketId);
    if (!ticket) {
      setDraggedTicketId(null);
      return;
    }

    // Optimistic: move to target column locally.
    const next = {
      submitted: [...kanban.submitted],
      acknowledged: [...kanban.acknowledged],
      in_progress: [...kanban.in_progress],
      closed: [...kanban.closed],
    };
    next[sourceCol] = next[sourceCol].filter((t) => t.id !== draggedTicketId);
    const updated: MaintenanceTicketCard = {
      ...ticket,
      status: target,
      progressSteps: progressFor(target),
    };
    next[targetCol] = [updated, ...next[targetCol]];
    setKanban(next);
    setColumnCounts({
      ...columnCounts,
      [sourceCol]: columnCounts[sourceCol] - 1,
      [targetCol]: columnCounts[targetCol] + 1,
    });

    setDraggedTicketId(null);

    try {
      const res = await fetch(`/api/maintenance/tickets/${draggedTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "patch failed");
      }
      toast.success(t("kanban.movedToast"));
      router.refresh();
    } catch (err) {
      // Revert.
      setKanban(kanban);
      setColumnCounts(columnCounts);
      toast.error(
        err instanceof Error ? err.message : t("kanban.errInvalidTransition"),
      );
    }
  }

  return (
    <>
      {/* Filters */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ marginBottom: "20px" }}
      >
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "mine", "sla_risk", "resident"] as FilterPill[]).map((key) => {
            const isOn = filter === key;
            const count = filterCounts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={{
                  fontSize: "12px",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: isOn
                    ? "1px solid var(--color-ink)"
                    : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  background: isOn ? "var(--color-ink)" : "var(--color-card)",
                  color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {t(`kanban.filter.${key}`)}
                <span
                  className="font-mono"
                  style={{
                    marginLeft: "6px",
                    fontSize: "10px",
                    opacity: 0.6,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey | "all")}
          style={selectStyle}
        >
          <option value="all">{t("kanban.allCategories")}</option>
          {(
            [
              "PLUMBING",
              "ELECTRICAL",
              "STRUCTURAL",
              "COMMON_AREA",
              "ELEVATOR",
              "HEATING",
              "OTHER",
            ] as CategoryKey[]
          ).map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </select>
        <select
          value={contractor}
          onChange={(e) => setContractor(e.target.value)}
          style={selectStyle}
        >
          <option value="all">{t("kanban.allContractors")}</option>
          <option value="__none__">{t("kanban.unassigned")}</option>
          {contractorOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div
          className="flex"
          style={{
            marginLeft: "auto",
            background: "var(--color-card)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          {(["board", "list", "map"] as const).map((v) => {
            const isOn = view === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => v !== "map" && setView(v)}
                disabled={v === "map"}
                style={{
                  padding: "7px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: isOn
                    ? "var(--color-bg)"
                    : v === "map"
                      ? "var(--color-muted)"
                      : "var(--color-ink-soft)",
                  background: isOn ? "var(--color-ink)" : "transparent",
                  border: 0,
                  cursor: v === "map" ? "not-allowed" : "pointer",
                  opacity: v === "map" ? 0.5 : 1,
                }}
                title={v === "map" ? t("kanban.mapSoon") : undefined}
              >
                {t(`kanban.view.${v}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Board / List */}
      {view === "board" ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
          style={{ marginBottom: "32px" }}
        >
          {COLUMN_ORDER.map((col) => {
            const isDropping = dropTarget === col;
            return (
              <div
                key={col}
                onDragOver={(e) => handleDragOver(e, col)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={() => handleDrop(col)}
                style={{
                  background: isDropping
                    ? "color-mix(in srgb, var(--color-moss-2) 8%, transparent)"
                    : "color-mix(in srgb, var(--color-ink) 3%, transparent)",
                  border: isDropping
                    ? "1px dashed var(--color-moss-2)"
                    : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
                  borderRadius: "14px",
                  padding: "14px",
                  minHeight: "400px",
                  transition: "background 120ms, border-color 120ms",
                }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: "14px", padding: "0 4px" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: COLUMN_DOT[col],
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-space-grotesk), sans-serif",
                        fontSize: "13px",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {t(`kanban.column.${col}`)}
                    </span>
                    {col === "closed" && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "9px",
                          color: "var(--color-muted)",
                          marginLeft: "4px",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {t("kanban.lastDays")}
                      </span>
                    )}
                  </div>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {filteredKanban[col].length}
                  </span>
                </div>
                {filteredKanban[col].length === 0 ? (
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "11px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.04em",
                      textAlign: "center",
                      padding: "24px 8px",
                    }}
                  >
                    {t("kanban.columnEmpty")}
                  </div>
                ) : (
                  filteredKanban[col].map((ticket) => (
                    <BoardCard
                      key={ticket.id}
                      ticket={ticket}
                      locale={locale}
                      isDragged={draggedTicketId === ticket.id}
                      isBoardPlus={isBoardPlus}
                      onDragStart={() => handleDragStart(ticket.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : view === "list" ? (
        <ListView list={filteredList} locale={locale} />
      ) : null}
    </>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "7px 12px",
  border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
  borderRadius: "6px",
  background: "var(--color-card)",
  color: "var(--color-ink)",
  fontFamily: "inherit",
};

function progressFor(status: TicketStatusKey): number {
  return {
    SUBMITTED: 0,
    ACKNOWLEDGED: 1,
    ASSIGNED: 2,
    IN_PROGRESS: 3,
    COMPLETED: 4,
    VERIFIED: 4,
  }[status];
}

function urgencyColor(u: UrgencyKey): string {
  if (u === "CRITICAL") return "var(--color-danger)";
  if (u === "HIGH") return "var(--color-ochre)";
  if (u === "MEDIUM") return "var(--color-moss-2)";
  return "color-mix(in srgb, var(--color-ink) 15%, transparent)";
}

function BoardCard({
  ticket,
  locale,
  isDragged,
  isBoardPlus,
  onDragStart,
  onDragEnd,
}: {
  ticket: MaintenanceTicketCard;
  locale: string;
  isDragged: boolean;
  isBoardPlus: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations("maintenance");
  const isCritical = ticket.urgency === "CRITICAL";
  const isClosed = ticket.status === "COMPLETED" || ticket.status === "VERIFIED";

  return (
    <Link
      href={`/${locale}/maintenance/${ticket.id}`}
      draggable={isBoardPlus && !isClosed}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="block"
      style={{
        background:
          isCritical && !isClosed
            ? "var(--color-ink)"
            : "var(--color-card)",
        color:
          isCritical && !isClosed ? "var(--color-bg)" : "var(--color-ink)",
        border:
          isCritical && !isClosed
            ? "1px solid var(--color-ink)"
            : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "10px",
        padding: "12px 14px",
        marginBottom: "10px",
        position: "relative",
        cursor: isBoardPlus && !isClosed ? "grab" : "pointer",
        opacity: isDragged ? 0.4 : isClosed ? 0.85 : 1,
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: "10px",
          bottom: "10px",
          width: "3px",
          borderRadius: "0 3px 3px 0",
          background: urgencyColor(ticket.urgency),
        }}
      />
      <div
        className="font-mono flex items-center gap-1.5"
        style={{
          fontSize: "10px",
          color:
            isCritical && !isClosed
              ? "color-mix(in srgb, var(--color-bg) 55%, transparent)"
              : "var(--color-muted)",
          letterSpacing: "0.06em",
        }}
      >
        <CategoryIcon category={ticket.category} />
        {ticket.trackingNumber} · {t(`category.${ticket.category}`)}
      </div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          letterSpacing: "-0.005em",
          margin: "5px 0 8px",
          lineHeight: 1.3,
        }}
      >
        {ticket.title}
      </div>
      {ticket.location && (
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color:
              isCritical && !isClosed
                ? "color-mix(in srgb, var(--color-bg) 55%, transparent)"
                : "var(--color-muted)",
            letterSpacing: "0.04em",
            marginBottom: "10px",
            textTransform: "uppercase",
          }}
        >
          {ticket.location}
        </div>
      )}
      {(ticket.urgency === "CRITICAL" ||
        ticket.urgency === "HIGH" ||
        ticket.slaAtRisk) && (
        <div
          className="flex flex-wrap gap-1"
          style={{ marginBottom: "8px" }}
        >
          {ticket.urgency === "CRITICAL" && (
            <Tag dark={isCritical && !isClosed}>{t("urgency.CRITICAL")}</Tag>
          )}
          {ticket.urgency === "HIGH" && (
            <Tag dark={isCritical && !isClosed}>{t("urgency.HIGH")}</Tag>
          )}
          {ticket.slaAtRisk && ticket.slaHours != null && (
            <Tag dark={isCritical && !isClosed} tone="danger">
              {t("kanban.slaTag", { hours: ticket.slaHours.toString() })}
            </Tag>
          )}
        </div>
      )}
      {!isClosed && ticket.progressSteps > 0 && (
        <div className="flex gap-0.5" style={{ marginTop: "8px" }}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: "3px",
                borderRadius: "2px",
                background:
                  i < ticket.progressSteps
                    ? "var(--color-moss-2)"
                    : isCritical && !isClosed
                      ? "color-mix(in srgb, var(--color-bg) 15%, transparent)"
                      : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
              }}
            />
          ))}
        </div>
      )}
      <div
        className="flex items-center justify-between"
        style={{ marginTop: "8px" }}
      >
        <div
          className="flex items-center gap-1.5"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color:
              isCritical && !isClosed ? "var(--color-bg)" : "var(--color-ink-soft)",
          }}
        >
          {ticket.assigneeInitials && (
            <span
              className="grid place-items-center"
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: ticket.assigneeName
                  ? "var(--color-moss-2)"
                  : isCritical && !isClosed
                    ? "color-mix(in srgb, var(--color-bg) 15%, transparent)"
                    : "color-mix(in srgb, var(--color-ink) 15%, transparent)",
                color:
                  ticket.assigneeName
                    ? "var(--color-bg)"
                    : isCritical && !isClosed
                      ? "var(--color-bg)"
                      : "var(--color-ink-soft)",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "9px",
                fontWeight: 600,
              }}
            >
              {ticket.assigneeName ? ticket.assigneeInitials : "—"}
            </span>
          )}
          {ticket.assigneeName ?? t("kanban.unassigned")}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color:
              ticket.slaAtRisk
                ? isCritical && !isClosed
                  ? "var(--color-ochre)"
                  : "var(--color-danger)"
                : isCritical && !isClosed
                  ? "color-mix(in srgb, var(--color-bg) 60%, transparent)"
                  : "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {formatAge(ticket.ageHours, t)}
        </div>
      </div>
      {isClosed && ticket.rating != null && (
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            marginTop: "8px",
            padding: "2px 6px",
            borderRadius: "3px",
            background:
              ticket.rating >= 4
                ? "var(--color-good-soft)"
                : "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
            color:
              ticket.rating >= 4
                ? "var(--color-good)"
                : "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
            display: "inline-block",
            letterSpacing: "0.04em",
            fontWeight: 700,
          }}
        >
          ★ {ticket.rating}/5
        </div>
      )}
    </Link>
  );
}

function Tag({
  children,
  dark = false,
  tone,
}: {
  children: React.ReactNode;
  dark?: boolean;
  tone?: "danger";
}) {
  let bg: string;
  let color: string;
  if (tone === "danger") {
    bg = dark
      ? "color-mix(in srgb, var(--color-danger) 30%, transparent)"
      : "color-mix(in srgb, var(--color-danger) 15%, transparent)";
    color = "var(--color-danger)";
  } else {
    bg = dark
      ? "color-mix(in srgb, var(--color-bg) 12%, transparent)"
      : "color-mix(in srgb, var(--color-ink) 6%, transparent)";
    color = dark ? "var(--color-bg)" : "var(--color-ink-soft)";
  }
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "9px",
        padding: "1px 5px",
        borderRadius: "3px",
        background: bg,
        color,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function formatAge(
  ageHours: number,
  t: ReturnType<typeof useTranslations>,
): string {
  if (ageHours < 1) return t("kanban.ageMinutes");
  if (ageHours < 24) return t("kanban.ageHours", { n: ageHours.toString() });
  const days = Math.floor(ageHours / 24);
  return t("kanban.ageDays", { n: days.toString() });
}

function ListView({
  list,
  locale,
}: {
  list: MaintenanceTicketCard[];
  locale: string;
}) {
  const t = useTranslations("maintenance");
  if (list.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          padding: "48px 32px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
          marginBottom: "32px",
        }}
      >
        {t("kanban.listEmpty")}
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        marginBottom: "32px",
        overflow: "hidden",
      }}
    >
      <div
        className="hidden md:grid font-mono"
        style={{
          gridTemplateColumns: "minmax(0, 2.4fr) 110px 110px 110px 130px 90px",
          gap: "16px",
          padding: "12px 18px",
          fontSize: "10px",
          letterSpacing: "0.08em",
          color: "var(--color-muted)",
          textTransform: "uppercase",
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        }}
      >
        <span>{t("list.colTicket")}</span>
        <span>{t("list.colCategory")}</span>
        <span>{t("list.colUrgency")}</span>
        <span>{t("list.colStatus")}</span>
        <span>{t("list.colAssignee")}</span>
        <span style={{ textAlign: "right" }}>{t("list.colAge")}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {list.map((ticket) => (
          <li
            key={ticket.id}
            style={{
              borderBottom:
                "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          >
            <Link
              href={`/${locale}/maintenance/${ticket.id}`}
              className="flex flex-col gap-2 md:grid md:items-center md:gap-4 md:grid-cols-[minmax(0,2.4fr)_110px_110px_110px_130px_90px] transition-colors hover:bg-[var(--color-bg-3)]"
              style={{
                padding: "14px 18px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div className="min-w-0">
                <div
                  className="font-mono"
                  style={{
                    fontSize: "10px",
                    color: "var(--color-muted)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {ticket.trackingNumber}
                </div>
                <div
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    marginTop: "2px",
                  }}
                >
                  {ticket.title}
                </div>
                {ticket.location && (
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-muted)",
                      marginTop: "3px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {ticket.location}
                  </div>
                )}
              </div>
              <div
                style={{ fontSize: "12px", color: "var(--color-ink-soft)" }}
              >
                {t(`category.${ticket.category}`)}
              </div>
              <div>
                <UrgencyPill urgency={ticket.urgency} t={t} />
              </div>
              <div>
                <StatusPill status={ticket.status} t={t} />
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: ticket.assigneeName
                    ? "var(--color-ink-soft)"
                    : "var(--color-muted)",
                  fontStyle: ticket.assigneeName ? "normal" : "italic",
                }}
              >
                {ticket.assigneeName ?? t("kanban.unassigned")}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "11px",
                  textAlign: "right",
                  color: ticket.slaAtRisk
                    ? "var(--color-danger)"
                    : "var(--color-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                {formatAge(ticket.ageHours, t)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UrgencyPill({
  urgency,
  t,
}: {
  urgency: UrgencyKey;
  t: ReturnType<typeof useTranslations>;
}) {
  const tone = {
    CRITICAL: { bg: "var(--color-danger-soft)", color: "var(--color-danger)" },
    HIGH: {
      bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    },
    MEDIUM: {
      bg: "color-mix(in srgb, var(--color-moss-2) 18%, transparent)",
      color: "var(--color-moss-2)",
    },
    LOW: {
      bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
      color: "var(--color-muted)",
    },
  }[urgency];
  return (
    <span
      className="font-mono inline-block"
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "4px",
        background: tone.bg,
        color: tone.color,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {t(`urgency.${urgency}`)}
    </span>
  );
}

function StatusPill({
  status,
  t,
}: {
  status: TicketStatusKey;
  t: ReturnType<typeof useTranslations>;
}) {
  const tone = {
    SUBMITTED: { bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)", color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))" },
    ACKNOWLEDGED: { bg: "color-mix(in srgb, #6c8caa 25%, transparent)", color: "#3a5a78" },
    ASSIGNED: { bg: "color-mix(in srgb, #6c8caa 25%, transparent)", color: "#3a5a78" },
    IN_PROGRESS: { bg: "color-mix(in srgb, var(--color-moss-2) 22%, transparent)", color: "var(--color-moss-2)" },
    COMPLETED: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    VERIFIED: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
  }[status];
  return (
    <span
      className="font-mono inline-block"
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "4px",
        background: tone.bg,
        color: tone.color,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function CategoryIcon({ category }: { category: CategoryKey }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    style: { flexShrink: 0 },
  };
  switch (category) {
    case "PLUMBING":
      return (
        <svg {...common}>
          <path d="M12 22s-8-7.5-8-13a8 8 0 0 1 16 0c0 5.5-8 13-8 13z" />
        </svg>
      );
    case "ELECTRICAL":
      return (
        <svg {...common}>
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      );
    case "STRUCTURAL":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
    case "COMMON_AREA":
      return (
        <svg {...common}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "ELEVATOR":
      return (
        <svg {...common}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M10 8h4M10 12h4M10 16h4" />
        </svg>
      );
    case "HEATING":
      return (
        <svg {...common}>
          <path d="M12 2v8M12 22a6 6 0 0 1-6-6c0-4 6-10 6-10s6 6 6 10a6 6 0 0 1-6 6z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
  }
}
