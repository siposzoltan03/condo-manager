import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
  channelCount: number;
  unreadCount: number;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export async function CommunicationShell({
  locale,
  channelCount,
  unreadCount,
  headerActions,
  children,
}: Props) {
  const t = await getTranslations({ locale, namespace: "communication.shell" });

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
            {t("title")}{" "}
            <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
              / {channelCount.toLocaleString("hu-HU")}
            </span>
          </h1>
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
            {t("subtitle", {
              channels: channelCount.toString(),
              unread: unreadCount.toString(),
            })}
          </div>
        </div>
        {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
      </div>

      {children}
    </div>
  );
}
