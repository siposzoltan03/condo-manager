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
import type { MinutesData } from "@/lib/reports/minutes-data";

export interface MinutesPdfProps extends MinutesData {
  generatedAt: Date;
  contentHash: string;
}

const styles = StyleSheet.create({
  page: {
    padding: "48 56 64 56",
    fontSize: 10.5,
    color: "#16181a",
    fontFamily: "Manrope",
    lineHeight: 1.45,
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
    marginBottom: 6,
  },
  buildingLine: {
    fontSize: 11,
    color: "#3a4048",
    marginBottom: 4,
  },
  meta: { fontSize: 10, color: "#3a4048", marginBottom: 14 },
  draftBanner: {
    fontSize: 9,
    color: "#a04040",
    backgroundColor: "color-mix(in srgb, #a04040 14%, transparent)",
    padding: 8,
    borderRadius: 5,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: "#a04040",
  },
  executedBanner: {
    fontSize: 9,
    color: "#4a5a3e",
    backgroundColor: "color-mix(in srgb, #4a5a3e 14%, transparent)",
    padding: 8,
    borderRadius: 5,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: "#4a5a3e",
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "#16181a",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
  },
  miniHeader: {
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  agendaItem: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 10,
  },
  agendaIndex: { width: 18, color: "#6c727a", fontWeight: 500 },
  agendaTitle: { fontWeight: 500 },
  agendaDesc: { fontSize: 9.5, color: "#6c727a", marginTop: 1 },
  attendRowHeader: {
    flexDirection: "row",
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  attendRow: {
    flexDirection: "row",
    paddingTop: 5,
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d2cc",
    borderBottomStyle: "solid",
    fontSize: 9.5,
  },
  attendUnit: { width: 50 },
  attendOwner: { flex: 2 },
  attendShare: { width: 70, textAlign: "right", color: "#6c727a" },
  attendCheckin: { width: 80, textAlign: "right", color: "#6c727a", fontSize: 9 },
  attendTotalRow: {
    flexDirection: "row",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#16181a",
    marginTop: 4,
  },
  resolutionBox: {
    marginBottom: 14,
    border: "1pt solid #d4d2cc",
    borderRadius: 6,
    padding: 12,
  },
  resolutionTitle: {
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 4,
  },
  resolutionDesc: {
    fontSize: 10,
    color: "#3a4048",
    marginBottom: 6,
    lineHeight: 1.5,
  },
  resolutionMeta: {
    fontSize: 9,
    color: "#6c727a",
    marginBottom: 6,
  },
  optionRow: {
    flexDirection: "row",
    paddingTop: 3,
    paddingBottom: 3,
  },
  optionLabel: { flex: 3 },
  optionVotes: { flex: 1, textAlign: "right" },
  optionWeight: { flex: 1, textAlign: "right" },
  optionShare: { flex: 1, textAlign: "right", color: "#6c727a" },
  resolutionFooter: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#d4d2cc",
    fontSize: 9.5,
  },
  passed: { color: "#4a5a3e", fontWeight: 500 },
  rejected: { color: "#a04040", fontWeight: 500 },
  pending: { color: "#6c727a" },
  signatureGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  signatureCell: {
    flex: 1,
    border: "1pt solid #d4d2cc",
    borderRadius: 6,
    padding: 12,
    minHeight: 90,
  },
  sigRoleLabel: {
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sigName: { fontSize: 11, fontWeight: 500, marginBottom: 4 },
  sigDate: { fontSize: 9, color: "#6c727a" },
  sigPlaceholder: { fontSize: 10, color: "#9a9c9f" },
  sigLine: {
    marginTop: 28,
    borderTopWidth: 0.5,
    borderTopColor: "#16181a",
    borderTopStyle: "solid",
  },
  emptyNote: { fontSize: 10, color: "#9a9c9f" },
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
  pageNum: { fontFamily: "Courier" },
});

const ROLE_LABEL: Record<string, string> = {
  CHAIR: "Levezető elnök",
  AUTHENTICATOR_1: "Hitelesítő 1.",
  AUTHENTICATOR_2: "Hitelesítő 2.",
};

export function MinutesPdf(props: MinutesPdfProps) {
  return (
    <Document
      title={`Jegyzőkönyv — ${props.meeting.title}`}
      author={props.buildingName}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Közgyűlési jegyzőkönyv · Tht. § 39</Text>
        <Text style={styles.title}>{props.meeting.title}</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          {formatDate(props.meeting.date)} · {props.meeting.time}
          {props.meeting.location ? ` · ${props.meeting.location}` : ""}
          {props.meeting.isRepeated ? " · megismételt közgyűlés" : ""}
        </Text>

        {props.isExecuted ? (
          <Text style={styles.executedBanner}>
            Hitelesítve · mindhárom aláírás rögzítve. A jegyzőkönyv jogi
            erővel bír.
          </Text>
        ) : (
          <Text style={styles.draftBanner}>
            Tervezet · {props.signatures.filter((s) => s.signerName).length}/3
            aláírás rögzítve. A jegyzőkönyv csak a három aláírással válik
            hitelessé.
          </Text>
        )}

        {/* AGENDA */}
        <Text style={styles.sectionHeader}>Napirend</Text>
        {props.agenda.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs rögzített napirend.</Text>
        ) : (
          props.agenda.map((item, i) => (
            <View key={i} style={styles.agendaItem} wrap={false}>
              <Text style={styles.agendaIndex}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.agendaTitle}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.agendaDesc}>{item.description}</Text>
                )}
              </View>
            </View>
          ))
        )}

        {/* ATTENDANCE */}
        <Text style={styles.sectionHeader}>Jelenléti ív · határozatképesség</Text>
        {props.attendance.length === 0 ? (
          <Text style={styles.emptyNote}>
            Nincs rögzített megjelent tulajdonos.
          </Text>
        ) : (
          <View>
            <View style={styles.attendRowHeader}>
              <Text style={styles.attendUnit}>Albetét</Text>
              <Text style={styles.attendOwner}>Tulajdonos</Text>
              <Text style={styles.attendShare}>Hányad</Text>
              <Text style={styles.attendCheckin}>Érkeztetés</Text>
            </View>
            {props.attendance.map((a) => (
              <View key={a.unitNumber} style={styles.attendRow} wrap={false}>
                <Text style={styles.attendUnit}>#{a.unitNumber}</Text>
                <Text style={styles.attendOwner}>{a.ownerName}</Text>
                <Text style={styles.attendShare}>
                  {(a.ownershipShare * 100).toFixed(2)}%
                </Text>
                <Text style={styles.attendCheckin}>
                  {new Date(a.checkedInAt).toLocaleTimeString("hu-HU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ))}
            <View style={styles.attendTotalRow}>
              <Text style={styles.attendUnit} />
              <Text style={[styles.attendOwner, { fontWeight: 500 }]}>
                Megjelent · {formatNumber(props.attendance.length)} albetét
              </Text>
              <Text
                style={[
                  styles.attendShare,
                  { color: "#16181a", fontWeight: 500 },
                ]}
              >
                {formatPercent(props.totalAttendingShare * 100)}
              </Text>
              <Text style={styles.attendCheckin} />
            </View>
            <Text
              style={[
                styles.resolutionFooter,
                props.isQuorate ? styles.passed : styles.rejected,
              ]}
            >
              {props.isQuorate
                ? `Határozatképes — ${
                    props.meeting.isRepeated
                      ? "megismételt közgyűlés (Tht. § 38(3) szerint)"
                      : "a tulajdoni hányadok több mint 50%-a jelen van"
                  }.`
                : "Határozatképtelen — érdemi döntés nem hozható."}
            </Text>
          </View>
        )}

        {/* RESOLUTIONS */}
        <Text style={styles.sectionHeader}>Határozatok</Text>
        {props.resolutions.length === 0 ? (
          <Text style={styles.emptyNote}>
            Nincs határozat ehhez a közgyűléshez kötve.
          </Text>
        ) : (
          props.resolutions.map((r, i) => (
            <View key={r.id} style={styles.resolutionBox} wrap={false}>
              <Text style={styles.miniHeader}>
                {i + 1}. határozat{r.isSecret ? " · titkos szavazás" : ""}
              </Text>
              <Text style={styles.resolutionTitle}>{r.title}</Text>
              {r.description && (
                <Text style={styles.resolutionDesc}>{r.description}</Text>
              )}
              <Text style={styles.resolutionMeta}>
                Szükséges többség: {r.majorityType} ·{" "}
                {formatNumber(r.ballotCount)} szavazat ·{" "}
                {formatPercent(r.totalCastWeight * 100)} hányad
              </Text>
              {r.options.map((o) => {
                const pct =
                  r.totalCastWeight > 0
                    ? (o.weight / r.totalCastWeight) * 100
                    : 0;
                return (
                  <View key={o.id} style={styles.optionRow}>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                    <Text style={styles.optionVotes}>
                      {formatNumber(o.ballotCount)}
                    </Text>
                    <Text style={styles.optionWeight}>
                      {formatPercent(o.weight * 100)}
                    </Text>
                    <Text style={styles.optionShare}>{pct.toFixed(1)}%</Text>
                  </View>
                );
              })}
              <Text
                style={[
                  styles.resolutionFooter,
                  r.passed === true
                    ? styles.passed
                    : r.passed === false
                      ? styles.rejected
                      : styles.pending,
                ]}
              >
                {r.statutoryNote}
              </Text>
            </View>
          ))
        )}

        {/* MINUTES BLOB */}
        {props.meeting.minutes && (
          <View>
            <Text style={styles.sectionHeader}>Jegyzőkönyv szöveg</Text>
            <Text style={{ fontSize: 10, lineHeight: 1.6, color: "#3a4048" }}>
              {props.meeting.minutes}
            </Text>
          </View>
        )}

        {/* SIGNATURES */}
        <Text style={styles.sectionHeader} break>
          Aláírások · Tht. § 39
        </Text>
        <View style={styles.signatureGrid}>
          {props.signatures.map((s) => (
            <View key={s.role} style={styles.signatureCell}>
              <Text style={styles.sigRoleLabel}>{ROLE_LABEL[s.role]}</Text>
              {s.signerName ? (
                <View>
                  <Text style={styles.sigName}>{s.signerName}</Text>
                  <Text style={styles.sigDate}>
                    {s.signedAt
                      ? new Date(s.signedAt).toLocaleDateString("hu-HU", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : ""}
                  </Text>
                  {s.ipAddress && (
                    <Text style={styles.sigDate}>IP: {s.ipAddress}</Text>
                  )}
                </View>
              ) : (
                <View>
                  <Text style={styles.sigPlaceholder}>(aláírásra vár)</Text>
                  <Text style={styles.sigLine} />
                </View>
              )}
            </View>
          ))}
        </View>

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
