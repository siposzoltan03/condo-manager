import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatNumber,
} from "../lib/format";
import { shortHash } from "../lib/footer";

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
    padding: "48 56 64 56",
    fontSize: 10.5,
    color: "#16181a",
    fontFamily: "Manrope",
    lineHeight: 1.4,
  },
  eyebrow: {
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 500,
    letterSpacing: -0.5,
    lineHeight: 1.25,
    marginBottom: 8,
    color: "#16181a",
  },
  buildingLine: {
    fontSize: 11,
    color: "#3a4048",
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 8,
  },
  description: {
    fontSize: 10.5,
    lineHeight: 1.55,
    marginBottom: 16,
    color: "#3a4048",
  },
  kpiRow: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 8,
  },
  kpiCell: {
    flex: 1,
    border: "1pt solid #d4d2cc",
    borderRadius: 6,
    padding: 12,
  },
  kpiLabel: {
    fontSize: 8,
    color: "#6c727a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 500,
    color: "#16181a",
  },
  kpiSub: {
    fontSize: 9,
    color: "#6c727a",
    marginTop: 2,
  },
  resultRow: {
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d2cc",
    borderBottomStyle: "solid",
  },
  resultRowHeader: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  optionLabel: {
    flex: 3,
  },
  optionBallots: {
    flex: 1,
    textAlign: "right",
  },
  optionShare: {
    flex: 1,
    textAlign: "right",
  },
  optionPercent: {
    flex: 1,
    textAlign: "right",
    fontWeight: 500,
  },
  outcomeBox: {
    marginTop: 28,
    padding: 14,
    border: "1pt solid #d4d2cc",
    borderRadius: 6,
    backgroundColor: "#f6f3ec",
  },
  outcomeLabel: {
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  outcomeValue: {
    fontSize: 14,
    fontWeight: 500,
  },
  outcomePassed: { color: "#4a5a3e" },
  outcomeRejected: { color: "#a04040" },
  outcomePending: { color: "#6c727a" },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9a9c9f",
    letterSpacing: 0.6,
  },
  pageNum: {
    fontFamily: "Courier",
  },
});

export function VoteResultPdf(props: VoteResultPdfProps) {
  const turnoutPct = props.totalEligibleWeight
    ? (props.totalCastWeight / props.totalEligibleWeight) * 100
    : 0;
  const isClosed = props.vote.status === "CLOSED";
  const outcomeText =
    !isClosed
      ? "Folyamatban"
      : props.vote.passed === true
        ? "Elfogadva"
        : props.vote.passed === false
          ? "Elutasítva"
          : "Lezárva";
  const outcomeStyle =
    !isClosed
      ? styles.outcomePending
      : props.vote.passed === true
        ? styles.outcomePassed
        : props.vote.passed === false
          ? styles.outcomeRejected
          : styles.outcomePending;

  return (
    <Document
      title={`Szavazás eredménye — ${props.vote.title}`}
      author={props.buildingName}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Szavazás eredménye</Text>
        <Text style={styles.title}>{props.vote.title}</Text>
        <Text style={styles.buildingLine}>
          {props.buildingName} · határidő{" "}
          {formatDate(props.vote.deadline)}
        </Text>

        {props.vote.description && (
          <>
            <Text style={styles.sectionHeader}>Leírás</Text>
            <Text style={styles.description}>{props.vote.description}</Text>
          </>
        )}

        <View style={styles.kpiRow}>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Jogosult tulajdoni hányad</Text>
            <Text style={styles.kpiValue}>
              {formatPercent(props.totalEligibleWeight * 100)}
            </Text>
            <Text style={styles.kpiSub}>{"100% hányad"}</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Leadott szavazat</Text>
            <Text style={styles.kpiValue}>
              {formatPercent(props.totalCastWeight * 100)}
            </Text>
            <Text style={styles.kpiSub}>
              {formatNumber(props.ballotCount)} szavazó
            </Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Részvétel</Text>
            <Text style={styles.kpiValue}>{formatPercent(turnoutPct)}</Text>
            <Text style={styles.kpiSub}>
              {props.vote.majorityType === "SIMPLE_MAJORITY"
                ? "egyszerű többség"
                : props.vote.majorityType === "TWO_THIRDS"
                  ? "kétharmados"
                  : props.vote.majorityType === "UNANIMOUS"
                    ? "egyhangú"
                    : props.vote.majorityType}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Eredmények opciónként</Text>
        <View style={styles.resultRowHeader}>
          <Text style={styles.optionLabel}>Opció</Text>
          <Text style={styles.optionBallots}>Szavazat</Text>
          <Text style={styles.optionShare}>Hányad</Text>
          <Text style={styles.optionPercent}>Arány</Text>
        </View>
        {props.options.map((o) => {
          const pctOfCast =
            props.totalCastWeight > 0
              ? (o.weight / props.totalCastWeight) * 100
              : 0;
          return (
            <View key={o.id} style={styles.resultRow}>
              <Text style={styles.optionLabel}>{o.label}</Text>
              <Text style={styles.optionBallots}>
                {formatNumber(o.ballotCount)}
              </Text>
              <Text style={styles.optionShare}>
                {formatPercent(o.weight * 100)}
              </Text>
              <Text style={styles.optionPercent}>
                {formatPercent(pctOfCast)}
              </Text>
            </View>
          );
        })}

        <View style={styles.outcomeBox}>
          <Text style={styles.outcomeLabel}>Végeredmény</Text>
          <Text style={[styles.outcomeValue, outcomeStyle]}>{outcomeText}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {props.buildingName} · {formatDateTime(props.generatedAt)} ·
            hash {shortHash(props.contentHash)}
          </Text>
          <Text
            style={styles.pageNum}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
