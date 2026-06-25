import "server-only";

import * as XLSX from "xlsx";
import { parseCsvLine } from "@/lib/finance/csv-import";
import type { ParsedFile } from "./types";

const MAX_ROWS = 5000;

/**
 * Parse an uploaded file (XLSX or CSV) into headers + rows.
 * Used server-side for validation. The client uses SheetJS directly for preview.
 */
export function parseFile(buffer: Buffer, fileName: string): ParsedFile {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "xlsx" || ext === "xls") {
    return parseXlsx(buffer);
  }

  if (ext === "csv") {
    return parseCsv(buffer);
  }

  throw new Error(`Unsupported file format: .${ext}. Use .xlsx or .csv`);
}

function parseXlsx(buffer: Buffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (raw.length === 0) {
    throw new Error("File is empty");
  }

  const headers = raw[0].map((h) => String(h ?? "").trim());
  const rows = raw.slice(1, MAX_ROWS + 1).map((row) =>
    row.map((cell) => String(cell ?? "").trim())
  );

  if (raw.length - 1 > MAX_ROWS) {
    throw new Error(`File has too many rows (max ${MAX_ROWS})`);
  }

  return { headers, rows };
}

function parseCsv(buffer: Buffer): ParsedFile {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("File is empty");
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const dataLines = lines.slice(1);

  if (dataLines.length > MAX_ROWS) {
    throw new Error(`File has too many rows (max ${MAX_ROWS})`);
  }

  const rows = dataLines.map((line) =>
    parseCsvLine(line).map((cell) => cell.trim())
  );

  return { headers, rows };
}
