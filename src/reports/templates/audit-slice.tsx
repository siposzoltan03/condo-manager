import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatDateTime, formatNumber } from "../lib/format";
import { shortHash } from "../lib/footer";
import type { AuditSliceData } from "@/lib/reports/audit-slice-data";

export interface AuditSlicePdfProps extends AuditSliceData {
  generatedAt: Date;
  contentHash: string;
}

const styles = StyleSheet.create({
  page: {
    padding: "44 40 60 40",
    fontSize: 9,
    color: "#16181a",
    fontFamily: "Manrope",
    lineHeight: 1.4,
  },
  eyebrow: {
    fontSize: 9,
    color: "#6c727a",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 500,
    letterSpacing: -0.5,
    lineHeight: 1.25,
    marginBottom: 4,
  },
  buildingLine: {
    fontSize: 11,
    color: "#3a4048",
    marginBottom: 12,
  },
  metaBlock: {
    fontSize: 9,
    color: "#3a4048",
    marginBottom: 14,
    backgroundColor: "#f6f3ec",
    padding: 9,
    borderRadius: 5,
    lineHeight: 1.5,
  },
  truncated: {
    fontSize: 9,
    color: "#a04040",
    marginBottom: 12,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#a04040",
  },
  rowHeader: {
    flexDirection: "row",
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#16181a",
    borderBottomStyle: "solid",
    fontSize: 8,
    color: "#6c727a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e6e1",
    borderBottomStyle: "solid",
    fontSize: 8.5,
  },
  cellTime: { width: 90 },
  cellActor: { width: 110 },
  cellAction: { width: 60 },
  cellEntity: { width: 110 },
  cellDiff: { flex: 1, color: "#3a4048" },
  manifestBox: {
    marginTop: 16,
    padding: 9,
    border: "1pt solid #d4d2cc",
    borderRadius: 5,
  },
  manifestLabel: {
    fontSize: 8,
    color: "#6c727a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  manifestHash: {
    fontFamily: "Courier",
    fontSize: 8.5,
    color: "#16181a",
  },
  manifestNote: {
    fontSize: 8,
    color: "#6c727a",
    marginTop: 4,
    lineHeight: 1.4,
  },
  emptyNote: { fontSize: 10, color: "#9a9c9f", marginTop: 12 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9a9c9f",
    letterSpacing: 0.6,
  },
  pageNum: { fontFamily: "Courier" },
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
        <Text style={styles.eyebrow}>Audit napló kivonat · GDPR § 15</Text>
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
          <Text style={styles.truncated}>
            A találatok száma meghaladja a {formatNumber(props.rowLimit)}-as
            korlátot. Csak a legfrissebb {formatNumber(props.rowLimit)} esemény
            kerül megjelenítésre. Szűkítse a tartományt további részletekért.
          </Text>
        )}

        {props.rows.length === 0 ? (
          <Text style={styles.emptyNote}>
            Nincs audit esemény a megadott tartományban.
          </Text>
        ) : (
          <View>
            <View style={styles.rowHeader}>
              <Text style={styles.cellTime}>Időpont</Text>
              <Text style={styles.cellActor}>Felhasználó</Text>
              <Text style={styles.cellAction}>Művelet</Text>
              <Text style={styles.cellEntity}>Entitás</Text>
              <Text style={styles.cellDiff}>Részletek</Text>
            </View>
            {props.rows.map((r) => (
              <View key={r.id} style={styles.row} wrap={false}>
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
