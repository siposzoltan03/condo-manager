"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ResidentCard,
  ResidentGroup,
  ResidentProfileData,
  ResidentsRoleDistribution,
} from "@/lib/residents-dal";
import { PermissionsEditorModal } from "./permissions-editor-modal";
import { ResidentRemovalControls } from "./resident-removal-controls";

interface Props {
  isBoardPlus: boolean;
  isAdmin: boolean;
  groups: {
    key: ResidentGroup;
    title: string;
    subtitle: string;
    cards: ResidentCard[];
  }[];
  distribution: ResidentsRoleDistribution;
  tabCounts: {
    all: number;
    owners: number;
    tenants: number;
    board: number;
    partners: number;
  };
}

type SubTab = "all" | "owners" | "tenants" | "board" | "partners";

export function ResidentsExplorer({ groups, distribution, tabCounts, isAdmin }: Props) {
  const t = useTranslations("residents");

  const [tab, setTab] = useState<SubTab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const firstResident = groups
      .flatMap((g) => g.cards)
      .find((c) => c.kind === "resident");
    return firstResident?.id ?? null;
  });
  const [profile, setProfile] = useState<ResidentProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoadingProfile(true);
    fetch(`/api/residents/${selectedId}/profile`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, refreshKey]);

  // Filter groups by sub-tab + search
  const visibleGroups = groups
    .map((g) => {
      const cards = g.cards.filter((c) => {
        if (
          tab === "owners" &&
          (g.key !== "owners" && !(g.key === "board" && c.unitRelationship === "OWNER"))
        )
          return false;
        if (tab === "tenants" && c.unitRelationship !== "TENANT") return false;
        if (tab === "board" && g.key !== "board") return false;
        if (tab === "partners" && g.key !== "partners") return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !c.name.toLowerCase().includes(q) &&
            !(c.unitNumber ?? "").toLowerCase().includes(q) &&
            !c.metaLine.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      });
      return { ...g, cards };
    })
    .filter((g) => g.cards.length > 0);

  return (
    <>
      {/* Role distribution bar */}
      <RoleBar distribution={distribution} />

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
        {(["all", "owners", "tenants", "board", "partners"] as SubTab[]).map(
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

      {/* Search */}
      <div style={{ marginBottom: "18px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          style={{
            width: "100%",
            maxWidth: "420px",
            padding: "8px 12px",
            fontSize: "13px",
            color: "var(--color-ink)",
            background: "var(--color-card)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "8px",
            outline: "none",
          }}
        />
      </div>

      {/* Main grid — stacks on phone/tablet. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="min-w-0">
          {visibleGroups.length === 0 ? (
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
              {t("emptyDirectory")}
            </div>
          ) : (
            visibleGroups.map((g) => (
              <ResidentGroupSection
                key={g.key}
                title={g.title}
                subtitle={g.subtitle}
                cards={g.cards}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))
          )}
        </div>

        <ProfilePanel
          profile={profile}
          loading={loadingProfile}
          isAdmin={isAdmin}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </>
  );
}

function RoleBar({
  distribution,
}: {
  distribution: ResidentsRoleDistribution;
}) {
  const t = useTranslations("residents");
  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{ marginBottom: "12px" }}
      >
        <div
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "26px",
            fontWeight: 500,
            letterSpacing: "-0.025em",
          }}
        >
          {distribution.total}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {t("registered")}
        </div>
      </div>
      <div
        className="flex overflow-hidden"
        style={{
          height: "10px",
          borderRadius: "999px",
          background:
            "color-mix(in srgb, var(--color-ink) 5%, transparent)",
        }}
      >
        {distribution.segments.map((s) => (
          <span
            key={s.group}
            style={{
              width: `${s.pct}%`,
              background: s.color,
            }}
          />
        ))}
      </div>
      <div
        className="flex flex-wrap gap-3 font-mono"
        style={{
          marginTop: "12px",
          fontSize: "11px",
          color: "var(--color-ink-soft)",
          letterSpacing: "0.04em",
        }}
      >
        {distribution.segments.map((s) => (
          <span key={s.group} className="flex items-center gap-1.5">
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                background: s.color,
              }}
            />
            <b style={{ fontWeight: 600, color: "var(--color-ink)" }}>
              {s.label}
            </b>
            {s.count}
            <span style={{ color: "var(--color-muted)" }}>· {s.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ResidentGroupSection({
  title,
  subtitle,
  cards,
  selectedId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  cards: ResidentCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <div
        className="flex items-baseline gap-2.5"
        style={{ marginBottom: "12px" }}
      >
        <h3
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "18px",
            fontWeight: 600,
            letterSpacing: "-0.015em",
          }}
        >
          {title}
        </h3>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </span>
        <span
          aria-hidden
          style={{
            flex: 1,
            borderTop:
              "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
            marginLeft: "8px",
          }}
        />
      </div>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        }}
      >
        {cards.map((c) => (
          <ResidentCardView
            key={c.id}
            card={c}
            selected={c.id === selectedId}
            onClick={() => c.kind === "resident" && onSelect(c.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ResidentCardView({
  card,
  selected,
  onClick,
}: {
  card: ResidentCard;
  selected: boolean;
  onClick: () => void;
}) {
  const isPartner = card.kind === "partner";
  const avBg =
    card.group === "board"
      ? "#3a5a78"
      : card.unitRelationship === "TENANT"
        ? "var(--color-ochre)"
        : isPartner
          ? "color-mix(in srgb, var(--color-ink) 12%, transparent)"
          : "var(--color-moss-2)";
  const avColor =
    card.unitRelationship === "TENANT"
      ? "var(--color-ink)"
      : isPartner
        ? "var(--color-ink)"
        : "#fff";

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition-shadow hover:shadow"
      style={{
        background: "var(--color-card)",
        border: selected
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "14px",
        cursor: card.kind === "resident" ? "pointer" : "default",
        outline: selected ? "2px solid var(--color-ink)" : "none",
        outlineOffset: "1px",
        opacity: card.kind === "resident" ? 1 : 0.95,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: avBg,
            color: avColor,
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "12px",
          }}
        >
          {card.initials}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="truncate"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            {card.name}
          </div>
          <div
            className="font-mono truncate"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginTop: "2px",
            }}
          >
            {card.metaLine}
          </div>
        </div>
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        style={{ marginTop: "10px" }}
      >
        {card.tags.map((tg, i) => {
          const tone =
            tg.kind === "owe"
              ? {
                  bg: "var(--color-danger-soft)",
                  color: "var(--color-danger)",
                }
              : tg.kind === "board"
                ? {
                    bg: "color-mix(in srgb, #3a5a78 22%, transparent)",
                    color: "#3a5a78",
                  }
                : {
                    bg: "color-mix(in srgb, var(--color-ink) 7%, transparent)",
                    color: "var(--color-ink-soft)",
                  };
          return (
            <span
              key={i}
              className="font-mono"
              style={{
                fontSize: "9px",
                padding: "2px 6px",
                borderRadius: "3px",
                background: tone.bg,
                color: tone.color,
                letterSpacing: "0.05em",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {tg.text}
            </span>
          );
        })}
      </div>
      <div
        className="flex justify-between items-baseline"
        style={{
          marginTop: "10px",
          paddingTop: "10px",
          borderTop:
            "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        <span className="font-mono uppercase">{card.footerLabel}</span>
        <span
          className="font-mono truncate"
          style={{
            fontWeight: 600,
            color: card.hasOverdue ? "var(--color-danger)" : "var(--color-ink)",
            maxWidth: "60%",
            textTransform: card.kind === "resident" ? "none" : "uppercase",
            textAlign: "right",
          }}
        >
          {card.footerValue}
        </span>
      </div>
    </button>
  );
}

function ProfilePanel({
  profile,
  loading,
  isAdmin,
  onChanged,
}: {
  profile: ResidentProfileData | null;
  loading: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("residents");
  const [permsOpen, setPermsOpen] = useState(false);

  if (!profile || loading) {
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
        {loading ? t("profile.loading") : t("profile.empty")}
      </aside>
    );
  }

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
      {/* Hero */}
      <div
        style={{
          padding: "20px 22px 16px",
          background: "var(--color-ink)",
          color: "var(--color-bg)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center flex-shrink-0"
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "var(--color-ochre)",
              color: "var(--color-ink)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 600,
              fontSize: "18px",
            }}
          >
            {profile.initials}
          </span>
          <div className="min-w-0">
            <h2
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "22px",
                fontWeight: 500,
                letterSpacing: "-0.025em",
                color: "var(--color-bg)",
              }}
            >
              {profile.name}
            </h2>
            <div
              className="flex flex-wrap gap-1.5"
              style={{ marginTop: "6px" }}
            >
              {profile.roleBadges.map((r, i) => (
                <span
                  key={i}
                  className="font-mono"
                  style={{
                    fontSize: "9px",
                    padding: "2px 7px",
                    borderRadius: "3px",
                    background:
                      i === 0
                        ? "var(--color-moss-2)"
                        : "color-mix(in srgb, var(--color-bg) 12%, transparent)",
                    color: i === 0 ? "#fff" : "var(--color-bg)",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {r}
                </span>
              ))}
              {profile.isCurrentUser && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: "9px",
                    padding: "2px 7px",
                    borderRadius: "3px",
                    background:
                      "color-mix(in srgb, var(--color-bg) 18%, transparent)",
                    color: "var(--color-bg)",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {t("profile.you")}
                </span>
              )}
            </div>
          </div>
        </div>
        {profile.unitNumber && (
          <div
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "color-mix(in srgb, var(--color-bg) 75%, transparent)",
              letterSpacing: "0.04em",
              marginTop: "12px",
            }}
          >
            📍 {profile.unitStairwell ?? ""}
            {profile.unitStairwell ? " · " : ""}
            {profile.unitNumber}
            {profile.unitSize ? ` · ${Math.round(profile.unitSize)} m²` : ""}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "18px 22px 22px" }}>
        <Section title={t("profile.contact")}>
          <KvList
            items={[
              { k: t("profile.email"), v: profile.email ?? "—" },
              {
                k: t("profile.language"),
                v: profile.language === "hu" ? "Magyar" : "English",
              },
            ]}
          />
        </Section>

        {profile.household.length > 0 && (
          <Section title={t("profile.household")}>
            <div className="flex flex-col gap-2">
              {profile.household.map((h) => (
                <div key={h.id} className="flex items-center gap-2.5">
                  <span
                    className="grid place-items-center flex-shrink-0"
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      background:
                        h.relationship === "TENANT"
                          ? "var(--color-ochre)"
                          : "var(--color-moss-2)",
                      color:
                        h.relationship === "TENANT"
                          ? "var(--color-ink)"
                          : "#fff",
                      fontFamily: "var(--font-space-grotesk), sans-serif",
                      fontWeight: 600,
                      fontSize: "10px",
                    }}
                  >
                    {h.initials}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>
                      {h.name}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: "10px",
                        color: "var(--color-muted)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {h.relationship === "OWNER"
                        ? t("profile.ownerRel")
                        : t("profile.tenantRel")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title={t("profile.participation")}>
          {/* eslint-disable-next-line responsive/mobile-first -- compact 3-stat panel: short numeric values fit ~110px tiles at 360px */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label={t("profile.votes")}
              value={profile.votingCount.toString()}
              total={profile.votingPossible.toString()}
              tone={
                profile.votingPossible > 0 &&
                profile.votingCount === profile.votingPossible
                  ? "good"
                  : undefined
              }
            />
            <Stat
              label={t("profile.meetings")}
              value={profile.meetingsAttended.toString()}
              total={profile.meetingsPossible.toString()}
            />
            <Stat
              label={t("profile.outstanding")}
              value={profile.outstandingFt.toLocaleString("hu-HU")}
              suffix="Ft"
              tone={profile.outstandingFt > 0 ? "danger" : undefined}
            />
          </div>
        </Section>

        {profile.events.length > 0 && (
          <Section title={t("profile.activity")}>
            <div className="flex flex-col">
              {profile.events.map((e, i) => (
                <div
                  key={i}
                  className="flex gap-2.5"
                  style={{ padding: "7px 0", fontSize: "12px" }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background:
                        e.kind === "ballot"
                          ? "var(--color-moss-2)"
                          : e.kind === "comment"
                            ? "var(--color-ochre)"
                            : "color-mix(in srgb, var(--color-ink) 25%, transparent)",
                      marginTop: "5px",
                      flexShrink: 0,
                    }}
                  />
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
                    <div
                      className="font-mono"
                      style={{
                        fontSize: "10px",
                        color: "var(--color-muted)",
                        letterSpacing: "0.04em",
                        marginTop: "1px",
                      }}
                    >
                      {new Date(e.at).toLocaleDateString("hu-HU", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {isAdmin && profile.kind === "resident" && (
          <div
            className="flex justify-end"
            style={{
              padding: "14px 22px",
              background: "var(--color-bg-3)",
              borderTop:
                "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          >
            <button
              type="button"
              onClick={() => setPermsOpen(true)}
              className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                background: "var(--color-card)",
                color: "var(--color-ink)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                cursor: "pointer",
              }}
            >
              {t("permissions.managerCta")}
            </button>
          </div>
        )}
        <ResidentRemovalControls profile={profile} onChanged={onChanged} />
      </div>
      <PermissionsEditorModal
        open={permsOpen}
        residentId={profile.id}
        onClose={() => setPermsOpen(false)}
      />
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

function KvList({ items }: { items: { k: string; v: string }[] }) {
  return (
    <dl style={{ margin: 0 }}>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex justify-between gap-3"
          style={{ padding: "5px 0", fontSize: "12.5px" }}
        >
          <dt
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {it.k}
          </dt>
          <dd style={{ margin: 0, textAlign: "right", fontWeight: 500 }}>
            {it.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({
  label,
  value,
  total,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  total?: string;
  suffix?: string;
  tone?: "good" | "danger";
}) {
  const valueColor =
    tone === "good"
      ? "var(--color-good)"
      : tone === "danger"
        ? "var(--color-danger)"
        : "var(--color-ink)";
  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: "9px",
          color: "var(--color-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "18px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: valueColor,
          marginTop: "2px",
          lineHeight: 1.1,
        }}
      >
        {value}
        {total && (
          <small
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              fontWeight: 400,
              marginLeft: "1px",
            }}
          >
            /{total}
          </small>
        )}
        {suffix && (
          <small
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              fontWeight: 400,
              marginLeft: "3px",
            }}
          >
            {suffix}
          </small>
        )}
      </div>
    </div>
  );
}
