export interface CsvRow {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
}

export interface CsvParseResult {
  validRows: CsvRow[];
  errors: string[];
}

const MAX_ROWS = 5000;
const MAX_AMOUNT = 10_000_000;
const MAX_DESCRIPTION_LENGTH = 500;
const STRICT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a single CSV line with RFC 4180 quote-aware field splitting.
 * Handles quoted fields containing commas, newlines, and escaped quotes ("").
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      fields.push("");
      break;
    }
    if (line[i] === '"') {
      // Quoted field: read until closing quote
      let value = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // Escaped quote
            value += '"';
            i += 2;
          } else {
            // Closing quote
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value.trim());
      // Skip comma after quoted field
      if (i < line.length && line[i] === ',') i++;
    } else {
      // Unquoted field: read until next comma
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.slice(i).trim());
        break;
      } else {
        fields.push(line.slice(i, commaIdx).trim());
        i = commaIdx + 1;
      }
    }
  }
  return fields;
}

export function parseCsv(csv: string): CsvParseResult {
  const validRows: CsvRow[] = [];
  const errors: string[] = [];

  if (csv.trim().length === 0) {
    errors.push("CSV is empty");
    return { validRows, errors };
  }

  const lines = csv.trim().split("\n");
  if (lines.length === 0) {
    errors.push("CSV is empty");
    return { validRows, errors };
  }

  // Parse header row
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const descIdx = header.indexOf("description");
  const debitIdx = header.indexOf("debit");
  const creditIdx = header.indexOf("credit");

  if (dateIdx === -1 || descIdx === -1) {
    errors.push("CSV must have 'date' and 'description' columns");
    return { validRows, errors };
  }

  if (debitIdx === -1 && creditIdx === -1) {
    errors.push("CSV must have at least one of 'debit' or 'credit' columns");
    return { validRows, errors };
  }

  let dataRowCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    dataRowCount++;
    if (dataRowCount > MAX_ROWS) {
      errors.push(`Row limit exceeded: CSV may not contain more than ${MAX_ROWS} data rows`);
      break;
    }

    const cols = parseCsvLine(line);
    const rowNum = i + 1;

    // Validate date — strict YYYY-MM-DD with year range 2000-2100
    const dateStr = cols[dateIdx] ?? "";
    if (!dateStr || !STRICT_DATE_RE.test(dateStr)) {
      errors.push(`Row ${rowNum}: invalid or missing date "${dateStr}" (expected YYYY-MM-DD)`);
      continue;
    }
    const dateYear = parseInt(dateStr.slice(0, 4), 10);
    if (dateYear < 2000 || dateYear > 2100) {
      errors.push(`Row ${rowNum}: date year must be between 2000 and 2100`);
      continue;
    }

    // Validate description
    const description = cols[descIdx] ?? "";
    if (!description) {
      errors.push(`Row ${rowNum}: missing description`);
      continue;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Row ${rowNum}: description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
      continue;
    }

    // Parse amounts
    const debitStr = debitIdx !== -1 ? (cols[debitIdx] ?? "") : "";
    const creditStr = creditIdx !== -1 ? (cols[creditIdx] ?? "") : "";
    const debit = debitStr ? parseFloat(debitStr) : null;
    const credit = creditStr ? parseFloat(creditStr) : null;

    if (debit !== null && (isNaN(debit) || debit < 0)) {
      errors.push(`Row ${rowNum}: invalid debit amount "${debitStr}"`);
      continue;
    }

    if (debit !== null && debit > MAX_AMOUNT) {
      errors.push(`Row ${rowNum}: debit amount exceeds maximum allowed value`);
      continue;
    }

    if (credit !== null && (isNaN(credit) || credit < 0)) {
      errors.push(`Row ${rowNum}: invalid credit amount "${creditStr}"`);
      continue;
    }

    if (credit !== null && credit > MAX_AMOUNT) {
      errors.push(`Row ${rowNum}: credit amount exceeds maximum allowed value`);
      continue;
    }

    if (debit === null && credit === null) {
      errors.push(`Row ${rowNum}: at least one of debit or credit must be provided`);
      continue;
    }

    if (debit !== null && debit > 0 && credit !== null && credit > 0) {
      errors.push(`Row ${rowNum}: both debit and credit are positive; only one may have a value`);
      continue;
    }

    if (debit !== null && debit === 0 && credit !== null && credit === 0) {
      errors.push(`Row ${rowNum}: both debit and credit are zero`);
      continue;
    }

    validRows.push({
      date: dateStr,
      description,
      debit: debit && debit > 0 ? debit : null,
      credit: credit && credit > 0 ? credit : null,
    });
  }

  return { validRows, errors };
}
