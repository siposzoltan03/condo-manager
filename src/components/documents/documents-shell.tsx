import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
  /** Title soft suffix (e.g. "· archívum"). */
  titleSuffix?: string;
  ledeKey?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export async function DocumentsShell({
  locale,
  titleSuffix,
  ledeKey = "documents.shell.lede",
  headerActions,
  children,
}: Props) {
  const t = await getTranslations({ locale });

  return (
    <div style={{ padding: "32px", maxWidth: "1500px", margin: "0 auto" }}>
      <div
        className="flex flex-wrap justify-between items-end gap-8"
        style={{ marginBottom: "24px" }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "44px",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            {t("documents.shell.title")}
            {titleSuffix && (
              <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
                {" "}
                {titleSuffix}
              </span>
            )}
          </h1>
          <p
            style={{
              color: "var(--color-ink-soft)",
              margin: "8px 0 0",
              maxWidth: "54ch",
            }}
          >
            {t(ledeKey)}
          </p>
        </div>
        {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
      </div>
      {children}
    </div>
  );
}
