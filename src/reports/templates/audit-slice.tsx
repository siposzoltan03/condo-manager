import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatDateTime, formatNumber } from "../lib/format";
import { color, font, size, space } from "../lib/theme";
import { ReportHeader, ReportFooter, SectionTitle, StatusPill } from "../lib/components";
import type { AuditSliceData } from "@/lib/reports/audit-slice-data";

export interface AuditSlicePdfProps extends AuditSliceData {
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
  buildingLine: { fontSize: size.lead, fontWeight: 500, color: color.inkSoft, marginBottom: 12 },

  metaBlock: {
    fontSize: size.small,
    color: color.inkSoft,
    marginBottom: 14,
    backgroundColor: color.panel,
    padding: 10,
    borderRadius: 6,
    lineHeight: 1.5,
  },
  truncated: { marginBottom: 12 },

  // Table
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
  cellTime: { width: 90 },
  cellActor: { width: 110 },
  cellAction: { width: 60 },
  cellEntity: { width: 110 },
  cellDiff: { flex: 1, color: color.inkSoft },

  manifestBox: {
    marginTop: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: color.panelEdge,
    borderStyle: "solid",
    borderRadius: 8,
  },
  manifestLabel: {
    fontSize: size.micro,
    color: color.muted,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  manifestHash: { fontFamily: font.mono, fontSize: size.small, color: color.ink },
  manifestNote: { fontSize: size.micro, color: color.muted, marginTop: 4, lineHeight: 1.4 },

  empty: { fontSize: size.small, color: color.faint, marginTop: 12 },
});

const ACTION_LABEL: Record<string, string> = {
  CREATE: "létr.",
  UPDATE: "mód.",
  DELETE: "törl.",
};

export function AuditSlicePdf(props: AuditSlicePdfProps) {
  return (
    <Document
      title={`Audit napló kivonat — ${props.filters.fromLabel}–${props.filters.toLabel}`}
      author={props.buildingName}
    >
      <Page size="A4" style={styles.page}>
        <ReportHeader reportType="Számviteli kivonat" reportRef="GDPR § 15" />

        {/* Title block */}
        <Text style={styles.title}>
          {props.filters.fromLabel} – {props.filters.toLabel}
        </Text>
        <Text style={styles.buildingLine}>{props.buildingName}</Text>

        <Text style={styles.metaBlock}>
          Generálta: {props.generatedBy.name} ({props.generatedBy.email}) ·{" "}
          {formatDateTime(props.generatedAt)}{" "}{"\n"}
          Tartomány: {props.filters.fromLabel} – {props.filters.toLabel} ·
          összesen {formatNumber(props.totalCount)} esemény
          {props.rows.length < props.totalCount &&
            ` · jelen kimutatáson ${formatNumber(props.rows.length)} esemény`}
        </Text>

        {props.truncated && (
          <View style={styles.truncated}>
            <StatusPill tone="warning">
              {`A találatok száma meghaladja a ${formatNumber(props.rowLimit)}-as korlátot. Csak a legfrissebb ${formatNumber(props.rowLimit)} esemény kerül megjelenítésre. Szűkítse a tartományt további részletekért.`}
            </StatusPill>
          </View>
        )}

        {/* AUDIT EVENTS */}
        <SectionTitle>Audit események</SectionTitle>
        {props.rows.length === 0 ? (
          <Text style={styles.empty}>Nincs audit esemény a megadott tartományban.</Text>
        ) : (
          <View>
            <View style={styles.thRow}>
              <Text style={styles.cellTime}>Időpont</Text>
              <Text style={styles.cellActor}>Felhasználó</Text>
              <Text style={styles.cellAction}>Művelet</Text>
              <Text style={styles.cellEntity}>Entitás</Text>
              <Text style={styles.cellDiff}>Részletek</Text>
            </View>
            {props.rows.map((r, i) => (
              <View key={r.id} style={[styles.tr, i % 2 === 1 ? styles.trZebra : {}]} wrap={false}>
                <Text style={styles.cellTime}>
                  {new Date(r.createdAt).toLocaleString("hu-HU", {
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={styles.cellActor}>{r.actor.name}</Text>
                <Text style={styles.cellAction}>
                  {ACTION_LABEL[r.action] ?? r.action}
                </Text>
                <Text style={styles.cellEntity}>
                  {r.entityType} #{r.entityId.slice(-6)}
                </Text>
                <Text style={styles.cellDiff}>{r.diffSummary}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.manifestBox} wrap={false}>
          <Text style={styles.manifestLabel}>Manifest hash · HMAC-SHA-256</Text>
          <Text style={styles.manifestHash}>{props.manifestHash}</Text>
          <Text style={styles.manifestNote}>
            A manifest hash a kivonat sorainak kanonikus formájából képzett
            HMAC-SHA-256. Ha a kimutatást utólag módosítják, a hash újraképzése
            nem fogja eredményezni ugyanezt az értéket — így a kivonat
            integritása ellenőrizhető.
          </Text>
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
