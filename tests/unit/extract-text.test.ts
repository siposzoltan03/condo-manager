import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { extractTextFromFile } from "@/lib/documents/extract-text";

/**
 * Text extraction for version comparison. (PDF extraction via unpdf is verified
 * manually — here we cover the deterministic csv/xlsx/text/unsupported branches.)
 */
describe("extractTextFromFile", () => {
  it("returns CSV/plain text as-is", async () => {
    const buf = Buffer.from("Albetét,Hányad\n1A,0.5\n1B,0.5\n", "utf-8");
    const out = await extractTextFromFile(buf, "text/csv", "lakaslista.csv");
    expect(out).toContain("1A,0.5");
  });

  it("reads text/* by mime even with an odd extension", async () => {
    const buf = Buffer.from("hello szöveg", "utf-8");
    const out = await extractTextFromFile(buf, "text/plain", "note.dat");
    expect(out).toBe("hello szöveg");
  });

  it("flattens an xlsx to CSV-ish text", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Albetét", "Hányad"],
      ["2A", 0.25],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Albetétek");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const out = await extractTextFromFile(
      buf,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "lista.xlsx",
    );
    expect(out).toContain("Albetét");
    expect(out).toContain("2A");
  });

  it("returns empty string for unsupported types", async () => {
    const out = await extractTextFromFile(Buffer.from([0, 1, 2]), "image/png", "x.png");
    expect(out).toBe("");
  });
});
