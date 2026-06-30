import * as React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { color, font, size, space } from "./theme";
import { shortHash } from "./footer";
import { formatDateTime } from "./format";

const s = StyleSheet.create({
  // ── Brand wordmark ──────────────────────────────────────────────
  wordmark: { flexDirection: "row", alignItems: "center" },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: color.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  markLetter: { color: color.paper, fontSize: 13, fontWeight: 700, lineHeight: 1 },
  wordmarkText: { marginLeft: 8 },
  wordmarkName: { fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: color.ink, lineHeight: 1 },
  wordmarkTag: {
    fontSize: 6.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: color.muted,
    marginTop: 2,
  },

  // ── Header band ─────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: color.ink,
    borderBottomStyle: "solid",
  },
  headerRight: { alignItems: "flex-end" },
  reportType: {
    fontSize: size.micro,
    fontWeight: 700,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: color.ochre,
  },
  reportRef: { fontSize: size.tiny, color: color.muted, marginTop: 2 },

  // ── Section title ───────────────────────────────────────────────
  section: {
    fontSize: size.h2,
    fontWeight: 700,
    color: color.ink,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 9,
    paddingBottom: 4,
    borderBottomWidth: 0.75,
    borderBottomColor: color.line,
    borderBottomStyle: "solid",
  },

  // ── Status pill ─────────────────────────────────────────────────
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3, marginRight: 6 },
  pillText: { fontSize: size.micro, fontWeight: 700, letterSpacing: 0.3 },

  // ── Footer ──────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 30,
    left: space.pageX,
    right: space.pageX,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: color.line,
    borderTopStyle: "solid",
    fontSize: size.tiny,
    color: color.faint,
    letterSpacing: 0.5,
  },
  pageNum: { fontFamily: font.mono },
});

/** Brand mark: dark rounded "K" + "Közös" wordmark + tagline. */
export function Wordmark() {
  return (
    <View style={s.wordmark}>
      <View style={s.mark}>
        <Text style={s.markLetter}>K</Text>
      </View>
      <View style={s.wordmarkText}>
        <Text style={s.wordmarkName}>Közös</Text>
        <Text style={s.wordmarkTag}>társasházkezelés</Text>
      </View>
    </View>
  );
}

/** Branded report header band: wordmark left, report type right. */
export function ReportHeader({ reportType, reportRef }: { reportType: string; reportRef?: string }) {
  return (
    <View style={s.header} fixed>
      <Wordmark />
      <View style={s.headerRight}>
        <Text style={s.reportType}>{reportType}</Text>
        {reportRef ? <Text style={s.reportRef}>{reportRef}</Text> : null}
      </View>
    </View>
  );
}

export function SectionTitle({ children, breakBefore }: { children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <Text style={s.section} break={breakBefore}>
      {children}
    </Text>
  );
}

type Tone = "positive" | "negative" | "neutral" | "warning";
const TONE: Record<Tone, { bg: string; fg: string }> = {
  positive: { bg: color.positiveTint, fg: color.positive },
  negative: { bg: color.negativeTint, fg: color.negative },
  warning: { bg: color.ochreTint, fg: color.ochre },
  neutral: { bg: color.panel, fg: color.muted },
};

/** Small status pill — replaces the old full-width banners. */
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = TONE[tone];
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <View style={[s.pillDot, { backgroundColor: c.fg }]} />
      <Text style={[s.pillText, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

export function ReportFooter({
  buildingName,
  generatedAt,
  contentHash,
}: {
  buildingName: string;
  generatedAt: Date;
  contentHash: string;
}) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {buildingName} · {formatDateTime(generatedAt)} · hash {shortHash(contentHash)}
      </Text>
      <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}
