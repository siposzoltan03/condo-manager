import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { OnboardingChecklist } from "@/lib/dashboard-dal";

interface Props {
  locale: string;
  checklist: OnboardingChecklist;
}

/**
 * Board onboarding progress card. The dashboard only mounts this while the
 * building setup is incomplete (`checklist.allComplete === false`), so it
 * auto-hides once every step is done.
 */
export async function SetupChecklist({ locale, checklist }: Props) {
  const t = await getTranslations({ locale, namespace: "onboarding.checklist" });
  const pct = Math.round((checklist.doneCount / checklist.total) * 100);

  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ochre) 35%, transparent)",
        borderRadius: "16px",
        padding: "22px 24px",
        marginBottom: "24px",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-ochre)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {t("eyebrow")}
          </div>
          <h2
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "22px",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              marginTop: "4px",
            }}
          >
            {t("title")}
          </h2>
          <p
            style={{
              color: "var(--color-ink-soft)",
              fontSize: "13px",
              margin: "4px 0 0",
              maxWidth: "60ch",
            }}
          >
            {t("subtitle")}
          </p>
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {t("progress", {
            done: checklist.doneCount,
            total: checklist.total,
            pct,
          })}
        </div>
      </div>

      <ul className="grid gap-2" style={{ marginTop: "16px" }}>
        {checklist.items.map((item) => (
          <li key={item.key}>
            <Link
              href={`/${locale}${item.href}`}
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                background: item.done
                  ? "color-mix(in srgb, var(--color-moss) 8%, transparent)"
                  : "var(--color-bg-2)",
                border: item.done
                  ? "1px solid color-mix(in srgb, var(--color-moss) 25%, transparent)"
                  : "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
              }}
            >
              <CheckMark done={item.done} />
              <span
                style={{
                  flex: 1,
                  fontSize: "14px",
                  fontWeight: 500,
                  color: item.done
                    ? "var(--color-ink-soft)"
                    : "var(--color-ink)",
                  textDecoration: item.done ? "line-through" : "none",
                }}
              >
                {t(`items.${item.key}`)}
              </span>
              {!item.done && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--color-ochre)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("action")} →
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckMark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "999px",
        background: done ? "var(--color-moss)" : "transparent",
        border: done
          ? "none"
          : "2px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
        color: "#f5f2e6",
      }}
    >
      {done && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}
