import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatDate, formatPercent, formatNumber } from "../lib/format";
import { color, font, size, space, majorityLabel } from "../lib/theme";
import { ReportHeader, ReportFooter, SectionTitle, StatusPill } from "../lib/components";
import type { MinutesData } from "@/lib/reports/minutes-data";

export interface MinutesPdfProps extends MinutesData {
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

  // Tables (attendance + options share the look)
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
  attUnit: { width: 52 },
  attOwner: { flex: 2 },
  attShare: { width: 70, textAlign: "right", color: color.muted },
  attCheck: { width: 70, textAlign: "right", color: color.muted, fontSize: size.micro },
  totalRow: { flexDirection: "row", paddingTop: 6, borderTopWidth: 1, borderTopColor: color.lineStrong, marginTop: 2 },
  quorumNote: { marginTop: 10 },

  // Resolution card
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
  cardKicker: { fontSize: size.micro, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: color.muted },
  cardBody: { paddingHorizontal: 12, paddingVertical: 10 },
  resTitle: { fontSize: 12, fontWeight: 700, marginBottom: 3 },
  resDesc: { fontSize: size.small, color: color.inkSoft, marginBottom: 7, lineHeight: 1.5 },
  resMeta: { fontSize: size.micro, color: color.muted, marginBottom: 7 },
  optRow: { flexDirection: "row", paddingVertical: 2.5 },
  optLabel: { flex: 3 },
  optVotes: { flex: 1, textAlign: "right" },
  optWeight: { flex: 1, textAlign: "right" },
  optShare: { flex: 1, textAlign: "right", color: color.muted },
  resFooter: { marginTop: 8, paddingTop: 7, borderTopWidth: 0.5, borderTopColor: color.line, fontSize: size.small },

  passed: { color: color.positive, fontWeight: 700 },
  rejected: { color: color.negative, fontWeight: 700 },
  pending: { color: color.muted },

  // Signatures
  sigGrid: { flexDirection: "row", gap: 10, marginTop: 4 },
  sigCell: { flex: 1, borderWidth: 1, borderColor: color.panelEdge, borderStyle: "solid", borderRadius: 8, padding: 12, minHeight: 92 },
  sigRole: { fontSize: size.micro, color: color.muted, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 8 },
  sigName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  sigDate: { fontSize: size.micro, color: color.muted },
  sigPlaceholder: { fontSize: size.small, color: color.faint },
  sigLine: { marginTop: 26, borderTopWidth: 0.5, borderTopColor: color.ink, borderTopStyle: "solid" },

  empty: { fontSize: size.small, color: color.faint },
  prose: { fontSize: size.body, lineHeight: 1.6, color: color.inkSoft },
});

const ROLE_LABEL: Record<string, string> = {
  CHAIR: "Levezető elnök",
  AUTHENTICATOR_1: "Hitelesítő 1.",
  AUTHENTICATOR_2: "Hitelesítő 2.",
};

export function MinutesPdf(props: MinutesPdfProps) {
  const signedCount = props.signatures.filter((sig) => sig.signerName).length;

  return (
    <Document title={`Jegyzőkönyv — ${props.meeting.title}`} author={props.buildingName}>
      <Page size="A4" style={styles.page}>
        <ReportHeader reportType="Közgyűlési jegyzőkönyv" reportRef="Tht. § 39" />

        {/* Title block */}
        <Text style={styles.title}>{props.meeting.title}</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          {formatDate(props.meeting.date)} · {props.meeting.time}
          {props.meeting.location ? ` · ${props.meeting.location}` : ""}
          {props.meeting.isRepeated ? " · megismételt közgyűlés" : ""}
        </Text>

        {props.isExecuted ? (
          <StatusPill tone="positive">Hitelesítve · mindhárom aláírás rögzítve</StatusPill>
        ) : (
          <StatusPill tone="warning">{`Tervezet · ${signedCount}/3 aláírás — a három aláírással válik hitelessé`}</StatusPill>
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
                {item.description ? <Text style={styles.agendaDesc}>{item.description}</Text> : null}
              </View>
            </View>
          ))
        )}

        {/* ATTENDANCE */}
        <SectionTitle>Jelenléti ív · határozatképesség</SectionTitle>
        {props.attendance.length === 0 ? (
          <Text style={styles.empty}>Nincs rögzített megjelent tulajdonos.</Text>
        ) : (
          <View>
            <View style={styles.thRow}>
              <Text style={styles.attUnit}>Albetét</Text>
              <Text style={styles.attOwner}>Tulajdonos</Text>
              <Text style={styles.attShare}>Hányad</Text>
              <Text style={styles.attCheck}>Érkeztetés</Text>
            </View>
            {props.attendance.map((a, i) => (
              <View key={a.unitNumber} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]} wrap={false}>
                <Text style={styles.attUnit}>#{a.unitNumber}</Text>
                <Text style={styles.attOwner}>{a.ownerName}</Text>
                <Text style={styles.attShare}>{(a.ownershipShare * 100).toFixed(2)}%</Text>
                <Text style={styles.attCheck}>
                  {new Date(a.checkedInAt).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.attUnit} />
              <Text style={[styles.attOwner, { fontWeight: 700 }]}>
                Megjelent · {formatNumber(props.attendance.length)} albetét
              </Text>
              <Text style={[styles.attShare, { color: color.ink, fontWeight: 700 }]}>
                {formatPercent(props.totalAttendingShare * 100)}
              </Text>
              <Text style={styles.attCheck} />
            </View>
            <View style={styles.quorumNote}>
              <StatusPill tone={props.isQuorate ? "positive" : "negative"}>
                {props.isQuorate
                  ? props.meeting.isRepeated
                    ? "Határozatképes — megismételt közgyűlés (Tht. § 38(3))"
                    : "Határozatképes — a tulajdoni hányadok több mint 50%-a jelen"
                  : "Határozatképtelen — érdemi döntés nem hozható"}
              </StatusPill>
            </View>
          </View>
        )}

        {/* RESOLUTIONS */}
        <SectionTitle>Határozatok</SectionTitle>
        {props.resolutions.length === 0 ? (
          <Text style={styles.empty}>Nincs határozat ehhez a közgyűléshez kötve.</Text>
        ) : (
          props.resolutions.map((r, i) => (
            <View key={r.id} style={styles.card} wrap={false}>
              <View style={styles.cardHead}>
                <Text style={styles.cardKicker}>
                  {i + 1}. határozat{r.isSecret ? " · titkos" : ""}
                </Text>
                <Text
                  style={r.passed === true ? styles.passed : r.passed === false ? styles.rejected : styles.pending}
                >
                  {r.passed === true ? "Elfogadva" : r.passed === false ? "Elutasítva" : "Nincs eredmény"}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.resTitle}>{r.title}</Text>
                {r.description ? <Text style={styles.resDesc}>{r.description}</Text> : null}
                <Text style={styles.resMeta}>
                  {majorityLabel(r.majorityType)} · {formatNumber(r.ballotCount)} szavazat ·{" "}
                  {formatPercent(r.totalCastWeight * 100)} hányad
                </Text>
                {r.options.map((o) => {
                  const pct = r.totalCastWeight > 0 ? (o.weight / r.totalCastWeight) * 100 : 0;
                  return (
                    <View key={o.id} style={styles.optRow}>
                      <Text style={styles.optLabel}>{o.label}</Text>
                      <Text style={styles.optVotes}>{formatNumber(o.ballotCount)}</Text>
                      <Text style={styles.optWeight}>{formatPercent(o.weight * 100)}</Text>
                      <Text style={styles.optShare}>{pct.toFixed(1)}%</Text>
                    </View>
                  );
                })}
                <Text
                  style={[
                    styles.resFooter,
                    r.passed === true ? styles.passed : r.passed === false ? styles.rejected : styles.pending,
                  ]}
                >
                  {r.statutoryNote}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* MINUTES PROSE */}
        {props.meeting.minutes ? (
          <View>
            <SectionTitle>Jegyzőkönyv szöveg</SectionTitle>
            <Text style={styles.prose}>{props.meeting.minutes}</Text>
          </View>
        ) : null}

        {/* SIGNATURES */}
        <SectionTitle breakBefore>Aláírások · Tht. § 39</SectionTitle>
        <View style={styles.sigGrid}>
          {props.signatures.map((sig) => (
            <View key={sig.role} style={styles.sigCell}>
              <Text style={styles.sigRole}>{ROLE_LABEL[sig.role]}</Text>
              {sig.signerName ? (
                <View>
                  <Text style={styles.sigName}>{sig.signerName}</Text>
                  <Text style={styles.sigDate}>
                    {sig.signedAt
                      ? new Date(sig.signedAt).toLocaleDateString("hu-HU", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : ""}
                  </Text>
                  {sig.ipAddress ? <Text style={styles.sigDate}>IP: {sig.ipAddress}</Text> : null}
                </View>
              ) : (
                <View>
                  <Text style={styles.sigPlaceholder}>(aláírásra vár)</Text>
                  <View style={styles.sigLine} />
                </View>
              )}
            </View>
          ))}
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
