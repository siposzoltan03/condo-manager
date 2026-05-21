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

export interface MeetingSummaryPdfProps {
  buildingName: string;
  meeting: {
    id: string;
    title: string;
    description: string | null;
    date: string;
    time: string;
    location: string | null;
    minutes: string | null;
  };
  /** Free-form agenda points (Json) — string-or-{title,description?} per legacy. */
  agenda: Array<{ title: string; description?: string | null }>;
  votes: Array<{
    id: string;
    title: string;
    status: string;
    majorityType: string;
    isSecret: boolean;
    deadline: string;
    passed: boolean | null;
    options: Array<{ id: string; label: string; ballotCount: number; weight: number }>;
    totalEligibleWeight: number;
    totalCastWeight: number;
    ballotCount: number;
  }>;
  pendingItems: Array<{
    id: string;
    kind: "COMPLAINT_ESCALATION" | "BOARD_RESIGNATION";
    title: string;
    description: string | null;
    resolved: boolean;
    resolutionNote: string | null;
  }>;
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
    marginBottom: 4,
  },
  metaLine: {
    fontSize: 10,
    color: "#3a4048",
    marginBottom: 24,
  },
  description: {
    fontSize: 10.5,
    lineHeight: 1.55,
    marginBottom: 20,
    color: "#3a4048",
  },
  sectionHeader: {
    fontSize: 11,
    color: "#16181a",
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
  },
  agendaItem: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 10,
  },
  agendaIndex: {
    width: 18,
    fontWeight: 500,
    color: "#6c727a",
  },
  agendaBody: {
    flex: 1,
  },
  agendaTitle: {
    fontWeight: 500,
    color: "#16181a",
  },
  agendaDesc: {
    fontSize: 9.5,
    color: "#6c727a",
    marginTop: 1,
  },
  voteBlock: {
    marginBottom: 14,
    border: "1pt solid #d4d2cc",
    borderRadius: 6,
    padding: 12,
  },
  voteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  voteTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: "#16181a",
    flex: 1,
  },
  badge: {
    fontSize: 8,
    fontWeight: 700,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  badgePassed: { backgroundColor: "#e0eee0", color: "#4a5a3e" },
  badgeRejected: { backgroundColor: "#f4dada", color: "#a04040" },
  badgePending: { backgroundColor: "#e8e6e1", color: "#6c727a" },
  voteMeta: {
    fontSize: 9,
    color: "#6c727a",
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e6e1",
    borderBottomStyle: "solid",
  },
  optionRowHeader: {
    flexDirection: "row",
    paddingBottom: 4,
    fontSize: 8,
    color: "#6c727a",
    letterSpacing: 1,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
    marginBottom: 2,
  },
  optionLabel: { flex: 3 },
  optionBallots: { flex: 1, textAlign: "right" },
  optionShare: { flex: 1, textAlign: "right" },
  optionPercent: { flex: 1, textAlign: "right", fontWeight: 500 },
  pendingItem: {
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#c89858",
    borderLeftStyle: "solid",
  },
  pendingKind: {
    fontSize: 8,
    color: "#6c727a",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  pendingTitle: {
    fontSize: 11,
    fontWeight: 500,
    color: "#16181a",
  },
  pendingDesc: {
    fontSize: 9.5,
    color: "#3a4048",
    marginTop: 2,
  },
  resolutionNote: {
    fontSize: 9,
    color: "#4a5a3e",
    marginTop: 4,
  },
  minutesBlock: {
    fontSize: 10,
    color: "#3a4048",
    lineHeight: 1.6,
    marginTop: 6,
  },
  emptyNote: {
    fontSize: 10,
    color: "#9a9c9f",
  },
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

const MAJORITY_LABEL: Record<string, string> = {
  SIMPLE_MAJORITY: "egyszerű többség",
  TWO_THIRDS: "kétharmados",
  UNANIMOUS: "egyhangú",
};

const PENDING_KIND_LABEL: Record<string, string> = {
  COMPLAINT_ESCALATION: "Eszkalált panasz",
  BOARD_RESIGNATION: "Lemondás",
};

function VoteBlock({ vote }: { vote: MeetingSummaryPdfProps["votes"][number] }) {
  const isClosed = vote.status === "CLOSED";
  const badgeStyle =
    !isClosed
      ? styles.badgePending
      : vote.passed === true
        ? styles.badgePassed
        : styles.badgeRejected;
  const badgeText =
    !isClosed
      ? "Folyamatban"
      : vote.passed === true
        ? "Elfogadva"
        : "Elutasítva";

  const turnoutPct = vote.totalEligibleWeight
    ? (vote.totalCastWeight / vote.totalEligibleWeight) * 100
    : 0;

  return (
    <View style={styles.voteBlock} wrap={false}>
      <View style={styles.voteHeader}>
        <Text style={styles.voteTitle}>{vote.title}</Text>
        <Text style={[styles.badge, badgeStyle]}>{badgeText}</Text>
      </View>
      <Text style={styles.voteMeta}>
        {MAJORITY_LABEL[vote.majorityType] ?? vote.majorityType}
        {" · részvétel "}
        {formatPercent(turnoutPct)}
        {" · "}
        {formatNumber(vote.ballotCount)} szavazó
        {vote.isSecret ? " · titkos" : ""}
        {" · határidő "}
        {formatDate(vote.deadline)}
      </Text>

      <View style={styles.optionRowHeader}>
        <Text style={styles.optionLabel}>Opció</Text>
        <Text style={styles.optionBallots}>Szavazat</Text>
        <Text style={styles.optionShare}>Hányad</Text>
        <Text style={styles.optionPercent}>Arány</Text>
      </View>
      {vote.options.map((o) => {
        const pctOfCast =
          vote.totalCastWeight > 0
            ? (o.weight / vote.totalCastWeight) * 100
            : 0;
        return (
          <View key={o.id} style={styles.optionRow}>
            <Text style={styles.optionLabel}>{o.label}</Text>
            <Text style={styles.optionBallots}>{formatNumber(o.ballotCount)}</Text>
            <Text style={styles.optionShare}>{formatPercent(o.weight * 100)}</Text>
            <Text style={styles.optionPercent}>{formatPercent(pctOfCast)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function MeetingSummaryPdf(props: MeetingSummaryPdfProps) {
  return (
    <Document
      title={`Közgyűlés összegzés — ${props.meeting.title}`}
      author={props.buildingName}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Közgyűlés összegzés</Text>
        <Text style={styles.title}>{props.meeting.title}</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.metaLine}>
          {formatDate(props.meeting.date)} · {props.meeting.time}
          {props.meeting.location ? ` · ${props.meeting.location}` : ""}
        </Text>

        {props.meeting.description && (
          <Text style={styles.description}>{props.meeting.description}</Text>
        )}

        <Text style={styles.sectionHeader}>Napirend</Text>
        {props.agenda.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs rögzített napirend.</Text>
        ) : (
          props.agenda.map((item, i) => (
            <View key={i} style={styles.agendaItem} wrap={false}>
              <Text style={styles.agendaIndex}>{i + 1}.</Text>
              <View style={styles.agendaBody}>
                <Text style={styles.agendaTitle}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.agendaDesc}>{item.description}</Text>
                )}
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionHeader}>Szavazások</Text>
        {props.votes.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs szavazás a közgyűléshez kötve.</Text>
        ) : (
          props.votes.map((v) => <VoteBlock key={v.id} vote={v} />)
        )}

        {props.pendingItems.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Függőben lévő ügyek</Text>
            {props.pendingItems.map((p) => (
              <View key={p.id} style={styles.pendingItem} wrap={false}>
                <Text style={styles.pendingKind}>
                  {PENDING_KIND_LABEL[p.kind] ?? p.kind}
                  {p.resolved ? " · lezárva" : " · függőben"}
                </Text>
                <Text style={styles.pendingTitle}>{p.title}</Text>
                {p.description && (
                  <Text style={styles.pendingDesc}>{p.description}</Text>
                )}
                {p.resolutionNote && (
                  <Text style={styles.resolutionNote}>
                    Határozat: {p.resolutionNote}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {props.meeting.minutes && (
          <>
            <Text style={styles.sectionHeader}>Jegyzőkönyv</Text>
            <Text style={styles.minutesBlock}>{props.meeting.minutes}</Text>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {props.buildingName} · {formatDateTime(props.generatedAt)} · hash{" "}
            {shortHash(props.contentHash)}
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
