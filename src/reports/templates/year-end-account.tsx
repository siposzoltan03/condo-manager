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
import type { YearEndAccountData } from "@/lib/reports/year-end-account-data";

export interface YearEndAccountPdfProps extends YearEndAccountData {
  generatedAt: Date;
  contentHash: string;
  /**
   * True until the közgyűlés ratifies the year-end report. While true,
   * a 45°-rotated "TERVEZET" watermark is rendered across every page so
   * the document can't be mistaken for the approved version. The
   * approval flow is a follow-up — for now this defaults to `true`
   * unless the worker overrides it.
   */
  isDraft?: boolean;
  /** Approval metadata, surfaced in the header when isDraft=false. */
  approvedAt?: string | null;
  approvedByMeetingTitle?: string | null;
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
    fontSize: 24,
    fontWeight: 500,
    letterSpacing: -0.5,
    lineHeight: 1.2,
    marginBottom: 4,
  },
  buildingLine: {
    fontSize: 11,
    color: "#3a4048",
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "#16181a",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
  },
  kpiRow: {
    flexDirection: "row",
    marginBottom: 16,
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
  kpiValue: { fontSize: 16, fontWeight: 500 },
  kpiSub: { fontSize: 9, color: "#6c727a", marginTop: 2 },
  good: { color: "#4a5a3e" },
  bad: { color: "#a04040" },
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
    paddingTop: 6,
    paddingBottom: 6,
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
  cellName: { flex: 3 },
  cellAmount: { flex: 1, textAlign: "right", fontWeight: 500 },
  cellShare: { flex: 1, textAlign: "right", color: "#6c727a" },
  cellRatio: { flex: 1, textAlign: "right", color: "#6c727a" },
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 8 },
  twoColCell: { flex: 1 },
  miniHeader: {
    fontSize: 9,
    fontWeight: 700,
    color: "#3a4048",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  emptyNote: { fontSize: 10, color: "#9a9c9f" },
  perOwnerRow: {
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
  shareCell: { width: 60, textAlign: "right", color: "#6c727a" },
  amountCell: { width: 90, textAlign: "right" },
  outstandingCell: { width: 90, textAlign: "right" },
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
  watermark: {
    position: "absolute",
    // Visually centred on an A4 page (595×842 pt) with the rotation
    // pivoting around the element's centre. We slide left+down so the
    // text stays in the page after the 45° rotation.
    top: 380,
    left: -40,
    width: 700,
    textAlign: "center",
    fontSize: 110,
    fontWeight: 500,
    letterSpacing: 14,
    color: "#16181a",
    opacity: 0.08,
    transform: "rotate(-30deg)",
  },
  approvedBanner: {
    fontSize: 9.5,
    color: "#4a5a3e",
    backgroundColor: "color-mix(in srgb, #4a5a3e 14%, transparent)",
    padding: 8,
    borderRadius: 5,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: "#4a5a3e",
  },
});

export function YearEndAccountPdf(props: YearEndAccountPdfProps) {
  const isDraft = props.isDraft !== false; // default = draft
  const netStyle = props.netChange >= 0 ? styles.good : styles.bad;
  const closeDeltaStyle =
    props.closingBalance >= props.openingBalance ? styles.good : styles.bad;

  return (
    <Document
      title={`Éves elszámolás — ${props.year}${isDraft ? " (tervezet)" : ""}`}
      author={props.buildingName}
    >
      <Page size="A4" style={styles.page}>
        {isDraft && (
          <Text style={styles.watermark} fixed>
            TERVEZET
          </Text>
        )}

        <Text style={styles.eyebrow}>
          Éves pénzügyi elszámolás{isDraft ? " · tervezet" : ""}
        </Text>
        <Text style={styles.title}>{props.year}. év</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>

        {!isDraft && props.approvedAt && (
          <Text style={styles.approvedBanner}>
            Elfogadva a közgyűlés által{" "}
            {new Date(props.approvedAt).toLocaleDateString("hu-HU")}
            {props.approvedByMeetingTitle
              ? ` · ${props.approvedByMeetingTitle}`
              : ""}
            .
          </Text>
        )}

        {/* TOP-LEVEL KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Nyitó vagyon</Text>
            <Text style={styles.kpiValue}>{formatHUF(props.openingBalance)}</Text>
            <Text style={styles.kpiSub}>Január 1.</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Záró vagyon</Text>
            <Text style={[styles.kpiValue, closeDeltaStyle]}>
              {formatHUF(props.closingBalance)}
            </Text>
            <Text style={styles.kpiSub}>
              Δ {formatHUF(props.closingBalance - props.openingBalance)}
            </Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Éves nettó</Text>
            <Text style={[styles.kpiValue, netStyle]}>
              {formatHUF(props.netChange)}
            </Text>
            <Text style={styles.kpiSub}>
              {formatHUF(props.totalIncome)} bevétel ·{" "}
              {formatHUF(props.totalExpenses)} kiadás
            </Text>
          </View>
        </View>

        {/* ASSETS + LIABILITIES side by side */}
        <View style={styles.twoCol}>
          <View style={styles.twoColCell}>
            <Text style={styles.sectionHeader}>Vagyon</Text>
            {props.assets.length === 0 ? (
              <Text style={styles.emptyNote}>Nincs vagyoni tétel.</Text>
            ) : (
              <View>
                {props.assets.map((a) => (
                  <View key={a.name} style={styles.row}>
                    <Text style={styles.cellName}>{a.name}</Text>
                    <Text style={styles.cellAmount}>{formatHUF(a.balance)}</Text>
                  </View>
                ))}
                <View style={styles.rowTotal}>
                  <Text style={styles.cellName}>Összesen</Text>
                  <Text style={styles.cellAmount}>
                    {formatHUF(
                      props.assets.reduce((s, a) => s + a.balance, 0),
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.twoColCell}>
            <Text style={styles.sectionHeader}>Kötelezettségek</Text>
            {props.liabilities.length === 0 && props.arrears.total === 0 ? (
              <Text style={styles.emptyNote}>Nincs nyitott kötelezettség.</Text>
            ) : (
              <View>
                {props.liabilities.map((l) => (
                  <View key={l.name} style={styles.row}>
                    <Text style={styles.cellName}>{l.name}</Text>
                    <Text style={styles.cellAmount}>{formatHUF(l.balance)}</Text>
                  </View>
                ))}
                {props.arrears.total > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.cellName}>
                      Hátralék · {props.arrears.unitsCount} albetét
                    </Text>
                    <Text style={[styles.cellAmount, styles.bad]}>
                      {formatHUF(props.arrears.total)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* BUDGET vs ACTUAL */}
        <Text style={styles.sectionHeader}>Költségvetés terv vs. tény</Text>
        {props.budget.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs évre rögzített költségvetés.</Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.cellName}>Tétel</Text>
              <Text style={styles.cellAmount}>Tervezett</Text>
              <Text style={styles.cellAmount}>Tényleges</Text>
              <Text style={styles.cellRatio}>Tény/Terv</Text>
            </View>
            {props.budget.map((b) => {
              const overBudget = b.actual > b.planned && b.planned > 0;
              return (
                <View key={b.accountName} style={styles.row}>
                  <Text style={styles.cellName}>{b.accountName}</Text>
                  <Text style={styles.cellAmount}>{formatHUF(b.planned)}</Text>
                  <Text
                    style={[
                      styles.cellAmount,
                      overBudget ? styles.bad : {},
                    ]}
                  >
                    {formatHUF(b.actual)}
                  </Text>
                  <Text
                    style={[
                      styles.cellRatio,
                      overBudget ? styles.bad : {},
                    ]}
                  >
                    {b.planned > 0 ? `${(b.ratio * 100).toFixed(0)}%` : "—"}
                  </Text>
                </View>
              );
            })}
            <View style={styles.rowTotal}>
              <Text style={styles.cellName}>Összesen</Text>
              <Text style={styles.cellAmount}>
                {formatHUF(props.budgetPlannedTotal)}
              </Text>
              <Text style={styles.cellAmount}>
                {formatHUF(props.budgetActualTotal)}
              </Text>
              <Text style={styles.cellRatio}>
                {props.budgetPlannedTotal > 0
                  ? `${((props.budgetActualTotal / props.budgetPlannedTotal) * 100).toFixed(0)}%`
                  : "—"}
              </Text>
            </View>
          </View>
        )}

        {/* EXPENSE CATEGORIES */}
        <Text style={styles.sectionHeader}>Kiadások kategóriánként</Text>
        {props.expenseByCategory.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs kiadás az évben.</Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.cellName}>Kategória</Text>
              <Text style={styles.cellAmount}>Összeg</Text>
              <Text style={styles.cellShare}>Arány</Text>
            </View>
            {props.expenseByCategory.map((c) => {
              const pct =
                props.totalExpenses > 0
                  ? (c.amount / props.totalExpenses) * 100
                  : 0;
              return (
                <View key={c.category} style={styles.row}>
                  <Text style={styles.cellName}>{c.category}</Text>
                  <Text style={[styles.cellAmount, styles.bad]}>
                    {formatHUF(c.amount)}
                  </Text>
                  <Text style={styles.cellShare}>{pct.toFixed(1)}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* REZSI */}
        {props.rezsiBreakdown.length > 0 && (
          <View>
            <Text style={styles.sectionHeader}>
              Rezsi — közüzemi költségek éves bontása
            </Text>
            <View style={styles.rowHeader}>
              <Text style={styles.cellName}>Számla</Text>
              <Text style={styles.cellAmount}>Éves összeg</Text>
            </View>
            {props.rezsiBreakdown.map((r) => (
              <View key={r.name} style={styles.row}>
                <Text style={styles.cellName}>{r.name}</Text>
                <Text style={styles.cellAmount}>{formatHUF(r.amount)}</Text>
              </View>
            ))}
            <View style={styles.rowTotal}>
              <Text style={styles.cellName}>Rezsi összesen</Text>
              <Text style={styles.cellAmount}>
                {formatHUF(
                  props.rezsiBreakdown.reduce((s, r) => s + r.amount, 0),
                )}
              </Text>
            </View>
          </View>
        )}

        {/* PER OWNER */}
        <Text style={styles.sectionHeader} break>
          Tulajdonosi költségmegosztás
        </Text>
        {props.perOwner.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs albetét rögzítve.</Text>
        ) : (
          <View>
            <View
              style={[
                styles.perOwnerRow,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: "#16181a",
                  paddingTop: 0,
                  paddingBottom: 6,
                },
              ]}
            >
              <Text style={[styles.unitCell, styles.kpiLabel]}>Albetét</Text>
              <Text style={[styles.ownerCell, styles.kpiLabel]}>Tulajdonos</Text>
              <Text style={[styles.shareCell, styles.kpiLabel]}>Hányad</Text>
              <Text style={[styles.amountCell, styles.kpiLabel]}>Befizetett</Text>
              <Text style={[styles.outstandingCell, styles.kpiLabel]}>
                Hátralék
              </Text>
            </View>
            {props.perOwner.map((p) => (
              <View key={p.unitNumber} style={styles.perOwnerRow} wrap={false}>
                <Text style={styles.unitCell}>#{p.unitNumber}</Text>
                <Text style={styles.ownerCell}>{p.ownerName}</Text>
                <Text style={styles.shareCell}>
                  {(p.ownershipShare * 100).toFixed(2)}%
                </Text>
                <Text style={styles.amountCell}>
                  {formatHUF(p.annualPaid)}
                </Text>
                <Text
                  style={[
                    styles.outstandingCell,
                    p.outstanding > 0 ? styles.bad : {},
                  ]}
                >
                  {p.outstanding > 0 ? formatHUF(p.outstanding) : "—"}
                </Text>
              </View>
            ))}
            <View style={styles.rowTotal}>
              <Text style={styles.unitCell} />
              <Text style={styles.ownerCell}>Összesen</Text>
              <Text style={styles.shareCell}>
                {(
                  props.perOwner.reduce((s, p) => s + p.ownershipShare, 0) * 100
                ).toFixed(2)}
                %
              </Text>
              <Text style={styles.amountCell}>
                {formatHUF(props.perOwnerTotalPaid)}
              </Text>
              <Text style={styles.outstandingCell}>
                {formatHUF(
                  props.perOwnerTotalBilled - props.perOwnerTotalPaid,
                )}
              </Text>
            </View>
          </View>
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
