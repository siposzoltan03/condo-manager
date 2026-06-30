import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getFollowups, type FollowupItem } from "@/lib/dashboard-dal";

type Props = { params: Promise<{ locale: string }> };

const PILL: Record<FollowupItem["pill"], { bg: string; fg: string }> = {
  due: { bg: "color-mix(in srgb, var(--color-danger) 14%, transparent)", fg: "var(--color-danger)" },
  soon: { bg: "color-mix(in srgb, var(--color-ochre) 18%, transparent)", fg: "var(--color-ochre)" },
  ok: { bg: "color-mix(in srgb, var(--color-moss) 14%, transparent)", fg: "var(--color-moss)" },
  neutral: { bg: "var(--color-bg-3)", fg: "var(--color-muted)" },
};

/**
 * "Teendőim" — the full follow-up list (the dashboard panel shows a preview).
 * Reuses getFollowups(): Task rows UNIONed with derived signals (overdue
 * charges, unassigned tickets, meetings needing minutes). Read-only; each row
 * links to the module it came from.
 */
export default async function TasksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tc] = await Promise.all([getTranslations("dashboard"), getTranslations("common")]);
  let followups: FollowupItem[] = [];
  try {
    followups = await getFollowups();
  } catch {
    followups = [];
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link
        href={`/${locale}/dashboard`}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {tc("back")}
      </Link>

      <h1 className="font-display text-2xl text-ink mt-4 mb-1" style={{ letterSpacing: "-0.02em" }}>
        {t("myTasks")}
      </h1>
      <p className="font-mono text-[11px] text-muted mb-6">
        {followups.length > 0 ? `${followups.length} ${t("openItems")}` : ""}
      </p>

      {followups.length === 0 ? (
        <p className="text-sm text-muted">{t("emptyTasks")}</p>
      ) : (
        <ul className="space-y-2">
          {followups.map((f) => {
            const pill = PILL[f.pill];
            const inner = (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 bg-card px-4 py-3 transition-colors hover:border-ink/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{f.title}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{f.meta}</p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ background: pill.bg, color: pill.fg }}
                >
                  {f.pillText}
                </span>
              </div>
            );
            return (
              <li key={f.id}>
                {f.href ? (
                  <Link href={`/${locale}${f.href}`} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
