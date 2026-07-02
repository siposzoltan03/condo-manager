import "server-only";

/**
 * Extract plain text from a stored document file for version comparison.
 * Supports PDF (via unpdf — serverless-friendly, no pdf-parse import gotchas),
 * spreadsheets (xlsx/xls → CSV), and text/CSV. Unsupported types return "".
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mt = (mimeType || "").toLowerCase();

  if (mt.includes("pdf") || ext === "pdf") {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }

  if (ext === "xlsx" || ext === "xls" || mt.includes("spreadsheet") || mt.includes("excel")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    return wb.SheetNames.map(
      (name) => `# ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`,
    ).join("\n\n");
  }

  if (ext === "csv" || ext === "txt" || mt.startsWith("text/") || mt.includes("csv")) {
    return buffer.toString("utf-8");
  }

  return "";
}
