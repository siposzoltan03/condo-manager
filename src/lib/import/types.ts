export interface ImportFieldConfig {
  /** Internal field key (e.g. "unit_number") */
  key: string;
  /** Display label (i18n key or plain text) */
  label: string;
  /** Whether this field is required */
  required: boolean;
  /** Optional validator — returns error string or null if valid */
  validate?: (value: string) => string | null;
}

export interface ImportConfig {
  /** Field definitions for this import type */
  fields: ImportFieldConfig[];
  /** Max data rows allowed (default 5000) */
  maxRows?: number;
  /** Max file size in bytes (default 2MB) */
  maxFileSize?: number;
}

/** Maps file column headers to field keys. null = unmapped */
export type ColumnMapping = Record<string, string | null>;

/** A single row with field keys as keys */
export type ImportRow = Record<string, string>;

export interface RowValidationResult {
  rowIndex: number;
  errors: string[];
  data: ImportRow;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
  summary?: Record<string, unknown>;
}

export interface ParsedFile {
  headers: string[];
  rows: string[][];
}
