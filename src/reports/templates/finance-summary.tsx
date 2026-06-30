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
  formatNumber,
} from "../lib/format";
import { color, font, size, space } from "../lib/theme";
import { ReportHeader, ReportFooter, SectionTitle, StatusPill } from "../lib/components";
import type { FinanceSummaryData } from "@/lib/reports/finance-summary-data";

export interface FinanceSummaryPdfProps extends FinanceSummaryData {
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

  // KPI row
  kpiRow: {
    flexDirection: "row",
    marginBottom: 4,
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
  kpiValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  kpiSub: {
    fontSize: size.micro,
    color: color.muted,
    marginTop: 2,
  },
  good: { color: color.positive },
  bad: { color: color.negative },

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
  category: { flex: 3 },
  amount: { flex: 1, textAlign: "right", fontWeight: 500 },
  share: { flex: 1, textAlign: "right", color: color.muted },
  topDate: { width: 60, color: color.muted, fontSize: size.micro },
  topDesc: { flex: 1 },
  topCategory: { width: 90, color: color.muted, fontSize: size.micro },
  topAmount: { width: 80, textAlign: "right", fontWeight: 500 },

  // Monthly trend
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 5,
  },
  trendLabel: {
    width: 60,
    fontSize: size.micro,
    color: color.muted,
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
    color: color.muted,
    textTransform: "uppercase",
  },
  trendBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: color.panel,
    borderRadius: 3,
  },
  trendBarFill: {
    height: 6,
    borderRadius: 3,
  },
  trendNet: {
    width: 80,
    textAlign: "right",
    fontSize: size.micro,
  },

  empty: { fontSize: size.small, color: color.faint },
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
        <ReportHeader reportType="Pénzügyi összefoglaló" />

        {/* Title block */}
        <Text style={styles.title}>{props.period.label}</Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>
        <Text style={styles.meta}>
          Időszak: {props.period.label} · forgalom havi bontásban
        </Text>

        {/* Net result status */}
        <StatusPill tone={props.netChange >= 0 ? "positive" : "negative"}>
          {props.netChange >= 0
            ? `Pénzügyi többlet · ${formatHUF(props.netChange)}`
            : `Pénzügyi hiány · ${formatHUF(props.netChange)}`}
        </StatusPill>

        {/* KPI ROW */}
        <SectionTitle>Egyenlegek</SectionTitle>
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
        <SectionTitle>Bevételek kategóriánként</SectionTitle>
        {props.incomeByCategory.length === 0 ? (
          <Text style={styles.empty}>Nincs bevétel a megadott időszakban.</Text>
        ) : (
          <View>
            <View style={styles.thRow}>
              <Text style={styles.category}>Kategória</Text>
              <Text style={styles.amount}>Összeg</Text>
              <Text style={styles.share}>Arány</Text>
            </View>
            {props.incomeByCategory.map((c, i) => {
              const pct = props.totalIncome > 0 ? (c.amount / props.totalIncome) * 100 : 0;
              return (
                <View key={c.category} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]}>
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
        <SectionTitle>Kiadások kategóriánként</SectionTitle>
        {props.expenseByCategory.length === 0 ? (
          <Text style={styles.empty}>Nincs kiadás a megadott időszakban.</Text>
        ) : (
          <View>
            <View style={styles.thRow}>
              <Text style={styles.category}>Kategória</Text>
              <Text style={styles.amount}>Összeg</Text>
              <Text style={styles.share}>Arány</Text>
            </View>
            {props.expenseByCategory.map((c, i) => {
              const pct = props.totalExpenses > 0 ? (c.amount / props.totalExpenses) * 100 : 0;
              return (
                <View key={c.category} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]}>
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
        <SectionTitle>
          10 legnagyobb tétel · {formatNumber(props.topEntries.length)} db
        </SectionTitle>
        {props.topEntries.length === 0 ? (
          <Text style={styles.empty}>Nincs könyvelt tétel az időszakban.</Text>
        ) : (
          <View>
            <View style={styles.thRow}>
              <Text style={styles.topDate}>Dátum</Text>
              <Text style={styles.topDesc}>Megnevezés</Text>
              <Text style={styles.topCategory}>Kategória</Text>
              <Text style={styles.topAmount}>Összeg</Text>
            </View>
            {props.topEntries.map((e, i) => (
              <View key={e.id} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]} wrap={false}>
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
        <SectionTitle>Havi trend · 6 hónap</SectionTitle>
        {props.monthlyTrend.length === 0 ? (
          <Text style={styles.empty}>Nincs adat a megelőző hónapokra.</Text>
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
                            { width: `${incomePct}%`, backgroundColor: color.positive },
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
                            { width: `${expensePct}%`, backgroundColor: color.negative },
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

        <ReportFooter
          buildingName={props.buildingName}
          generatedAt={props.generatedAt}
          contentHash={props.contentHash}
        />
      </Page>
    </Document>
  );
}
