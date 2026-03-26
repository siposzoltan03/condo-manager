/**
 * Locale-aware relative time formatting using Intl.RelativeTimeFormat.
 */

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.345, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/**
 * Returns a locale-aware "time ago" string (e.g. "3 minutes ago", "2 days ago").
 * Falls back to a locale-formatted absolute date for very old dates.
 */
export function formatTimeAgo(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const now = new Date();
  let seconds = (date.getTime() - now.getTime()) / 1000;

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const division of DIVISIONS) {
    if (Math.abs(seconds) < division.amount) {
      return rtf.format(Math.round(seconds), division.unit);
    }
    seconds /= division.amount;
  }

  return date.toLocaleDateString(locale);
}

/**
 * Locale-aware date separator for message threads.
 * Returns "Today", "Yesterday", or a full date string — all localized.
 */
export function formatDateSeparator(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffDays === 0) return rtf.format(0, "day"); // "today"
  if (diffDays === 1) return rtf.format(-1, "day"); // "yesterday"
  return date.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Locale-aware short time format for conversation list items.
 * Shows time for today, "yesterday" for yesterday, weekday for this week, date otherwise.
 */
export function formatConversationTime(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return rtf.format(-1, "day"); // "yesterday" / "tegnap"
  }
  if (diffDays < 7) {
    return date.toLocaleDateString(locale, { weekday: "short" });
  }
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
