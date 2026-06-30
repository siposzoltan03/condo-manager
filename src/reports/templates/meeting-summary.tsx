import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatDate, formatPercent, formatNumber } from "../lib/format";
import { color, font, size, space, majorityLabel } from "../lib/theme";
import { ReportHeader, ReportFooter, SectionTitle, StatusPill } from "../lib/components";

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
  description: { fontSize: size.body, lineHeight: 1.55, marginBottom: 8, color: color.inkSoft },

  // Agenda
  agendaItem: { flexDirection: "row", marginBottom: 7 },
  agendaIndex: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.panel,
    color: color.ochre,
    fontSize: size.micro,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.55,
    marginRight: 9,
  },
  agendaTitle: { fontWeight: 500 },
  agendaDesc: { fontSize: size.small, color: color.muted, marginTop: 1 },

  // Vote card
  card: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: color.panelEdge,
    borderStyle: "solid",
    borderRadius: 8,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: color.panel,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  voteTitle: { fontSize: 12, fontWeight: 700, flex: 1, marginRight: 10 },
  cardBody: { paddingHorizontal: 12, paddingVertical: 10 },
  voteMeta: { fontSize: size.micro, color: color.muted, marginBottom: 7 },

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
    marginBottom: 2,
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
  optVotes: { flex: 1, textAlign: "right" },
  optShare: { flex: 1, textAlign: "right" },
  optPercent: { flex: 1, textAlign: "right", fontWeight: 500 },

  // Pending items
  pendingItem: {
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: color.ochre,
    borderLeftStyle: "solid",
  },
  pendingKind: {
    fontSize: size.micro,
    color: color.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  pendingTitle: { fontSize: 11, fontWeight: 500 },
  pendingDesc: { fontSize: size.small, color: color.inkSoft, marginTop: 2 },
  resolutionNote: { fontSize: size.micro, color: color.positive, marginTop: 4 },

  minutesBlock: { fontSize: size.body, lineHeight: 1.6, color: color.inkSoft, marginTop: 6 },
  empty: { fontSize: size.small, color: color.faint },
});

const PENDING_KIND_LABEL: Record<string, string> = {
  COMPLAINT_ESCALATION: "Eszkalált panasz",
  BOARD_RESIGNATION: "Lemondás",
};

function VoteBlock({ vote }: { vote: MeetingSummaryPdfProps["votes"][number] }) {
  const isClosed = vote.status === "CLOSED";
  const tone = !isClosed ? "neutral" : vote.passed === true ? "positive" : "negative";
  const badgeText = !isClosed ? "Folyamatban" : vote.passed === true ? "Elfogadva" : "Elutasítva";

  const turnoutPct = vote.totalEligibleWeight
    ? (vote.totalCastWeight / vote.totalEligibleWeight) * 100
    : 0;

  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardHead}>
        <Text style={styles.voteTitle}>{vote.title}</Text>
        <StatusPill tone={tone}>{badgeText}</StatusPill>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.voteMeta}>
          {majorityLabel(vote.majorityType)}
          {" · részvétel "}
          {formatPercent(turnoutPct)}
          {" · "}
          {formatNumber(vote.ballotCount)} szavazó
          {vote.isSecret ? " · titkos" : ""}
          {" · határidő "}
          {formatDate(vote.deadline)}
        </Text>

        <View style={styles.thRow}>
          <Text style={styles.optLabel}>Opció</Text>
          <Text style={styles.optVotes}>Szavazat</Text>
          <Text style={styles.optShare}>Hányad</Text>
          <Text style={styles.optPercent}>Arány</Text>
        </View>
        {vote.options.map((o, i) => {
          const pctOfCast =
            vote.totalCastWeight > 0 ? (o.weight / vote.totalCastWeight) * 100 : 0;
          return (
            <View key={o.id} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]}>
              <Text style={styles.optLabel}>{o.label}</Text>
              <Text style={styles.optVotes}>{formatNumber(o.ballotCount)}</Text>
              <Text style={styles.optShare}>{formatPercent(o.weight * 100)}</Text>
              <Text style={styles.optPercent}>{formatPercent(pctOfCast)}</Text>
            </View>
          );
        })}
      </View>
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
        <ReportHeader reportType="Közgyűlési összefoglaló" />

        {/* Title block */}
        <Text style={styles.title}>{props.meeting.title}</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          {formatDate(props.meeting.date)} · {props.meeting.time}
          {props.meeting.location ? ` · ${props.meeting.location}` : ""}
        </Text>

        {props.meeting.description && (
          <Text style={styles.description}>{props.meeting.description}</Text>
        )}

        {/* AGENDA */}
        <SectionTitle>Napirend</SectionTitle>
        {props.agenda.length === 0 ? (
          <Text style={styles.empty}>Nincs rögzített napirend.</Text>
        ) : (
          props.agenda.map((item, i) => (
            <View key={i} style={styles.agendaItem} wrap={false}>
              <Text style={styles.agendaIndex}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.agendaTitle}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.agendaDesc}>{item.description}</Text>
                )}
              </View>
            </View>
          ))
        )}

        {/* VOTES */}
        <SectionTitle>Szavazások</SectionTitle>
        {props.votes.length === 0 ? (
          <Text style={styles.empty}>Nincs szavazás a közgyűléshez kötve.</Text>
        ) : (
          props.votes.map((v) => <VoteBlock key={v.id} vote={v} />)
        )}

        {/* PENDING ITEMS */}
        {props.pendingItems.length > 0 && (
          <>
            <SectionTitle>Függőben lévő ügyek</SectionTitle>
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

        {/* MINUTES */}
        {props.meeting.minutes && (
          <>
            <SectionTitle>Jegyzőkönyv</SectionTitle>
            <Text style={styles.minutesBlock}>{props.meeting.minutes}</Text>
          </>
        )}

        <ReportFooter
          buildingName={props.buildingName}
          generatedAt={props.generatedAt}
          contentHash={props.contentHash}
        />
      </Page>
    </Document>
  );
}
