import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatHUF, formatDateTime } from "../lib/format";
import { shortHash } from "../lib/footer";
import type { UtilityStatementData } from "@/lib/reports/utility-statement-data";

export interface UtilityStatementPdfProps extends UtilityStatementData {
  generatedAt: Date;
  contentHash: string;
}

const styles = StyleSheet.create({
  page: {
    padding: "48 56 76 56",
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
    marginBottom: 4,
  },
  buildingLine: {
    fontSize: 11,
    color: "#3a4048",
    marginBottom: 4,
  },
  meta: { fontSize: 10, color: "#3a4048", marginBottom: 18 },
  legalNote: {
    fontSize: 9,
    color: "#3a4048",
    backgroundColor: "#f6f3ec",
    padding: 10,
    borderRadius: 5,
    marginBottom: 18,
    lineHeight: 1.5,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "#16181a",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
  },
  rowHeader: {
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
  row: {
    flexDirection: "row",
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d2cc",
    borderBottomStyle: "solid",
  },
  rowTotal: {
    flexDirection: "row",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#16181a",
    borderTopStyle: "solid",
    marginTop: 4,
  },
  utilName: { flex: 3 },
  utilAmount: { flex: 1.2, textAlign: "right", fontWeight: 500 },
  utilPrev: { flex: 1.2, textAlign: "right", color: "#6c727a" },
  utilDelta: { flex: 1, textAlign: "right" },
  perUnitRow: {
    flexDirection: "row",
    paddingTop: 5,
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d2cc",
    borderBottomStyle: "solid",
    fontSize: 9.5,
  },
  unitCell: { width: 50 },
  ownerCell: { flex: 2 },
  shareCell: { width: 70, textAlign: "right", color: "#6c727a" },
  allocCell: { width: 100, textAlign: "right", fontWeight: 500 },
  good: { color: "#4a5a3e" },
  bad: { color: "#a04040" },
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
  postingNote: {
    position: "absolute",
    bottom: 50,
    left: 56,
    right: 56,
    fontSize: 8.5,
    color: "#3a4048",
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
        <Text style={styles.eyebrow}>Rezsicsökkentési kimutatás</Text>
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
        <Text style={styles.sectionHeader}>Közüzemi költségek</Text>
        {props.utilities.length === 0 ? (
          <Text style={styles.emptyNote}>
            Nincs közüzemi tétel a tárgyhónapban.
          </Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.utilName}>Szolgáltatás</Text>
              <Text style={styles.utilAmount}>{props.period.label}</Text>
              <Text style={styles.utilPrev}>{props.prevPeriod.label}</Text>
              <Text style={styles.utilDelta}>Δ</Text>
            </View>
            {props.utilities.map((u) => {
              const deltaStyle =
                u.deltaPct === null
                  ? null
                  : u.deltaPct > 0
                    ? styles.bad
                    : u.deltaPct < 0
                      ? styles.good
                      : null;
              return (
                <View key={u.name} style={styles.row}>
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
            <View style={styles.rowTotal}>
              <Text style={styles.utilName}>Összesen</Text>
              <Text style={styles.utilAmount}>
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
        <Text style={styles.sectionHeader}>
          Albetétenkénti megosztás · tulajdoni hányad szerint
        </Text>
        {props.perUnit.length === 0 || props.totalAmount === 0 ? (
          <Text style={styles.emptyNote}>
            Nincs megosztandó összeg vagy nincs albetét rögzítve.
          </Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.unitCell}>Albetét</Text>
              <Text style={styles.ownerCell}>Tulajdonos</Text>
              <Text style={styles.shareCell}>Hányad</Text>
              <Text style={styles.allocCell}>Havi rezsi</Text>
            </View>
            {props.perUnit.map((p) => (
              <View key={p.unitNumber} style={styles.perUnitRow} wrap={false}>
                <Text style={styles.unitCell}>#{p.unitNumber}</Text>
                <Text style={styles.ownerCell}>{p.ownerName}</Text>
                <Text style={styles.shareCell}>
                  {(p.ownershipShare * 100).toFixed(2)}%
                </Text>
                <Text style={styles.allocCell}>{formatHUF(p.allocation)}</Text>
              </View>
            ))}
            <View style={styles.rowTotal}>
              <Text style={styles.unitCell} />
              <Text style={styles.ownerCell}>Összesen</Text>
              <Text style={styles.shareCell}>
                {(
                  props.perUnit.reduce(
                    (s, p) => s + p.ownershipShare,
                    0,
                  ) * 100
                ).toFixed(2)}
                %
              </Text>
              <Text style={styles.allocCell}>
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
