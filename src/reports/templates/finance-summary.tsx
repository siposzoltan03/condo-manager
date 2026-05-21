import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  formatHUF,
  formatDateTime,
  formatNumber,
} from "../lib/format";
import { shortHash } from "../lib/footer";
import type { FinanceSummaryData } from "@/lib/reports/finance-summary-data";

export interface FinanceSummaryPdfProps extends FinanceSummaryData {
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
  subtitle: {
    fontSize: 11,
    color: "#3a4048",
    marginBottom: 4,
  },
  meta: {
    fontSize: 10,
    color: "#3a4048",
    marginBottom: 24,
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
  kpiValue: {
    fontSize: 16,
    fontWeight: 500,
  },
  kpiSub: {
    fontSize: 9,
    color: "#6c727a",
    marginTop: 2,
  },
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
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d2cc",
    borderBottomStyle: "solid",
  },
  category: { flex: 3 },
  amount: { flex: 1, textAlign: "right", fontWeight: 500 },
  share: { flex: 1, textAlign: "right", color: "#6c727a" },
  topRow: {
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d2cc",
    borderBottomStyle: "solid",
  },
  topDate: { width: 60, color: "#6c727a", fontSize: 9 },
  topDesc: { flex: 1 },
  topCategory: { width: 90, color: "#6c727a", fontSize: 9 },
  topAmount: { width: 80, textAlign: "right", fontWeight: 500 },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 5,
  },
  trendLabel: {
    width: 60,
    fontSize: 9,
    color: "#6c727a",
  },
  trendBars: {
    flex: 1,
    flexDirection: "column",
    gap: 2,
  },
  trendBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendBarLabel: {
    width: 26,
    fontSize: 7.5,
    color: "#6c727a",
    textTransform: "uppercase",
  },
  trendBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#f3eee5",
    borderRadius: 3,
  },
  trendBarFill: {
    height: 6,
    borderRadius: 3,
  },
  trendNet: {
    width: 80,
    textAlign: "right",
    fontSize: 9,
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
  pageNum: { fontFamily: "Courier" },
});

export function FinanceSummaryPdf(props: FinanceSummaryPdfProps) {
  const netStyle = props.netChange >= 0 ? styles.good : styles.bad;
  const closeDeltaStyle =
    props.closingBalance >= props.openingBalance ? styles.good : styles.bad;

  const trendMaxIncome = Math.max(...props.monthlyTrend.map((t) => t.income), 1);
  const trendMaxExpense = Math.max(
    ...props.monthlyTrend.map((t) => t.expense),
    1,
  );

  return (
    <Document
      title={`Pénzügyi összesítő — ${props.period.label}`}
      author={props.buildingName}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Pénzügyi összesítő</Text>
        <Text style={styles.title}>{props.period.label}</Text>
        <Text style={styles.subtitle}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          Időszak: {props.period.label} · forgalom havi bontásban
        </Text>

        {/* KPI ROW */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Nyitóegyenleg</Text>
            <Text style={styles.kpiValue}>{formatHUF(props.openingBalance)}</Text>
            <Text style={styles.kpiSub}>
              {new Date(props.period.startISO).toLocaleDateString("hu-HU")}
            </Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Záróegyenleg</Text>
            <Text style={[styles.kpiValue, closeDeltaStyle]}>
              {formatHUF(props.closingBalance)}
            </Text>
            <Text style={styles.kpiSub}>
              Δ {formatHUF(props.closingBalance - props.openingBalance)}
            </Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiLabel}>Nettó forgalom</Text>
            <Text style={[styles.kpiValue, netStyle]}>
              {formatHUF(props.netChange)}
            </Text>
            <Text style={styles.kpiSub}>
              {formatHUF(props.totalIncome)} bevétel ·{" "}
              {formatHUF(props.totalExpenses)} kiadás
            </Text>
          </View>
        </View>

        {/* INCOME */}
        <Text style={styles.sectionHeader}>Bevételek kategóriánként</Text>
        {props.incomeByCategory.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs bevétel a megadott időszakban.</Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.category}>Kategória</Text>
              <Text style={styles.amount}>Összeg</Text>
              <Text style={styles.share}>Arány</Text>
            </View>
            {props.incomeByCategory.map((c) => {
              const pct = props.totalIncome > 0 ? (c.amount / props.totalIncome) * 100 : 0;
              return (
                <View key={c.category} style={styles.row}>
                  <Text style={styles.category}>{c.category}</Text>
                  <Text style={[styles.amount, styles.good]}>
                    {formatHUF(c.amount)}
                  </Text>
                  <Text style={styles.share}>{pct.toFixed(1)}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* EXPENSE */}
        <Text style={styles.sectionHeader}>Kiadások kategóriánként</Text>
        {props.expenseByCategory.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs kiadás a megadott időszakban.</Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.category}>Kategória</Text>
              <Text style={styles.amount}>Összeg</Text>
              <Text style={styles.share}>Arány</Text>
            </View>
            {props.expenseByCategory.map((c) => {
              const pct = props.totalExpenses > 0 ? (c.amount / props.totalExpenses) * 100 : 0;
              return (
                <View key={c.category} style={styles.row}>
                  <Text style={styles.category}>{c.category}</Text>
                  <Text style={[styles.amount, styles.bad]}>
                    {formatHUF(c.amount)}
                  </Text>
                  <Text style={styles.share}>{pct.toFixed(1)}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* TOP ENTRIES */}
        <Text style={styles.sectionHeader}>
          10 legnagyobb tétel · {formatNumber(props.topEntries.length)} db
        </Text>
        {props.topEntries.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs könyvelt tétel az időszakban.</Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.topDate}>Dátum</Text>
              <Text style={styles.topDesc}>Megnevezés</Text>
              <Text style={styles.topCategory}>Kategória</Text>
              <Text style={styles.topAmount}>Összeg</Text>
            </View>
            {props.topEntries.map((e) => (
              <View key={e.id} style={styles.topRow} wrap={false}>
                <Text style={styles.topDate}>
                  {new Date(e.date).toLocaleDateString("hu-HU")}
                </Text>
                <Text style={styles.topDesc}>{e.description}</Text>
                <Text style={styles.topCategory}>{e.category}</Text>
                <Text
                  style={[
                    styles.topAmount,
                    e.kind === "income" ? styles.good : styles.bad,
                  ]}
                >
                  {e.kind === "expense" ? "−" : ""}
                  {formatHUF(e.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* MONTHLY TREND */}
        <Text style={styles.sectionHeader}>Havi trend · 6 hónap</Text>
        {props.monthlyTrend.length === 0 ? (
          <Text style={styles.emptyNote}>Nincs adat a megelőző hónapokra.</Text>
        ) : (
          <View>
            {props.monthlyTrend.map((t) => {
              const incomePct = (t.income / trendMaxIncome) * 100;
              const expensePct = (t.expense / trendMaxExpense) * 100;
              return (
                <View key={t.label} style={styles.trendRow} wrap={false}>
                  <Text style={styles.trendLabel}>{t.label}</Text>
                  <View style={styles.trendBars}>
                    <View style={styles.trendBarRow}>
                      <Text style={styles.trendBarLabel}>BE</Text>
                      <View style={styles.trendBarTrack}>
                        <View
                          style={[
                            styles.trendBarFill,
                            { width: `${incomePct}%`, backgroundColor: "#4a5a3e" },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.trendBarRow}>
                      <Text style={styles.trendBarLabel}>KI</Text>
                      <View style={styles.trendBarTrack}>
                        <View
                          style={[
                            styles.trendBarFill,
                            { width: `${expensePct}%`, backgroundColor: "#a04040" },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.trendNet,
                      t.net >= 0 ? styles.good : styles.bad,
                    ]}
                  >
                    {formatHUF(t.net)}
                  </Text>
                </View>
              );
            })}
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
