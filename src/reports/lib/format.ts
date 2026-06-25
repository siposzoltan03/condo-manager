/**
 * Hungarian-locale formatters for PDF report templates.
 *
 * All numbers, dates, and percentages in printed reports must match the
 * statutory expectations: thin-space thousands, Forint currency, ISO-8601
 * dates rendered long-form ("2026. március 15.").
 */

const HUF = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 2,
});

const DATE_LONG = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "long",
});

const DATE_SHORT = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
});

const DATETIME = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatHUF(v: number): string {
  return HUF.format(v);
}

export function formatNumber(v: number): string {
  return NUMBER.format(v);
}

/** "2026. március 15." */
export function formatDate(d: Date | string): string {
  return DATE_LONG.format(typeof d === "string" ? new Date(d) : d);
}

/** "2026. 03. 15." */
export function formatDateShort(d: Date | string): string {
  return DATE_SHORT.format(typeof d === "string" ? new Date(d) : d);
}

/** "2026. 03. 15. 14:00" */
export function formatDateTime(d: Date | string): string {
  return DATETIME.format(typeof d === "string" ? new Date(d) : d);
}

/** Ownership share — input is a decimal in [0, 1]. */
export function formatShare(s: number): string {
  return `${(s * 100).toFixed(2).replace(".", ",")}%`;
}

/** Percentage — input is in [0, 100]. */
export function formatPercent(p: number): string {
  return `${p.toFixed(2).replace(".", ",")}%`;
}
