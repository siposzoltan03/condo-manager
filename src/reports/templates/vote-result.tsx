import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatDate, formatPercent, formatNumber } from "../lib/format";
import { color, font, size, space, majorityLabel } from "../lib/theme";
import { ReportHeader, ReportFooter, SectionTitle, StatusPill } from "../lib/components";

export interface VoteResultPdfProps {
  buildingName: string;
  vote: {
    id: string;
    title: string;
    description: string | null;
    voteType: string;
    majorityType: string;
    isSecret: boolean;
    deadline: string;
    status: string;
    passed: boolean | null;
  };
  options: {
    id: string;
    label: string;
    /** Number of ballots cast for this option. */
    ballotCount: number;
    /** Sum of weights (ownership shares) cast for this option, in [0, 1]. */
    weight: number;
  }[];
  /** Sum of weights of all eligible voters in [0, 1]. */
  totalEligibleWeight: number;
  /** Sum of weights of cast ballots in [0, 1]. */
  totalCastWeight: number;
  ballotCount: number;
  /** Generated-at timestamp + content hash for the footer. */
  generatedAt: Date;
  contentHash: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: space.pageTop,
    paddingBottom: space.pageBottom,
    paddingHorizontal: space.pageX,
    fontSize: size.body,
    color: color.ink,
    fontFamily: font.sans,
    lineHeight: 1.45,
  },

  // Title block
  title: { fontSize: size.title, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 6 },
  buildingLine: { fontSize: size.lead, fontWeight: 500, color: color.inkSoft, marginBottom: 3 },
  meta: { fontSize: size.small, color: color.muted, marginBottom: 14 },

  description: { fontSize: size.body, lineHeight: 1.6, color: color.inkSoft, marginBottom: 4 },

  // KPI cards
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  kpiCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.panelEdge,
    borderStyle: "solid",
    borderRadius: 8,
    padding: 12,
  },
  kpiLabel: {
    fontSize: size.micro,
    color: color.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  kpiValue: { fontSize: 18, fontWeight: 700, color: color.ink },
  kpiSub: { fontSize: size.micro, color: color.muted, marginTop: 2 },

  // Options table
  thRow: {
    flexDirection: "row",
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: color.lineStrong,
    borderBottomStyle: "solid",
    fontSize: size.micro,
    color: color.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: color.line,
    borderBottomStyle: "solid",
    fontSize: size.small,
  },
  trZebra: { backgroundColor: color.panel },
  optLabel: { flex: 3 },
  optBallots: { flex: 1, textAlign: "right" },
  optShare: { flex: 1, textAlign: "right", color: color.muted },
  optPercent: { flex: 1, textAlign: "right", fontWeight: 700 },

  outcomeNote: { marginTop: 16 },
});

export function VoteResultPdf(props: VoteResultPdfProps) {
  const turnoutPct = props.totalEligibleWeight
    ? (props.totalCastWeight / props.totalEligibleWeight) * 100
    : 0;
  const isClosed = props.vote.status === "CLOSED";
  const outcomeText = !isClosed
    ? "Folyamatban"
    : props.vote.passed === true
      ? "Elfogadva"
      : props.vote.passed === false
        ? "Elutasítva"
        : "Lezárva";
  const outcomeTone: "positive" | "negative" | "neutral" = !isClosed
    ? "neutral"
    : props.vote.passed === true
      ? "positive"
      : props.vote.passed === false
        ? "negative"
        : "neutral";

  return (
    <Document title={`Szavazás eredménye — ${props.vote.title}`} author={props.buildingName}>
      <Page size="A4" style={styles.page}>
        <ReportHeader reportType="Szavazási eredmény" />

        {/* Title block */}
        <Text style={styles.title}>{props.vote.title}</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          Határidő · {formatDate(props.vote.deadline)}
          {props.vote.isSecret ? " · titkos szavazás" : ""}
        </Text>

        {/* DESCRIPTION */}
        {props.vote.description && (
          <View>
            <SectionTitle>Leírás</SectionTitle>
            <Text style={styles.description}>{props.vote.description}</Text>
          </View>
        )}

        {/* KPIs */}
        <SectionTitle>Részvétel · határozatképesség</SectionTitle>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Jogosult tulajdoni hányad</Text>
            <Text style={styles.kpiValue}>{formatPercent(props.totalEligibleWeight * 100)}</Text>
            <Text style={styles.kpiSub}>100% hányad</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Leadott szavazat</Text>
            <Text style={styles.kpiValue}>{formatPercent(props.totalCastWeight * 100)}</Text>
            <Text style={styles.kpiSub}>{formatNumber(props.ballotCount)} szavazó</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Részvétel</Text>
            <Text style={styles.kpiValue}>{formatPercent(turnoutPct)}</Text>
            <Text style={styles.kpiSub}>{majorityLabel(props.vote.majorityType)}</Text>
          </View>
        </View>

        {/* OPTIONS */}
        <SectionTitle>Eredmények opciónként</SectionTitle>
        <View style={styles.thRow}>
          <Text style={styles.optLabel}>Opció</Text>
          <Text style={styles.optBallots}>Szavazat</Text>
          <Text style={styles.optShare}>Hányad</Text>
          <Text style={styles.optPercent}>Arány</Text>
        </View>
        {props.options.map((o, i) => {
          const pctOfCast = props.totalCastWeight > 0 ? (o.weight / props.totalCastWeight) * 100 : 0;
          return (
            <View key={o.id} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]} wrap={false}>
              <Text style={styles.optLabel}>{o.label}</Text>
              <Text style={styles.optBallots}>{formatNumber(o.ballotCount)}</Text>
              <Text style={styles.optShare}>{formatPercent(o.weight * 100)}</Text>
              <Text style={styles.optPercent}>{formatPercent(pctOfCast)}</Text>
            </View>
          );
        })}

        {/* OUTCOME */}
        <SectionTitle>Végeredmény</SectionTitle>
        <View style={styles.outcomeNote}>
          <StatusPill tone={outcomeTone}>{outcomeText}</StatusPill>
        </View>

        <ReportFooter
          buildingName={props.buildingName}
          generatedAt={props.generatedAt}
          contentHash={props.contentHash}
        />
      </Page>
    </Document>
  );
}
