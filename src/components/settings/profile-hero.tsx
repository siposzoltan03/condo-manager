import { getTranslations } from "next-intl/server";
import type { ProfileOverviewData } from "@/lib/profile-dal";

interface Props {
  locale: string;
  data: ProfileOverviewData;
  /** Right-side action buttons (server-rendered links/buttons OK; client islands too). */
  actions?: React.ReactNode;
}

export async function ProfileHero({ locale, data, actions }: Props) {
  const t = await getTranslations({ locale, namespace: "profile" });

  const memberSinceLabel = new Date(data.user.memberSinceISO).toLocaleDateString(
    "hu-HU",
    { year: "numeric", month: "2-digit", day: "2-digit" },
  );

  return (
    <div
      style={{
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        padding: "36px 48px 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient blobs */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: "-80px",
          top: "-80px",
          width: "380px",
          height: "380px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-moss-2) 45%, transparent), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: "120px",
          bottom: "-100px",
          width: "220px",
          height: "220px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-ochre) 35%, transparent), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="flex items-start gap-6"
        style={{ maxWidth: "1200px", margin: "0 auto", position: "relative" }}
      >
        {/* Big avatar */}
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "50%",
            background: "var(--color-ochre)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "30px",
            letterSpacing: "-0.03em",
            border: "3px solid var(--color-bg)",
          }}
        >
          {data.user.initials}
        </span>

        <div className="flex-1 min-w-0">
          <div
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            {t("hero.eyebrow", { date: memberSinceLabel })}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "44px",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            {data.user.name}
          </h1>
          <div
            className="flex flex-wrap gap-1.5"
            style={{ marginTop: "14px" }}
          >
            <RoleChip kind="board">{t(`role.${data.role}`)}</RoleChip>
            {data.units.length > 0 && (
              <RoleChip kind="default">
                {t("hero.unitCount", { n: data.units.length.toString() })}
              </RoleChip>
            )}
            {data.user.emailVerifiedAt && (
              <RoleChip kind="kyc">{t("hero.emailVerified")}</RoleChip>
            )}
          </div>
          <div
            className="flex flex-wrap gap-3.5 font-mono"
            style={{
              marginTop: "18px",
              fontSize: "12px",
              color: "color-mix(in srgb, var(--color-bg) 75%, transparent)",
              letterSpacing: "0.03em",
            }}
          >
            {data.units[0] && (
              <span className="flex items-center gap-1.5">
                📍{" "}
                <b style={{ color: "var(--color-bg)", fontWeight: 600 }}>
                  {data.buildingName} ·{" "}
                  {data.units[0].stairwell ?? ""}
                  {data.units[0].stairwell ? " · " : ""}
                  {data.units[0].number}
                </b>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              ✉{" "}
              <b style={{ color: "var(--color-bg)", fontWeight: 600 }}>
                {data.user.email}
              </b>
            </span>
            {data.user.phone && (
              <span className="flex items-center gap-1.5">
                📱{" "}
                <b style={{ color: "var(--color-bg)", fontWeight: 600 }}>
                  {data.user.phone}
                </b>
              </span>
            )}
          </div>
        </div>

        {actions && <div className="flex gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

function RoleChip({
  kind,
  children,
}: {
  kind: "board" | "default" | "kyc";
  children: React.ReactNode;
}) {
  const tone = {
    board: { bg: "var(--color-moss-2)", color: "#fff" },
    kyc: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    default: {
      bg: "color-mix(in srgb, var(--color-bg) 15%, transparent)",
      color: "var(--color-bg)",
    },
  }[kind];
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "4px 10px",
        borderRadius: "4px",
        background: tone.bg,
        color: tone.color,
        letterSpacing: "0.08em",
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}
