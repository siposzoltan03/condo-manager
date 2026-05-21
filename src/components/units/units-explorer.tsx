"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  UnitMapCell,
  UnitsFloorMap,
  UnitDetailData,
  OccupancyKind,
} from "@/lib/units-dal";

interface Props {
  isBoardPlus: boolean;
  units: UnitMapCell[];
  floorMap: UnitsFloorMap[];
  tabCounts: {
    map: number;
    owners: number;
    tenants: number;
    vacant: number;
    commons: number;
  };
}

type SubTab = "map" | "owners" | "tenants" | "vacant" | "commons";
type View = "map" | "table";
type Stairwell = "all" | string;
type StatusFilter = "all" | "overdue" | "tenant_occupied";

export function UnitsExplorer({
  isBoardPlus,
  units,
  floorMap,
  tabCounts,
}: Props) {
  const t = useTranslations("units");

  const [tab, setTab] = useState<SubTab>("map");
  const [view, setView] = useState<View>("map");
  const [stairwell, setStairwell] = useState<Stairwell>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    units[0]?.id ?? null,
  );

  // Pre-load detail of the selected unit on the client.
  const [detail, setDetail] = useState<UnitDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    fetch(`/api/units/${selectedId}/detail`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Filtering pipeline
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      // Sub-tab filter
      if (tab === "owners" && u.occupancy !== "owner_occupied") return false;
      if (
        tab === "tenants" &&
        u.occupancy !== "tenant_occupied" &&
        u.occupancy !== "sublet"
      )
        return false;
      if (tab === "vacant" && u.occupancy !== "vacant") return false;
      // Stairwell filter
      if (stairwell !== "all" && u.stairwell !== stairwell) return false;
      // Status filter
      if (statusFilter === "overdue" && !u.hasOverdue) return false;
      if (
        statusFilter === "tenant_occupied" &&
        u.occupancy !== "tenant_occupied" &&
        u.occupancy !== "sublet"
      )
        return false;
      return true;
    });
  }, [units, tab, stairwell, statusFilter]);

  const filteredFloorMap = useMemo(() => {
    const ids = new Set(filteredUnits.map((u) => u.id));
    return floorMap.map((sw) => ({
      stairwell: sw.stairwell,
      floors: sw.floors.map((f) => ({
        floor: f.floor,
        units: f.units.map((u) => ({ ...u, dimmed: !ids.has(u.id) })),
      })),
    }));
  }, [floorMap, filteredUnits]);

  const stairwellOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) if (u.stairwell) set.add(u.stairwell);
    return Array.from(set).sort();
  }, [units]);

  const overdueCount = units.filter((u) => u.hasOverdue).length;
  const tenantCount = tabCounts.tenants;

  return (
    <>
      {/* Sub-tabs */}
      <div
        className="flex gap-1"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          marginBottom: "18px",
          overflowX: "auto",
        }}
      >
        {(["map", "owners", "tenants", "vacant", "commons"] as SubTab[]).map(
          (k) => {
            const isOn = tab === k;
            const count = tabCounts[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                style={{
                  padding: "9px 14px",
                  fontSize: "13px",
                  fontWeight: isOn ? 600 : 500,
                  color: isOn ? "var(--color-ink)" : "var(--color-ink-soft)",
                  borderBottom: isOn
                    ? "2px solid var(--color-ink)"
                    : "2px solid transparent",
                  marginBottom: "-1px",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t(`tab.${k}`)}
                <span
                  className="font-mono"
                  style={{
                    marginLeft: "6px",
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    background:
                      "color-mix(in srgb, var(--color-ink) 7%, transparent)",
                    fontWeight: 500,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          },
        )}
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{ marginBottom: "18px" }}
      >
        <FilterChip
          on={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          count={units.length}
        >
          {t("filter.allStatuses")}
        </FilterChip>
        {stairwellOptions.map((s) => (
          <FilterChip
            key={s}
            on={stairwell === s}
            onClick={() => setStairwell(stairwell === s ? "all" : s)}
            count={units.filter((u) => u.stairwell === s).length}
          >
            {t("filter.stairwell", { letter: s })}
          </FilterChip>
        ))}
        <FilterChip
          on={statusFilter === "overdue"}
          onClick={() =>
            setStatusFilter(statusFilter === "overdue" ? "all" : "overdue")
          }
          count={overdueCount}
        >
          {t("filter.overdue")}
        </FilterChip>
        <FilterChip
          on={statusFilter === "tenant_occupied"}
          onClick={() =>
            setStatusFilter(
              statusFilter === "tenant_occupied" ? "all" : "tenant_occupied",
            )
          }
          count={tenantCount}
        >
          {t("filter.rented")}
        </FilterChip>

        <div
          className="flex"
          style={{
            marginLeft: "auto",
            background: "var(--color-card)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "7px",
            padding: "2px",
          }}
        >
          {(["map", "table"] as View[]).map((v) => {
            const isOn = view === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                style={{
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: isOn ? "var(--color-bg)" : "var(--color-muted)",
                  background: isOn ? "var(--color-ink)" : "transparent",
                  borderRadius: "5px",
                  border: 0,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t(`view.${v}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main grid: map/table + detail panel — stacks on phone/tablet. */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] items-start"
        style={{ gap: "20px" }}
      >
        <div className="min-w-0">
          {view === "map" ? (
            <FloorMapView
              floorMap={filteredFloorMap}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <UnitTableView
              units={filteredUnits}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        <DetailPanel
          detail={detail}
          loading={loadingDetail}
          isBoardPlus={isBoardPlus}
        />
      </div>
    </>
  );
}

function FilterChip({
  on,
  onClick,
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5"
      style={{
        padding: "6px 10px",
        background: on ? "var(--color-ink)" : "var(--color-card)",
        border: on
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "7px",
        fontSize: "12px",
        fontWeight: 500,
        color: on ? "var(--color-bg)" : "var(--color-ink-soft)",
        cursor: "pointer",
      }}
    >
      {children}
      {count !== undefined && (
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: on
              ? "color-mix(in srgb, var(--color-bg) 55%, transparent)"
              : "var(--color-muted)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Floor map view ─────────────────────────────────────────────────────

function FloorMapView({
  floorMap,
  selectedId,
  onSelect,
}: {
  floorMap: UnitsFloorMap[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("units");

  if (floorMap.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          padding: "48px 32px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
        }}
      >
        {t("map.empty")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {floorMap.map((sw, idx) => (
        <div
          key={sw.stairwell ?? `${idx}`}
          style={{
            background: "var(--color-card)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "14px",
            padding: "22px",
          }}
        >
          <div
            className="flex justify-between items-center"
            style={{ marginBottom: "18px" }}
          >
            <h3
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "18px",
                fontWeight: 600,
                letterSpacing: "-0.015em",
              }}
            >
              {sw.stairwell
                ? t("map.stairwellTitle", { letter: sw.stairwell })
                : t("map.singleStairwellTitle")}
            </h3>
            <Legend />
          </div>
          <div className="flex flex-col gap-2">
            {sw.floors.map((f) => (
              <FloorRow
                key={f.floor}
                floor={f.floor}
                units={f.units as Array<UnitMapCell & { dimmed?: boolean }>}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  const t = useTranslations("units");
  const items = [
    {
      color: "color-mix(in srgb, var(--color-moss-2) 35%, transparent)",
      label: t("legend.owner"),
    },
    {
      color: "color-mix(in srgb, var(--color-ochre) 35%, transparent)",
      label: t("legend.tenant"),
    },
    {
      color: "color-mix(in srgb, #3a5a78 30%, transparent)",
      label: t("legend.sublet"),
    },
    {
      color: "var(--color-bg-3)",
      label: t("legend.vacant"),
      border: "1px dashed color-mix(in srgb, var(--color-ink) 10%, transparent)",
    },
    {
      color: "var(--color-danger)",
      label: t("legend.overdue"),
      dot: true,
    },
  ];
  return (
    <div
      className="flex gap-3.5 flex-wrap font-mono"
      style={{
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            style={{
              width: it.dot ? "8px" : "10px",
              height: it.dot ? "8px" : "10px",
              borderRadius: it.dot ? "50%" : "2px",
              background: it.color,
              border: it.border ?? "none",
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function FloorRow({
  floor,
  units,
  selectedId,
  onSelect,
}: {
  floor: number;
  units: Array<UnitMapCell & { dimmed?: boolean }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("units");
  // Pad units to 6 slots for consistent grid.
  const slots: (UnitMapCell & { dimmed?: boolean } | null)[] = Array.from(
    { length: 6 },
    (_, i) => units[i] ?? null,
  );

  return (
    <div
      className="grid items-center"
      style={{ gridTemplateColumns: "70px 1fr", gap: "14px" }}
    >
      <div
        className="font-mono text-right"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
        }}
      >
        <b
          style={{
            display: "block",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "16px",
            color: "var(--color-ink)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {floor}.
        </b>
        {floor === 7 ? t("map.attic") : t("map.floor")}
      </div>
      <div
        className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
        style={{ gap: "6px" }}
      >
        {slots.map((u, i) =>
          u ? (
            <UnitTile
              key={u.id}
              unit={u}
              isSelected={u.id === selectedId}
              onClick={() => onSelect(u.id)}
            />
          ) : (
            <div key={`empty-${i}`} style={{ visibility: "hidden" }} />
          ),
        )}
      </div>
    </div>
  );
}

function UnitTile({
  unit,
  isSelected,
  onClick,
}: {
  unit: UnitMapCell & { dimmed?: boolean };
  isSelected: boolean;
  onClick: () => void;
}) {
  const bg = bgFor(unit.occupancy, isSelected);
  const border = borderFor(unit.occupancy, isSelected);
  const color = isSelected ? "var(--color-bg)" : "var(--color-ink)";

  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-transform"
      style={{
        aspectRatio: "1.4 / 1",
        borderRadius: "6px",
        background: bg,
        border,
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "pointer",
        position: "relative",
        opacity: unit.dimmed && !isSelected ? 0.3 : 1,
        textAlign: "left",
        outline: isSelected ? "2px solid var(--color-ink)" : "none",
        outlineOffset: "2px",
      }}
    >
      {unit.hasOverdue && !isSelected && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--color-danger)",
          }}
        />
      )}
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 600,
          fontSize: "13px",
          letterSpacing: "-0.01em",
          color,
        }}
      >
        {unit.number}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "9px",
          color: isSelected
            ? "color-mix(in srgb, var(--color-bg) 60%, transparent)"
            : "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {Math.round(unit.size)} m²
      </div>
    </button>
  );
}

function bgFor(o: OccupancyKind, selected: boolean): string {
  if (selected) return "var(--color-ink)";
  switch (o) {
    case "owner_occupied":
      return "color-mix(in srgb, var(--color-moss-2) 18%, var(--color-card))";
    case "tenant_occupied":
      return "color-mix(in srgb, var(--color-ochre) 18%, var(--color-card))";
    case "sublet":
      return "color-mix(in srgb, #3a5a78 15%, var(--color-card))";
    case "vacant":
      return "var(--color-bg-3)";
  }
}

function borderFor(o: OccupancyKind, selected: boolean): string {
  if (selected) return "1px solid var(--color-ink)";
  switch (o) {
    case "owner_occupied":
      return "1px solid color-mix(in srgb, var(--color-moss-2) 35%, transparent)";
    case "tenant_occupied":
      return "1px solid color-mix(in srgb, var(--color-ochre) 40%, transparent)";
    case "sublet":
      return "1px solid color-mix(in srgb, #3a5a78 30%, transparent)";
    case "vacant":
      return "1px dashed color-mix(in srgb, var(--color-ink) 10%, transparent)";
  }
}

// ─── Table view ──────────────────────────────────────────────────────────

function UnitTableView({
  units,
  selectedId,
  onSelect,
}: {
  units: UnitMapCell[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("units");
  if (units.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          padding: "48px 32px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
        }}
      >
        {t("table.empty")}
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Th>{t("table.colUnit")}</Th>
            <Th>{t("table.colOccupants")}</Th>
            <Th>{t("table.colStatus")}</Th>
            <Th>{t("table.colArea")}</Th>
            <Th>{t("table.colShare")}</Th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <UnitRow
              key={u.id}
              unit={u}
              selected={u.id === selectedId}
              onClick={() => onSelect(u.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="font-mono"
      style={{
        textAlign: "left",
        padding: "10px 16px",
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 500,
        background: "var(--color-bg-3)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      {children}
    </th>
  );
}

function UnitRow({
  unit,
  selected,
  onClick,
}: {
  unit: UnitMapCell;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("units");
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: selected
          ? "color-mix(in srgb, var(--color-ochre) 14%, transparent)"
          : "transparent",
      }}
    >
      <Td>
        <div
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "14px",
            letterSpacing: "-0.01em",
          }}
        >
          {unit.number}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {unit.stairwell ?? "—"} ·{" "}
          {unit.floor === 7 ? t("map.attic") : `${unit.floor}. ${t("map.floor")}`}
        </div>
      </Td>
      <Td>
        {unit.primaryName ? (
          <div className="flex items-center gap-2">
            <span
              className="grid place-items-center flex-shrink-0"
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background:
                  unit.occupancy === "tenant_occupied"
                    ? "var(--color-ochre)"
                    : "var(--color-moss-2)",
                color:
                  unit.occupancy === "tenant_occupied"
                    ? "var(--color-ink)"
                    : "var(--color-bg)",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 600,
                fontSize: "10px",
              }}
            >
              {unit.primaryInitials}
            </span>
            <span style={{ fontSize: "13px" }}>{unit.primaryName}</span>
            {unit.occupantCount > 1 && (
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                +{unit.occupantCount - 1}
              </span>
            )}
          </div>
        ) : (
          <span
            style={{
              color: "var(--color-muted)",
              fontStyle: "italic",
              fontSize: "13px",
            }}
          >
            {t("table.vacant")}
          </span>
        )}
      </Td>
      <Td>
        <OccupancyPill occupancy={unit.occupancy} />
      </Td>
      <Td>
        <span
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 500,
            fontSize: "13px",
          }}
        >
          {unit.size.toFixed(1)}
          <small
            className="font-mono"
            style={{
              color: "var(--color-muted)",
              fontWeight: 400,
              fontSize: "10px",
              marginLeft: "3px",
              letterSpacing: "0.04em",
            }}
          >
            m²
          </small>
        </span>
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: "60px",
              height: "4px",
              background: "var(--color-bg-3)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${Math.min(100, unit.ownershipShare * 1000)}%`,
                height: "100%",
                background: "var(--color-ink)",
              }}
            />
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.02em",
            }}
          >
            {Math.round(unit.ownershipShare * 10000)}/10k
          </span>
        </div>
      </Td>
    </tr>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "12px 16px",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        fontSize: "13px",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function OccupancyPill({ occupancy }: { occupancy: OccupancyKind }) {
  const t = useTranslations("units");
  const tone = {
    owner_occupied: {
      bg: "color-mix(in srgb, var(--color-moss-2) 22%, transparent)",
      color: "var(--color-moss)",
      label: t("occupancy.owner"),
    },
    tenant_occupied: {
      bg: "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 78%, var(--color-ink))",
      label: t("occupancy.tenant"),
    },
    sublet: {
      bg: "color-mix(in srgb, #3a5a78 22%, transparent)",
      color: "#3a5a78",
      label: t("occupancy.sublet"),
    },
    vacant: {
      bg: "var(--color-bg-3)",
      color: "var(--color-muted)",
      label: t("occupancy.vacant"),
    },
  }[occupancy];
  return (
    <span
      className="font-mono inline-block"
      style={{
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "4px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: tone.bg,
        color: tone.color,
        border: occupancy === "vacant"
          ? "1px dashed color-mix(in srgb, var(--color-ink) 10%, transparent)"
          : "none",
      }}
    >
      {tone.label}
    </span>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────

function DetailPanel({
  detail,
  loading,
  isBoardPlus,
}: {
  detail: UnitDetailData | null;
  loading: boolean;
  isBoardPlus: boolean;
}) {
  const t = useTranslations("units");
  const router = useRouter();

  if (!detail || loading) {
    return (
      <aside
        style={{
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          padding: "48px 22px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
          position: "sticky",
          top: "24px",
        }}
      >
        {loading ? t("detail.loading") : t("detail.empty")}
      </aside>
    );
  }

  const occupancyTag =
    detail.occupancy === "owner_occupied"
      ? t("occupancy.owner")
      : detail.occupancy === "tenant_occupied"
        ? t("occupancy.tenant")
        : detail.occupancy === "sublet"
          ? t("occupancy.sublet")
          : t("occupancy.vacant");

  const occupancyTagBg =
    detail.occupancy === "owner_occupied"
      ? "var(--color-moss-2)"
      : detail.occupancy === "tenant_occupied"
        ? "var(--color-ochre)"
        : detail.occupancy === "sublet"
          ? "#3a5a78"
          : "color-mix(in srgb, var(--color-bg) 15%, transparent)";

  const occupancyTagColor =
    detail.occupancy === "owner_occupied" || detail.occupancy === "sublet"
      ? "#fff"
      : detail.occupancy === "tenant_occupied"
        ? "var(--color-ink)"
        : "var(--color-bg)";

  return (
    <aside
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        overflow: "hidden",
        position: "sticky",
        top: "24px",
      }}
    >
      {/* Dark header */}
      <div
        style={{
          padding: "20px 22px 16px",
          background: "var(--color-ink)",
          color: "var(--color-bg)",
        }}
      >
        <div
          className="flex items-baseline gap-2.5"
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "34px",
            fontWeight: 500,
            letterSpacing: "-0.03em",
          }}
        >
          {detail.number}
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
              letterSpacing: "0.06em",
              fontWeight: 500,
            }}
          >
            {detail.stairwell ?? ""}
            {detail.stairwell ? " · " : ""}
            {detail.floor === 7
              ? t("map.attic").toUpperCase()
              : `${detail.floor}. ${t("map.floor").toUpperCase()}`}
          </span>
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "color-mix(in srgb, var(--color-bg) 75%, transparent)",
            letterSpacing: "0.04em",
            marginTop: "4px",
            textTransform: "uppercase",
          }}
        >
          {detail.building.address} · {detail.building.zipCode}{" "}
          {detail.building.city}
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          style={{ marginTop: "12px" }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              borderRadius: "4px",
              background: occupancyTagBg,
              color: occupancyTagColor,
              letterSpacing: "0.05em",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            {occupancyTag}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "18px 22px 22px" }}>
        <Section title={t("detail.facts")}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "1fr 1fr",
              gap: "10px 16px",
            }}
          >
            <Fact
              label={t("detail.area")}
              value={detail.size.toFixed(1)}
              unit="m²"
            />
            <Fact
              label={t("detail.share")}
              value={Math.round(detail.ownershipShare * 10000).toString()}
              unit="/ 10 000"
            />
            <Fact
              label={t("detail.floorLabel")}
              value={
                detail.floor === 7
                  ? t("map.attic")
                  : `${detail.floor}.`
              }
            />
            <Fact
              label={t("detail.openTickets")}
              value={detail.openTicketCount.toString()}
            />
          </div>
        </Section>

        <Section title={t("detail.occupants")}>
          {detail.occupants.length === 0 ? (
            <div
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.04em",
                fontStyle: "italic",
              }}
            >
              {t("detail.noOccupants")}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {detail.occupants.map((p) => (
                <PersonRow key={p.id} person={p} t={t} />
              ))}
            </div>
          )}
        </Section>

        <Section title={t("detail.financeYear")}>
          {detail.monthlyAmountFt != null && (
            <div className="flex justify-between items-baseline">
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontSize: "22px",
                    fontWeight: 500,
                    letterSpacing: "-0.025em",
                  }}
                >
                  {detail.monthlyAmountFt.toLocaleString("hu-HU")}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--color-muted)",
                    marginLeft: "4px",
                  }}
                >
                  Ft/hó
                </span>
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {t("detail.paymentBalance", {
                  paid: detail.paidCommonCostFt.toLocaleString("hu-HU"),
                  total: detail.totalCommonCostFt.toLocaleString("hu-HU"),
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop: "10px" }}>
            {detail.charges.slice(0, 5).reverse().map((c) => (
              <PaymentRow key={c.month} charge={c} />
            ))}
          </div>
        </Section>

        {detail.events.length > 0 && (
          <Section title={t("detail.events")}>
            <Timeline events={detail.events} />
          </Section>
        )}
      </div>

      <div
        className="flex gap-1.5"
        style={{
          padding: "14px 22px",
          background: "var(--color-bg-3)",
          borderTop:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        }}
      >
        <ActionBtn variant="ghost">{t("detail.profileCta")}</ActionBtn>
        <ActionBtn variant="ghost">{t("detail.messageCta")}</ActionBtn>
        {isBoardPlus && (
          <ActionBtn
            variant="primary"
            onClick={() => {
              toast.info(t("detail.editComingSoon"));
              void router; // suppress unused
            }}
          >
            {t("detail.editCta")}
          </ActionBtn>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <h4
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
          marginBottom: "10px",
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

function Fact({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "14px",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          marginTop: "2px",
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              fontWeight: 400,
              marginLeft: "4px",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  t,
}: {
  person: UnitDetailData["occupants"][number];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background:
            person.relationship === "TENANT"
              ? "var(--color-ochre)"
              : "var(--color-moss-2)",
          color:
            person.relationship === "TENANT"
              ? "var(--color-ink)"
              : "#fff",
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 600,
          fontSize: "11px",
        }}
      >
        {person.initials}
      </span>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {person.name}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginTop: "1px",
          }}
        >
          {t(`relationship.${person.relationship}`)}
          {person.isPrimaryContact && ` · ${t("detail.primary")}`}
        </div>
      </div>
    </div>
  );
}

function PaymentRow({
  charge,
}: {
  charge: UnitDetailData["charges"][number];
}) {
  const monthShort = charge.month.split("-")[1] ?? "";
  const monthLabel = ["JAN", "FEB", "MÁR", "ÁPR", "MÁJ", "JÚN", "JÚL", "AUG", "SZE", "OKT", "NOV", "DEC"][
    parseInt(monthShort, 10) - 1
  ] ?? monthShort;
  const fillColor =
    charge.status === "PAID"
      ? "var(--color-good)"
      : charge.status === "OVERDUE"
        ? "var(--color-danger)"
        : "var(--color-ochre)";
  const fillWidth = charge.status === "PAID" ? "100%" : charge.status === "OVERDUE" ? "100%" : "0%";

  return (
    <div
      className="flex items-center gap-2.5"
      style={{ padding: "7px 0", fontSize: "12px" }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          width: "32px",
          letterSpacing: "0.04em",
        }}
      >
        {monthLabel}
      </span>
      <div
        className="flex-1"
        style={{
          height: "6px",
          background: "var(--color-bg-3)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            width: fillWidth,
            height: "100%",
            background: fillColor,
            borderRadius: "3px",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          width: "70px",
          textAlign: "right",
          color: charge.status === "OVERDUE" ? "var(--color-danger)" : "inherit",
        }}
      >
        {charge.amount > 0
          ? charge.amount.toLocaleString("hu-HU")
          : "—"}
      </span>
    </div>
  );
}

function Timeline({
  events,
}: {
  events: UnitDetailData["events"];
}) {
  return (
    <div className="flex flex-col">
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const dotColor =
          e.kind === "payment"
            ? "var(--color-moss-2)"
            : e.kind === "ticket"
              ? "var(--color-ochre)"
              : "color-mix(in srgb, var(--color-ink) 25%, transparent)";
        return (
          <div
            key={i}
            className="flex gap-2.5"
            style={{
              padding: "7px 0",
              position: "relative",
              fontSize: "12px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: dotColor,
                marginTop: "5px",
                flexShrink: 0,
                position: "relative",
                zIndex: 2,
              }}
            />
            {!isLast && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "3px",
                  top: "15px",
                  bottom: "-7px",
                  width: "2px",
                  background:
                    "color-mix(in srgb, var(--color-ink) 6%, transparent)",
                  zIndex: 1,
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--color-ink)",
                  fontWeight: 500,
                }}
              >
                {e.headline}
              </div>
              {e.sub && (
                <div
                  className="font-mono"
                  style={{
                    fontSize: "10px",
                    color: "var(--color-muted)",
                    letterSpacing: "0.04em",
                    marginTop: "1px",
                  }}
                >
                  {e.sub}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionBtn({
  variant,
  onClick,
  children,
}: {
  variant: "ghost" | "primary";
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const styles =
    variant === "primary"
      ? {
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          border: "1px solid var(--color-ink)",
        }
      : {
          background: "var(--color-card)",
          color: "var(--color-ink)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-opacity hover:opacity-90"
      style={{
        flex: 1,
        padding: "8px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 600,
        textAlign: "center",
        cursor: "pointer",
        ...styles,
      }}
    >
      {children}
    </button>
  );
}

