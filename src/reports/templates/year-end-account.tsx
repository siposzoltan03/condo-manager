import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatHUF } from "../lib/format";
import { color, font, size, space } from "../lib/theme";
import { ReportHeader, ReportFooter, SectionTitle, StatusPill } from "../lib/components";
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

  kpiRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  kpiCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.panelEdge,
    borderStyle: "solid",
    borderRadius: 8,
    padding: 12,
  },
  kpiLabel: {
    fontSize: size.tiny,
    color: color.muted,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  kpiValue: { fontSize: 16, fontWeight: 700 },
  kpiSub: { fontSize: size.micro, color: color.muted, marginTop: 2 },
  good: { color: color.positive },
  bad: { color: color.negative },

  // Tables
  rowHeader: {
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
  row: {
    flexDirection: "row",
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: color.line,
    borderBottomStyle: "solid",
    fontSize: size.small,
  },
  rowTotal: {
    flexDirection: "row",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: color.lineStrong,
    borderTopStyle: "solid",
    marginTop: 2,
  },
  cellName: { flex: 3 },
  cellAmount: { flex: 1, textAlign: "right", fontWeight: 500 },
  cellShare: { flex: 1, textAlign: "right", color: color.muted },
  cellRatio: { flex: 1, textAlign: "right", color: color.muted },
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 8 },
  twoColCell: { flex: 1 },

  emptyNote: { fontSize: size.small, color: color.faint },
  perOwnerRow: {
    flexDirection: "row",
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: color.line,
    borderBottomStyle: "solid",
    fontSize: size.small,
  },
  unitCell: { width: 50 },
  ownerCell: { flex: 2 },
  shareCell: { width: 60, textAlign: "right", color: color.muted },
  amountCell: { width: 90, textAlign: "right" },
  outstandingCell: { width: 90, textAlign: "right" },
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
    color: color.ink,
    opacity: 0.08,
    transform: "rotate(-30deg)",
  },
  approvedBanner: {
    fontSize: size.small,
    color: color.positive,
    backgroundColor: color.positiveTint,
    padding: 8,
    borderRadius: 5,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: color.positive,
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

        <ReportHeader reportType="Éves elszámolás" />

        {/* Title block */}
        <Text style={styles.title}>{props.year}. év</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          Éves pénzügyi elszámolás{isDraft ? " · tervezet" : ""}
        </Text>

        {isDraft ? (
          <StatusPill tone="warning">Tervezet · a közgyűlés jóváhagyásáig</StatusPill>
        ) : (
          <StatusPill tone="positive">Elfogadva a közgyűlés által</StatusPill>
        )}

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
            <SectionTitle>Vagyon</SectionTitle>
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
            <SectionTitle>Kötelezettségek</SectionTitle>
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
        <SectionTitle>Költségvetés terv vs. tény</SectionTitle>
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
        <SectionTitle>Kiadások kategóriánként</SectionTitle>
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
            <SectionTitle>Rezsi — közüzemi költségek éves bontása</SectionTitle>
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
        <SectionTitle breakBefore>Tulajdonosi költségmegosztás</SectionTitle>
        {props.perOwner.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs albetét rögzítve.</Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.unitCell}>Albetét</Text>
              <Text style={styles.ownerCell}>Tulajdonos</Text>
              <Text style={styles.shareCell}>Hányad</Text>
              <Text style={styles.amountCell}>Befizetett</Text>
              <Text style={styles.outstandingCell}>Hátralék</Text>
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

        <ReportFooter
          buildingName={props.buildingName}
          generatedAt={props.generatedAt}
          contentHash={props.contentHash}
        />
      </Page>
    </Document>
  );
}
