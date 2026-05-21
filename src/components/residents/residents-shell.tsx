import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
  totalCount: number;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export async function ResidentsShell({
  locale,
  totalCount,
  subtitle,
  headerActions,
  children,
}: Props) {
  const t = await getTranslations({ locale, namespace: "residents" });

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: "1580px", margin: "0 auto" }}>
      <div
        className="flex flex-wrap justify-between items-end gap-8"
        style={{ marginBottom: "22px" }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "40px",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            {t("shell.title")}{" "}
            <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
              / {totalCount.toLocaleString("hu-HU")}
            </span>
          </h1>
          {subtitle && (
            <div
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: "8px",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
      </div>

      {children}
    </div>
  );
}
