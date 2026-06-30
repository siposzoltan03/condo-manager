/**
 * Shared design tokens for all PDF reports (@react-pdf/renderer).
 *
 * react-pdf does NOT support CSS `color-mix()`, gradients, or var() — every
 * value here is a literal so it actually renders. Tints are pre-mixed flat
 * colors. Keep templates on these tokens so the report set stays consistent.
 */

export const color = {
  ink: "#181a1c", // primary text
  inkSoft: "#3c424a", // secondary text
  muted: "#6c727a", // labels / tertiary
  faint: "#9aa0a6", // placeholders
  line: "#ddd8cd", // hairline rules
  lineStrong: "#181a1c", // section rules
  paper: "#ffffff", // page background
  panel: "#f6f3ec", // warm panel / header band
  panelEdge: "#e6e1d5", // panel border

  // Brand + status (with pale tints, pre-mixed for react-pdf)
  ochre: "#a8761c",
  ochreTint: "#f6ecd7",
  positive: "#4a5a3e", // passed / quorate
  positiveTint: "#eaeee2",
  negative: "#9e3b3b", // rejected / not quorate
  negativeTint: "#f4e7e3",
} as const;

export const font = {
  sans: "Manrope",
  mono: "Courier",
} as const;

/** Type scale (pt). */
export const size = {
  title: 22,
  h2: 10.5, // section titles (uppercase, tracked)
  lead: 11,
  body: 10.5,
  small: 9.5,
  micro: 9,
  tiny: 8,
} as const;

export const space = {
  pageX: 56,
  pageTop: 44,
  pageBottom: 64,
} as const;

/** Hungarian labels for vote majority types (PDF is a HU legal doc). */
export const MAJORITY_LABEL: Record<string, string> = {
  SIMPLE_MAJORITY: "Egyszerű többség",
  TWO_THIRDS: "Minősített többség (2/3)",
  FOUR_FIFTHS: "Minősített többség (4/5)",
  UNANIMOUS: "Egyhangúság",
  PLURALITY: "Relatív többség",
};

export function majorityLabel(t: string): string {
  return MAJORITY_LABEL[t] ?? t;
}
