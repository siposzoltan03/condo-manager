import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
  titleKey: string;
  ledeKey: string;
}

/** Generic "Hamarosan" empty state for the voting tabs we haven't redesigned yet. */
export async function VotingStubEmpty({ locale, titleKey, ledeKey }: Props) {
  const t = await getTranslations({ locale, namespace: "voting.stub" });

  return (
    <div
      style={{
        padding: "64px 32px",
        textAlign: "center",
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
      }}
    >
      <div
        className="grid place-items-center mx-auto"
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
          color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
          marginBottom: "18px",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" />
          <rect x="9" y="3" width="6" height="8" rx="1" />
        </svg>
      </div>
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "24px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          marginBottom: "10px",
        }}
      >
        {t(titleKey)}
      </h2>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "14px",
          maxWidth: "44ch",
          margin: "0 auto",
          lineHeight: 1.55,
        }}
      >
        {t(ledeKey)}
      </p>
      <span
        className="font-mono inline-block"
        style={{
          marginTop: "20px",
          fontSize: "10px",
          padding: "4px 10px",
          borderRadius: "5px",
          background: "var(--color-ochre)",
          color: "var(--color-ink)",
          letterSpacing: "0.08em",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {t("comingSoon")}
      </span>
    </div>
  );
}
