import type {
  ImportConfig,
  ColumnMapping,
  ImportRow,
  RowValidationResult,
} from "./types";

/**
 * Map raw rows to field keys using the column mapping, then validate each row.
 */
export function validateAndMapRows(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  config: ImportConfig
): RowValidationResult[] {
  // Build header-index → field-key lookup
  const headerToIndex = new Map<string, number>();
  headers.forEach((h, i) => headerToIndex.set(h, i));

  const fieldToColIndex = new Map<string, number>();
  for (const [header, fieldKey] of Object.entries(mapping)) {
    if (fieldKey) {
      const idx = headerToIndex.get(header);
      if (idx !== undefined) {
        fieldToColIndex.set(fieldKey, idx);
      }
    }
  }

  return rows.map((row, rowIndex) => {
    const data: ImportRow = {};
    const errors: string[] = [];

    for (const field of config.fields) {
      const colIndex = fieldToColIndex.get(field.key);
      const value = colIndex !== undefined ? (row[colIndex] ?? "") : "";
      data[field.key] = value;

      if (field.required && !value) {
        errors.push(`${field.label} is required`);
        continue;
      }

      if (value && field.validate) {
        const error = field.validate(value);
        if (error) {
          errors.push(`${field.label}: ${error}`);
        }
      }
    }

    return { rowIndex: rowIndex + 2, errors, data }; // +2 for 1-indexed + header row
  });
}

/**
 * Auto-match file headers to field keys by fuzzy name comparison.
 * Returns a ColumnMapping with best-guess matches.
 */
export function autoMatchColumns(
  fileHeaders: string[],
  fields: { key: string; label: string }[]
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedFieldKeys = new Set<string>();

  for (const header of fileHeaders) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    let bestMatch: string | null = null;

    for (const field of fields) {
      if (usedFieldKeys.has(field.key)) continue;

      const fieldNorm = field.key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (normalized === fieldNorm || normalized === labelNorm || normalized.includes(fieldNorm) || fieldNorm.includes(normalized)) {
        bestMatch = field.key;
        break;
      }
    }

    if (bestMatch) {
      mapping[header] = bestMatch;
      usedFieldKeys.add(bestMatch);
    } else {
      mapping[header] = null;
    }
  }

  return mapping;
}
