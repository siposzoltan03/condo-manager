"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import type { ImportConfig, ImportRow, ImportResult, ColumnMapping } from "@/lib/import/types";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: ImportRow[]) => Promise<ImportResult>;
  config: ImportConfig;
  title: string;
  description?: string;
}

type Step = "upload" | "mapping" | "preview" | "result";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 5000;
const PREVIEW_ROWS = 5;

export function ImportDialog({
  open,
  onClose,
  onImport,
  config,
  title,
  description,
}: ImportDialogProps) {
  const t = useTranslations("import");

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setFileHeaders([]);
    setFileRows([]);
    setMapping({});
    setImporting(false);
    setResult(null);
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  const processFile = useCallback(
    async (file: File) => {
      setError("");

      if (file.size > MAX_FILE_SIZE) {
        setError(t("fileTooLarge"));
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
        setError(t("acceptedFormats"));
        return;
      }

      try {
        const buffer = await file.arrayBuffer();
        // Dynamic import to avoid bundling xlsx on page load
        const XLSX = await import("xlsx");
        let headers: string[];
        let rows: string[][];

        if (ext === "csv") {
          const text = new TextDecoder().decode(buffer);
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length === 0) {
            setError(t("fileEmpty"));
            return;
          }
          // Simple CSV parse for client preview (server does full RFC 4180)
          headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
          rows = lines.slice(1, MAX_ROWS + 1).map((line) =>
            line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
          );
        } else {
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            blankrows: false,
          });
          if (raw.length === 0) {
            setError(t("fileEmpty"));
            return;
          }
          headers = raw[0].map((h) => String(h ?? "").trim());
          rows = raw.slice(1, MAX_ROWS + 1).map((r) =>
            (r as unknown[]).map((c) => String(c ?? "").trim())
          );
        }

        if (rows.length > MAX_ROWS) {
          setError(t("tooManyRows"));
          return;
        }

        setFileName(file.name);
        setFileHeaders(headers);
        setFileRows(rows);

        // Auto-match columns
        const autoMapping: ColumnMapping = {};
        const usedKeys = new Set<string>();
        for (const header of headers) {
          const norm = header.toLowerCase().replace(/[^a-z0-9]/g, "");
          let match: string | null = null;
          for (const field of config.fields) {
            if (usedKeys.has(field.key)) continue;
            const keyNorm = field.key.toLowerCase().replace(/[^a-z0-9]/g, "");
            const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (norm === keyNorm || norm === labelNorm || norm.includes(keyNorm) || keyNorm.includes(norm)) {
              match = field.key;
              break;
            }
          }
          autoMapping[header] = match;
          if (match) usedKeys.add(match);
        }
        setMapping(autoMapping);
        setStep("mapping");
      } catch (err) {
        setError(err instanceof Error ? err.message : t("parseError"));
      }
    },
    [config.fields, t]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function updateMapping(header: string, fieldKey: string | null) {
    // Clear any existing mapping to this fieldKey
    const newMapping = { ...mapping };
    if (fieldKey) {
      for (const [h, k] of Object.entries(newMapping)) {
        if (k === fieldKey) newMapping[h] = null;
      }
    }
    newMapping[header] = fieldKey;
    setMapping(newMapping);
  }

  function canProceedToPreview(): boolean {
    const mappedKeys = new Set(Object.values(mapping).filter(Boolean));
    return config.fields.filter((f) => f.required).every((f) => mappedKeys.has(f.key));
  }

  function getMappedRows(): ImportRow[] {
    const headerToIndex = new Map(fileHeaders.map((h, i) => [h, i]));
    const fieldToColIndex = new Map<string, number>();
    for (const [header, fieldKey] of Object.entries(mapping)) {
      if (fieldKey) {
        const idx = headerToIndex.get(header);
        if (idx !== undefined) fieldToColIndex.set(fieldKey, idx);
      }
    }

    return fileRows.map((row) => {
      const mapped: ImportRow = {};
      for (const field of config.fields) {
        const colIdx = fieldToColIndex.get(field.key);
        mapped[field.key] = colIdx !== undefined ? (row[colIdx] ?? "") : "";
      }
      return mapped;
    });
  }

  function getPreviewRows(): ImportRow[] {
    return getMappedRows().slice(0, PREVIEW_ROWS);
  }

  function validateRow(row: ImportRow): string[] {
    const errors: string[] = [];
    for (const field of config.fields) {
      const val = row[field.key] ?? "";
      if (field.required && !val) {
        errors.push(`${field.label} required`);
      } else if (val && field.validate) {
        const err = field.validate(val);
        if (err) errors.push(err);
      }
    }
    return errors;
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      const rows = getMappedRows();
      const importResult = await onImport(rows);
      setResult(importResult);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("importFailed"));
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card rounded-xl shadow-2xl mx-4 overflow-hidden border border-tile-a/20 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-tile-a/10 shrink-0">
          <div>
            <h2 className="text-lg font-bold font-manrope text-ink">{title}</h2>
            {description && <p className="text-sm text-ink-soft mt-0.5">{description}</p>}
          </div>
          <button onClick={handleClose} className="text-ink-soft hover:text-ink p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-8 py-3 border-b border-tile-a/10 text-xs font-medium shrink-0">
          {(["upload", "mapping", "preview", "result"] as Step[]).map((s, i) => (
            <span
              key={s}
              className={`flex items-center gap-1 ${
                s === step ? "text-blue font-bold" : "text-muted"
              }`}
            >
              <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] ${
                s === step ? "bg-blue text-card" : "bg-bg-2 text-ink-soft"
              }`}>{i + 1}</span>
              {t(`step${s.charAt(0).toUpperCase() + s.slice(1)}`)}
              {i < 3 && <ChevronRight className="h-3 w-3 text-tile-a ml-1" />}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Step: Upload */}
          {step === "upload" && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive ? "border-blue bg-blue/10" : "border-tile-a bg-bg-3"
              }`}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-12 w-12 text-ink-soft mx-auto mb-4" />
              <p className="text-sm font-medium text-ink mb-1">{t("dropFileHere")}</p>
              <p className="text-xs text-muted mb-4">{t("acceptedFormats")}: .xlsx, .csv</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2.5 text-sm font-bold text-card cursor-pointer hover:opacity-90 transition-all"
              >
                <Upload className="h-4 w-4" />
                {t("chooseFile")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* Step: Column Mapping */}
          {step === "mapping" && (
            <div>
              <p className="text-sm text-ink-soft mb-4">
                {t("mapColumnsDesc")} <span className="font-medium text-ink">{fileName}</span> ({fileRows.length} {t("rows")})
              </p>
              <div className="space-y-3">
                {config.fields.map((field) => {
                  const mappedHeader = Object.entries(mapping).find(([, k]) => k === field.key)?.[0] ?? "";
                  return (
                    <div key={field.key} className="flex items-center gap-4">
                      <div className="w-40 shrink-0">
                        <span className="text-sm font-medium text-ink">
                          {field.label}
                          {field.required && <span className="text-danger ml-0.5">*</span>}
                        </span>
                      </div>
                      <select
                        value={mappedHeader}
                        onChange={(e) => {
                          // Clear old mapping for this field
                          const oldHeader = Object.entries(mapping).find(([, k]) => k === field.key)?.[0];
                          if (oldHeader) updateMapping(oldHeader, null);
                          if (e.target.value) updateMapping(e.target.value, field.key);
                        }}
                        className="flex-1 rounded-lg border border-tile-a/40 bg-bg-3 px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-blue outline-none"
                      >
                        <option value="">{t("unmapped")}</option>
                        {fileHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div>
              <p className="text-sm text-ink-soft mb-4">{t("previewDesc")}</p>
              <div className="overflow-x-auto rounded-lg border border-tile-a/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-3 border-b border-tile-a/10">
                      <th className="px-3 py-2 text-left text-xs font-bold text-ink-soft">#</th>
                      {config.fields.map((f) => (
                        <th key={f.key} className="px-3 py-2 text-left text-xs font-bold text-ink-soft">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-bold text-ink-soft">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tile-a/10">
                    {getPreviewRows().map((row, i) => {
                      const errors = validateRow(row);
                      return (
                        <tr key={i} className="hover:bg-bg-2/20">
                          <td className="px-3 py-2 text-muted">{i + 1}</td>
                          {config.fields.map((f) => (
                            <td key={f.key} className="px-3 py-2 text-ink max-w-[200px] truncate">
                              {row[f.key] || <span className="text-tile-a italic">—</span>}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            {errors.length === 0 ? (
                              <Check className="h-4 w-4 text-good" />
                            ) : (
                              <span className="text-xs text-danger" title={errors.join(", ")}>
                                <AlertTriangle className="h-4 w-4 inline" /> {errors.length}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted">
                {t("showingPreview", { count: Math.min(PREVIEW_ROWS, fileRows.length), total: fileRows.length })}
              </p>
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && result && (
            <div className="text-center py-4">
              <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                result.errors.length === 0 ? "bg-good/10" : "bg-ochre/15"
              }`}>
                {result.errors.length === 0 ? (
                  <Check className="h-8 w-8 text-good" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-ochre" />
                )}
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">{t("importComplete")}</h3>
              <div className="flex justify-center gap-6 text-sm mb-4">
                <div>
                  <p className="text-2xl font-extrabold text-good">{result.created}</p>
                  <p className="text-ink-soft">{t("created")}</p>
                </div>
                {result.skipped > 0 && (
                  <div>
                    <p className="text-2xl font-extrabold text-ink-soft">{result.skipped}</p>
                    <p className="text-ink-soft">{t("skipped")}</p>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div>
                    <p className="text-2xl font-extrabold text-danger">{result.errors.length}</p>
                    <p className="text-ink-soft">{t("errorsCount")}</p>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="text-left mt-4 rounded-lg bg-danger/10 p-4 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <p key={i} className="text-xs text-danger mb-1">
                      Row {e.row}: {e.message}
                    </p>
                  ))}
                  {result.errors.length > 20 && (
                    <p className="text-xs text-muted mt-2">
                      ...and {result.errors.length - 20} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-tile-a/10 bg-bg-3/50 shrink-0">
          <div>
            {step !== "upload" && step !== "result" && (
              <button
                onClick={() => setStep(step === "preview" ? "mapping" : "upload")}
                className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("back")}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step === "result" ? (
              <button
                onClick={handleClose}
                className="rounded-lg bg-blue px-6 py-2.5 text-sm font-bold text-card hover:opacity-90 transition-all"
              >
                {t("close")}
              </button>
            ) : step === "mapping" ? (
              <button
                onClick={() => setStep("preview")}
                disabled={!canProceedToPreview()}
                className="inline-flex items-center gap-1 rounded-lg bg-blue px-6 py-2.5 text-sm font-bold text-card hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {t("next")}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : step === "preview" ? (
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-lg bg-blue px-6 py-2.5 text-sm font-bold text-card hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("importing")}
                  </>
                ) : (
                  t("confirm")
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
