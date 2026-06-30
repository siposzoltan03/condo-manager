import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatHUF } from "../lib/format";
import { color, font, size, space } from "../lib/theme";
import { ReportHeader, ReportFooter, SectionTitle } from "../lib/components";
import type { UtilityStatementData } from "@/lib/reports/utility-statement-data";

export interface UtilityStatementPdfProps extends UtilityStatementData {
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

  legalNote: {
    fontSize: size.small,
    color: color.inkSoft,
    backgroundColor: color.panel,
    padding: 10,
    borderRadius: 6,
    marginBottom: 4,
    lineHeight: 1.5,
  },

  // Tables
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
  totalRow: {
    flexDirection: "row",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: color.lineStrong,
    marginTop: 2,
    fontSize: size.small,
  },

  // Per-utility columns
  utilName: { flex: 3 },
  utilAmount: { flex: 1.2, textAlign: "right", fontWeight: 500 },
  utilPrev: { flex: 1.2, textAlign: "right", color: color.muted },
  utilDelta: { flex: 1, textAlign: "right" },

  // Per-unit columns
  unitCell: { width: 50 },
  ownerCell: { flex: 2 },
  shareCell: { width: 70, textAlign: "right", color: color.muted },
  allocCell: { width: 100, textAlign: "right", fontWeight: 500 },

  good: { color: color.positive },
  bad: { color: color.negative },
  empty: { fontSize: size.small, color: color.faint },

  postingNote: {
    position: "absolute",
    bottom: 50,
    left: space.pageX,
    right: space.pageX,
    fontSize: size.tiny,
    color: color.muted,
    fontWeight: 500,
    textAlign: "center",
  },
});

export function UtilityStatementPdf(props: UtilityStatementPdfProps) {
  const totalDeltaPct =
    props.totalPrevAmount > 0
      ? ((props.totalAmount - props.totalPrevAmount) / props.totalPrevAmount) *
        100
      : null;

  return (
    <Document
      title={`Rezsicsökkentési kimutatás — ${props.period.label}`}
      author={props.buildingName}
    >
      <Page size="A4" style={styles.page}>
        <ReportHeader reportType="Rezsi kimutatás" reportRef="Tht. § 43/A" />

        {/* Title block */}
        <Text style={styles.title}>{props.period.label}</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          Tárgyhónap: {props.period.label} · referencia: {props.prevPeriod.label}
        </Text>

        <Text style={styles.legalNote}>
          A 2003. évi CXXXIII. törvény (Tht.) 43/A. §-a alapján a társasház
          közös költségéből finanszírozott közüzemi szolgáltatások havi
          költségeit a hirdetőtáblán legalább 45 napig ki kell függeszteni.
          Ez a kimutatás ezen jogszabályi kötelezettséget szolgálja.
        </Text>

        {/* Per-utility table */}
        <SectionTitle>Közüzemi költségek</SectionTitle>
        {props.utilities.length === 0 ? (
          <Text style={styles.empty}>
            Nincs közüzemi tétel a tárgyhónapban.
          </Text>
        ) : (
          <View>
            <View style={styles.thRow}>
              <Text style={styles.utilName}>Szolgáltatás</Text>
              <Text style={styles.utilAmount}>{props.period.label}</Text>
              <Text style={styles.utilPrev}>{props.prevPeriod.label}</Text>
              <Text style={styles.utilDelta}>Δ</Text>
            </View>
            {props.utilities.map((u, i) => {
              const deltaStyle =
                u.deltaPct === null
                  ? null
                  : u.deltaPct > 0
                    ? styles.bad
                    : u.deltaPct < 0
                      ? styles.good
                      : null;
              return (
                <View key={u.name} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]}>
                  <Text style={styles.utilName}>{u.name}</Text>
                  <Text style={styles.utilAmount}>{formatHUF(u.amount)}</Text>
                  <Text style={styles.utilPrev}>
                    {u.prevAmount > 0 ? formatHUF(u.prevAmount) : "—"}
                  </Text>
                  <Text
                    style={[
                      styles.utilDelta,
                      ...(deltaStyle ? [deltaStyle] : []),
                    ]}
                  >
                    {u.deltaPct === null
                      ? "—"
                      : `${u.deltaPct > 0 ? "+" : ""}${u.deltaPct.toFixed(1)}%`}
                  </Text>
                </View>
              );
            })}
            <View style={styles.totalRow}>
              <Text style={[styles.utilName, { fontWeight: 700 }]}>Összesen</Text>
              <Text style={[styles.utilAmount, { fontWeight: 700 }]}>
                {formatHUF(props.totalAmount)}
              </Text>
              <Text style={styles.utilPrev}>
                {props.totalPrevAmount > 0
                  ? formatHUF(props.totalPrevAmount)
                  : "—"}
              </Text>
              <Text
                style={[
                  styles.utilDelta,
                  { fontWeight: 700 },
                  ...(totalDeltaPct === null
                    ? []
                    : totalDeltaPct > 0
                      ? [styles.bad]
                      : totalDeltaPct < 0
                        ? [styles.good]
                        : []),
                ]}
              >
                {totalDeltaPct === null
                  ? "—"
                  : `${totalDeltaPct > 0 ? "+" : ""}${totalDeltaPct.toFixed(1)}%`}
              </Text>
            </View>
          </View>
        )}

        {/* Per-unit allocation */}
        <SectionTitle>
          Albetétenkénti megosztás · tulajdoni hányad szerint
        </SectionTitle>
        {props.perUnit.length === 0 || props.totalAmount === 0 ? (
          <Text style={styles.empty}>
            Nincs megosztandó összeg vagy nincs albetét rögzítve.
          </Text>
        ) : (
          <View>
            <View style={styles.thRow}>
              <Text style={styles.unitCell}>Albetét</Text>
              <Text style={styles.ownerCell}>Tulajdonos</Text>
              <Text style={styles.shareCell}>Hányad</Text>
              <Text style={styles.allocCell}>Havi rezsi</Text>
            </View>
            {props.perUnit.map((p, i) => (
              <View key={p.unitNumber} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]} wrap={false}>
                <Text style={styles.unitCell}>#{p.unitNumber}</Text>
                <Text style={styles.ownerCell}>{p.ownerName}</Text>
                <Text style={styles.shareCell}>
                  {(p.ownershipShare * 100).toFixed(2)}%
                </Text>
                <Text style={styles.allocCell}>{formatHUF(p.allocation)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.unitCell} />
              <Text style={[styles.ownerCell, { fontWeight: 700 }]}>Összesen</Text>
              <Text style={styles.shareCell}>
                {(
                  props.perUnit.reduce(
                    (s, p) => s + p.ownershipShare,
                    0,
                  ) * 100
                ).toFixed(2)}
                %
              </Text>
              <Text style={[styles.allocCell, { fontWeight: 700 }]}>
                {formatHUF(
                  props.perUnit.reduce((s, p) => s + p.allocation, 0),
                )}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.postingNote} fixed>
          Hirdetőtáblán kifüggesztve · Tht. § 43/A · legalább 45 napig
        </Text>

        <ReportFooter
          buildingName={props.buildingName}
          generatedAt={props.generatedAt}
          contentHash={props.contentHash}
        />
      </Page>
    </Document>
  );
}
