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

export function parseCsv(csv: string): CsvParseResult {
  const validRows: CsvRow[] = [];
  const errors: string[] = [];

  const lines = csv.trim().split("\n");
  if (lines.length === 0) {
    errors.push("CSV is empty");
    return { validRows, errors };
  }

  // Parse header row
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
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

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",").map((c) => c.trim());
    const rowNum = i + 1;

    // Validate date
    const dateStr = cols[dateIdx] ?? "";
    if (!dateStr || isNaN(Date.parse(dateStr))) {
      errors.push(`Row ${rowNum}: invalid or missing date "${dateStr}"`);
      continue;
    }

    // Validate description
    const description = cols[descIdx] ?? "";
    if (!description) {
      errors.push(`Row ${rowNum}: missing description`);
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

    if (credit !== null && (isNaN(credit) || credit < 0)) {
      errors.push(`Row ${rowNum}: invalid credit amount "${creditStr}"`);
      continue;
    }

    if (debit === null && credit === null) {
      errors.push(`Row ${rowNum}: at least one of debit or credit must be provided`);
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
